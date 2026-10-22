export const localDeploymentOptions = {
  authOrigin: "http://127.0.0.1:4000",
  frontendOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  trustedAuthOrigins: ["http://127.0.0.1:3000"],
  trustLoopbackProxy: false,
};

export type DeploymentOptions = typeof localDeploymentOptions;

export function readDeploymentOptions(env: NodeJS.ProcessEnv): DeploymentOptions {
  const value = env.BETTER_AUTH_URL;
  const invalidUrl = "Set BETTER_AUTH_URL to http://127.0.0.1:4000 or an HTTPS origin without a path.";
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(invalidUrl);
  }
  if ((value !== url.origin && value !== `${url.origin}/`) ||
      (url.origin !== localDeploymentOptions.authOrigin && url.protocol !== "https:")) {
    throw new Error(invalidUrl);
  }
  if (env.TRUST_LOOPBACK_PROXY !== undefined &&
      env.TRUST_LOOPBACK_PROXY !== "true" && env.TRUST_LOOPBACK_PROXY !== "false") {
    throw new Error("TRUST_LOOPBACK_PROXY must be true or false.");
  }
  const local = url.origin === localDeploymentOptions.authOrigin;
  return {
    authOrigin: url.origin,
    frontendOrigins: local ? [...localDeploymentOptions.frontendOrigins] : [url.origin],
    trustedAuthOrigins: local ? [...localDeploymentOptions.trustedAuthOrigins] : [url.origin],
    trustLoopbackProxy: env.TRUST_LOOPBACK_PROXY === "true",
  };
}
