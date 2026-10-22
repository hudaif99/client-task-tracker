import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "./app.ts";
import { readDeploymentOptions } from "./deployment-options.ts";

// No real database or auth service is imported. These fixtures also check
// that each SQL operation binds the session owner at its query boundary.
function database() {
  const clients = [
    { id: 1, name: "Alice client", owner_id: "alice" },
    { id: 2, name: "Bob client", owner_id: "bob" },
  ];
  const tasks = [
    { id: 11, client_id: 1, title: "Alice task", status: "pending", due_date: "2026-10-31" },
    { id: 22, client_id: 2, title: "Bob task", status: "completed", due_date: null },
  ];
  const calls = [];
  const visibleClient = client => client && ({ id: client.id, name: client.name });
  async function query(sql, values = []) {
    const text = sql.replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    let rows = [];
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) return { rows };
    if (text.startsWith("SELECT count")) {
      rows = [{ count: String(tasks.filter(task => task.client_id === values[0]).length) }];
    } else if (text.startsWith("INSERT INTO public.clients")) {
      assert.match(text, /\(name, owner_id\) VALUES \(\$1, \$2\)/);
      const client = { id: 3, name: values[0], owner_id: values[1] };
      clients.push(client);
      rows = [visibleClient(client)];
    } else if (text.startsWith("UPDATE public.clients")) {
      assert.match(text, /WHERE id = \$2 AND owner_id = \$3/);
      const client = clients.find(row => row.id === values[1] && row.owner_id === values[2]);
      if (client) { client.name = values[0]; rows = [visibleClient(client)]; }
    } else if (text.startsWith("DELETE FROM public.clients")) {
      assert.match(text, /WHERE id = \$1 AND owner_id = \$2/);
      const index = clients.findIndex(row => row.id === values[0] && row.owner_id === values[1]);
      if (index >= 0) {
        rows = [visibleClient(clients.splice(index, 1)[0])];
        for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].client_id === values[0]) tasks.splice(i, 1);
      }
    } else if (text.startsWith("INSERT INTO public.tasks")) {
      assert.match(text, /SELECT id, \$2, \$4::date FROM public.clients WHERE id = \$1 AND owner_id = \$3/);
      assert.match(text, /to_char\(due_date::timestamp, 'YYYY-MM-DD'\) AS due_date/);
      if (clients.some(row => row.id === values[0] && row.owner_id === values[2])) {
        const task = { id: 33, client_id: values[0], title: values[1], status: "pending", due_date: values[3] };
        tasks.push(task); rows = [task];
      }
    } else if (text.startsWith("UPDATE public.tasks")) {
      assert.match(text, /WHERE id = \$3 AND client_id = \$4 AND EXISTS \(SELECT 1 FROM public.clients WHERE id = \$4 AND owner_id = \$5\)/);
      assert.match(text, /due_date = CASE WHEN \$6::boolean THEN \$7::date ELSE due_date END/);
      assert.match(text, /to_char\(due_date::timestamp, 'YYYY-MM-DD'\) AS due_date/);
      const task = tasks.find(row => row.id === values[2] && row.client_id === values[3]);
      if (task && clients.some(row => row.id === values[3] && row.owner_id === values[4])) {
        task.title = values[0] ?? task.title; task.status = values[1] ?? task.status;
        if (values[5]) task.due_date = values[6];
        rows = [task];
      }
    } else if (text.includes("FROM public.tasks")) {
      assert.match(text, /EXISTS \(SELECT 1 FROM public.clients WHERE id = \$1 AND owner_id = \$4\)/);
      assert.match(text, /to_char\(due_date::timestamp, 'YYYY-MM-DD'\) AS due_date/);
      if (clients.some(row => row.id === values[0] && row.owner_id === values[3])) {
        rows = tasks.filter(row => row.client_id === values[0] &&
          (values[1] === null || row.status === values[1]) && (values[2] === null || row.id < values[2]))
          .sort((a, b) => b.id - a.id).slice(0, 51);
      }
    } else if (text.includes("FROM public.clients")) {
      if (text.includes("WHERE id = $1")) {
        assert.match(text, /WHERE id = \$1 AND owner_id = \$2/);
        rows = clients.filter(row => row.id === values[0] && row.owner_id === values[1]).map(visibleClient);
      } else {
        assert.match(text, /WHERE owner_id = \$1 ORDER BY id DESC LIMIT 50/);
        rows = clients.filter(row => row.owner_id === values[0]).sort((a, b) => b.id - a.id).slice(0, 50).map(visibleClient);
      }
    } else { throw new Error(`Unexpected fixture query: ${text}`); }
    return { rows };
  }
  return { clients, tasks, calls, pool: { query, connect: async () => ({ query, release() {} }) } };
}

async function fixture(run, deployment) {
  const db = database();
  const app = createApp(db.pool, {
    handler: async () => new Response(null, { status: 404 }),
    getUser: async headers => {
      const cookie = headers.get("cookie");
      if (cookie === "session=broken") throw new Error("Simulated session failure");
      const id = cookie === "session=alice" ? "alice" : cookie === "session=bob" ? "bob" : null;
      return id ? { id, name: id, email: `${id}@example.invalid` } : null;
    },
  }, deployment);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, { user = "alice", body, headers = {} } = {}) => {
      const response = await fetch(base + path, {
        method, headers: { ...(user ? { Cookie: `session=${user}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const json = await response.json();
      return { status: response.status, headers: response.headers, json };
    };
    await run(db, request);
  } finally { await new Promise(resolve => server.close(resolve)); }
}

test("all client/task endpoints reject missing or invalid sessions before database access", async () => {
  await fixture(async (db, request) => {
    for (const user of [null, "invalid"]) {
      for (const [method, path] of [["GET", "/clients"], ["GET", "/clients/1"],
        ["POST", "/clients"], ["PATCH", "/clients/1"], ["DELETE", "/clients/1"],
        ["GET", "/clients/1/tasks"], ["POST", "/clients/1/tasks"], ["PATCH", "/clients/1/tasks/11"]]) {
        const result = await request(method, path, { user });
        assert.equal(result.status, 401, `${method} ${path}`);
        assert.equal(result.json.error.code, "UNAUTHENTICATED");
        assert.equal(result.headers.get("cache-control"), "no-store");
      }
    }
    assert.equal(db.calls.length, 0);
  });
});

test("another user's clients and tasks return 404 without changes or task-count disclosure", async () => {
  await fixture(async (db, request) => {
    const before = JSON.stringify([db.clients, db.tasks]);
    for (const [method, path, body] of [["GET", "/clients/2"], ["PATCH", "/clients/2", { name: "Stolen" }],
      ["DELETE", "/clients/2", { confirmTaskDeletion: true, expectedTaskCount: 1 }],
      ["GET", "/clients/2/tasks"], ["POST", "/clients/2/tasks", { title: "Stolen" }],
      ["PATCH", "/clients/2/tasks/22", { title: "Stolen", status: "pending" }],
      ["PATCH", "/clients/1/tasks/22", { status: "pending" }]]) {
      const result = await request(method, path, { body });
      assert.equal(result.status, 404, `${method} ${path}`);
      assert.equal("taskCount" in result.json.error, false);
    }
    assert.equal(JSON.stringify([db.clients, db.tasks]), before);
    assert.equal(db.calls.some(call => call.text.startsWith("SELECT count")), false);
  });
});

test("client reads isolate both owners; creation ignores a forged owner and rename preserves it", async () => {
  await fixture(async (db, request) => {
    for (const [user, id] of [["alice", 1], ["bob", 2]]) {
      const list = await request("GET", "/clients", { user });
      assert.equal(list.status, 200);
      assert.deepEqual(list.json.data.map(row => row.id), [id]);
      assert.equal(list.headers.get("cache-control"), "no-store");
      assert.equal((await request("GET", `/clients/${id}`, { user })).status, 200);
    }
    const created = await request("POST", "/clients", { body: { name: "New", owner_id: "bob" } });
    assert.equal(created.status, 201);
    assert.equal(db.clients.find(row => row.id === 3).owner_id, "alice");
    const renamed = await request("PATCH", "/clients/3", { body: { name: "Renamed", owner_id: "bob" } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.data.name, "Renamed");
    assert.equal(db.clients.find(row => row.id === 3).owner_id, "alice");
  });
});

test("owned task create/update/list preserves parent, filter and cursor boundaries", async () => {
  await fixture(async (db, request) => {
    const created = await request("POST", "/clients/1/tasks", { body: { title: "New", client_id: 2, owner_id: "bob" } });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.client_id, 1);
    const edited = await request("PATCH", "/clients/1/tasks/33", { body: { title: "Edited", owner_id: "bob" } });
    assert.equal(edited.status, 200);
    assert.equal(edited.json.data.status, "pending");
    const completed = await request("PATCH", "/clients/1/tasks/33", { body: { status: "completed" } });
    assert.equal(completed.json.data.title, "Edited");
    for (const [path, ids] of [["/clients/1/tasks", [33, 11]], ["/clients/1/tasks?status=pending", [11]],
      ["/clients/1/tasks?status=completed", [33]], ["/clients/1/tasks?before=33", [11]]]) {
      const result = await request("GET", path);
      assert.equal(result.status, 200);
      assert.deepEqual(result.json.data.map(row => row.id), ids);
    }
    assert.equal(db.tasks.find(row => row.id === 22).title, "Bob task");
  });
});

test("owned deletion still requires task confirmation and deletes only the owned parent", async () => {
  await fixture(async (db, request) => {
    const warning = await request("DELETE", "/clients/1");
    assert.equal(warning.status, 409);
    assert.equal(warning.json.error.taskCount, 1);
    assert.equal(db.clients.length, 2);
    const result = await request("DELETE", "/clients/1", { body: { confirmTaskDeletion: true, expectedTaskCount: 1 } });
    assert.equal(result.status, 200);
    assert.deepEqual(db.clients.map(row => row.id), [2]);
    assert.deepEqual(db.tasks.map(row => row.id), [22]);
  });
});

test("due dates can be created, read, changed and cleared without affecting title/status", async () => {
  await fixture(async (db, request) => {
    const original = await request("GET", "/clients/1/tasks");
    assert.equal(original.json.data[0].due_date, "2026-10-31");
    const created = await request("POST", "/clients/1/tasks", { body: { title: "Dated", due_date: "2026-12-31" } });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.due_date, "2026-12-31");
    const renamed = await request("PATCH", "/clients/1/tasks/33", { body: { title: "Renamed" } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.data.due_date, "2026-12-31");
    const completed = await request("PATCH", "/clients/1/tasks/33", { body: { status: "completed" } });
    assert.equal(completed.json.data.due_date, "2026-12-31");
    const changed = await request("PATCH", "/clients/1/tasks/33", { body: { due_date: "2027-01-01" } });
    assert.equal(changed.status, 200);
    assert.equal(changed.json.data.due_date, "2027-01-01");
    assert.equal(changed.json.data.title, "Renamed");
    assert.equal(changed.json.data.status, "completed");
    const cleared = await request("PATCH", "/clients/1/tasks/33", { body: { due_date: null } });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.json.data.due_date, null);
    assert.equal(cleared.json.data.title, "Renamed");
    assert.equal(cleared.json.data.status, "completed");
    assert.equal(db.tasks.find(row => row.id === 11).due_date, "2026-10-31");
  });
});

test("omitted/null dates create undated tasks; invalid dates reject entire writes before SQL", async () => {
  for (const date of [undefined, null]) await fixture(async (_db, request) => {
    const result = await request("POST", "/clients/1/tasks", { body: { title: "Undated", ...(date === undefined ? {} : { due_date: date }) } });
    assert.equal(result.status, 201);
    assert.equal(result.json.data.due_date, null);
  });
  await fixture(async (db, request) => {
    for (const date of ["2026-02-30", "2026-10-31T00:00:00Z", "", 10]) {
      for (const [method, path, body] of [["POST", "/clients/1/tasks", { title: "New", due_date: date }],
        ["PATCH", "/clients/1/tasks/11", { title: "Changed", status: "completed", due_date: date }]]) {
        const result = await request(method, path, { body });
        assert.equal(result.status, 400);
        assert.equal(result.json.error.code, "INVALID_TASK_DUE_DATE");
      }
    }
    assert.equal(db.calls.length, 0);
    assert.equal(db.tasks[0].title, "Alice task");
  });
});

test("date writes require authentication and the owning parent, including explicit clears", async () => {
  await fixture(async (db, request) => {
    for (const due_date of [null, "2026-10-31"]) {
      const body = { title: "Stolen", due_date };
      assert.equal((await request("POST", "/clients/1/tasks", { user: null, body })).status, 401);
      assert.equal((await request("PATCH", "/clients/1/tasks/11", { user: null, body })).status, 401);
      assert.equal((await request("POST", "/clients/2/tasks", { body })).status, 404);
      assert.equal((await request("PATCH", "/clients/2/tasks/22", { body })).status, 404);
      assert.equal((await request("PATCH", "/clients/1/tasks/22", { body })).status, 404);
    }
    assert.equal(db.tasks[1].due_date, null);
    assert.equal(db.tasks.length, 2);
  });
});

test("session failures and untrusted browser writes fail closed", async () => {
  await fixture(async (db, request) => {
    const failed = await request("GET", "/clients", { user: "broken" });
    assert.equal(failed.status, 500);
    assert.equal(failed.json.error.code, "AUTH_SESSION_FAILED");
    for (const headers of [{ Origin: "https://untrusted.example" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }]) {
      const result = await request("DELETE", "/clients/1", { headers });
      assert.equal(result.status, 403);
    }
    assert.equal(db.calls.length, 0);
    const allowed = await request("PATCH", "/clients/1", { body: { name: "Allowed" }, headers: { Origin: "http://127.0.0.1:3000" } });
    assert.equal(allowed.status, 200);
  });
});

test("hosted CORS and resource writes use the configured HTTPS origin while retaining ownership checks", async () => {
  const origin = "https://tracker.example";
  await fixture(async (db, request) => {
    for (const denied of ["http://127.0.0.1:3000", "https://evil.example", "null"]) {
      const result = await request("PATCH", "/clients/1", { body: { name: "Blocked" }, headers: { Origin: denied } });
      assert.equal(result.status, 403);
      assert.equal(result.headers.get("access-control-allow-origin"), null);
    }
    assert.equal(db.calls.length, 0);
    const headers = { Origin: origin, "Sec-Fetch-Site": "same-origin" };
    const unauthorized = await request("PATCH", "/clients/1", { user: null, body: { name: "Blocked" }, headers });
    assert.equal(unauthorized.status, 401);
    const otherOwner = await request("PATCH", "/clients/2", { body: { name: "Blocked" }, headers });
    assert.equal(otherOwner.status, 404);
    const allowed = await request("PATCH", "/clients/1", { body: { name: "Allowed" }, headers });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    const crossSite = await request("PATCH", "/clients/1", {
      body: { name: "Blocked" }, headers: { ...headers, "Sec-Fetch-Site": "cross-site" },
    });
    assert.equal(crossSite.status, 403);
    assert.equal(db.clients[1].name, "Bob client");
  }, readDeploymentOptions({ BETTER_AUTH_URL: origin }));
});

test("auth rate-limit identity ignores spoofed internal headers and opts into loopback proxy trust only", async () => {
  for (const trust of [false, true]) {
    const app = createApp(database().pool, {
      getUser: async () => null,
      handler: async request => Response.json({ ip: request.headers.get("x-tracker-client-ip") }),
    }, readDeploymentOptions({ BETTER_AUTH_URL: "https://tracker.example", TRUST_LOOPBACK_PROXY: String(trust) }));
    const server = app.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/check`, {
        headers: { "X-Forwarded-For": "198.51.100.8, 203.0.113.9", "X-Tracker-Client-IP": "192.0.2.99" },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ip: trust ? "203.0.113.9" : "127.0.0.1" });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});
