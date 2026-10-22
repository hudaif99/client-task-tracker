import assert from "node:assert/strict";
import test from "node:test";
import { readApiUrls } from "./api-urls.ts";

test("local development retains the existing two-port browser and server URLs", () => {
  assert.deepEqual(readApiUrls({ API_BASE_URL: "http://127.0.0.1:4000" }), {
    internalClients: "http://127.0.0.1:4000/clients",
    browserClients: "http://127.0.0.1:4000/clients",
    browserAuthOrigin: "http://127.0.0.1:4000",
  });
});

test("HTTPS browser actions use the public API path while SSR stays on the internal backend", () => {
  for (const origin of ["https://tracker.example", "https://tracker.example/"]) {
    assert.deepEqual(readApiUrls({ API_BASE_URL: "http://127.0.0.1:4000", APP_ORIGIN: origin }), {
      internalClients: "http://127.0.0.1:4000/clients",
      browserClients: "https://tracker.example/api/clients",
      browserAuthOrigin: "https://tracker.example",
    });
  }
});

test("invalid public or internal configuration fails without exposing supplied credentials", () => {
  for (const APP_ORIGIN of ["", "http://tracker.example", "https://tracker.example/path",
    "https://tracker.example?x=1", "https://tracker.example#x", "https://tracker.example?",
    "https://private:secret@tracker.example", " https://tracker.example"]) {
    assert.throws(() => readApiUrls({ API_BASE_URL: "http://127.0.0.1:4000", APP_ORIGIN }), /^Error: APP_ORIGIN must be/);
  }
  for (const API_BASE_URL of ["bad", "file:///tmp/test", "http://private:secret@tracker.example"]) {
    assert.throws(() => readApiUrls({ API_BASE_URL }), /^Error: API_BASE_URL must be/);
  }
  assert.throws(() => readApiUrls({}), /Missing API_BASE_URL/);
});
