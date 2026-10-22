import { db } from "./db.ts";
import { auth } from "./auth.ts";
import { createApp } from "./app.ts";
import { readDeploymentOptions } from "./deployment-options.ts";

const app = createApp(db, {
  handler: auth.handler,
  getUser: async (headers) => {
    const session = await auth.api.getSession({
      headers,
      // Check the database without renewing the session or trusting a cookie cache.
      query: { disableRefresh: true, disableCookieCache: true },
    });
    return session?.user ?? null;
  },
}, readDeploymentOptions(process.env));

const port = 4000;
app.listen(port, "127.0.0.1", () => {
  console.log(`Backend running at http://127.0.0.1:${port}`);
});
