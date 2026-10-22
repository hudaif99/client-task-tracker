type ApiEnvironment = { API_BASE_URL?: string; APP_ORIGIN?: string };

export function readApiUrls(env: ApiEnvironment) {
  if (!env.API_BASE_URL) throw new Error("Missing API_BASE_URL");
  let internal: URL;
  try {
    internal = new URL(env.API_BASE_URL);
  } catch {
    throw new Error("API_BASE_URL must be an HTTP(S) address without credentials");
  }
  if (!["http:", "https:"].includes(internal.protocol) || internal.username || internal.password) {
    throw new Error("API_BASE_URL must be an HTTP(S) address without credentials");
  }
  const internalClients = new URL("/clients", internal).toString();
  if (env.APP_ORIGIN === undefined) {
    return { internalClients, browserClients: internalClients, browserAuthOrigin: internal.origin };
  }
  const invalidOrigin = "APP_ORIGIN must be an HTTPS origin without credentials or a path";
  let publicUrl: URL;
  try {
    publicUrl = new URL(env.APP_ORIGIN);
  } catch {
    throw new Error(invalidOrigin);
  }
  if (publicUrl.protocol !== "https:" ||
      (env.APP_ORIGIN !== publicUrl.origin && env.APP_ORIGIN !== `${publicUrl.origin}/`)) {
    throw new Error(invalidOrigin);
  }
  return {
    internalClients,
    browserClients: `${publicUrl.origin}/api/clients`,
    browserAuthOrigin: publicUrl.origin,
  };
}
