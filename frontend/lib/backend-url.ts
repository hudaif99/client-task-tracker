import "server-only";

export function getClientsUrl(): string {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing API_BASE_URL");
  }

  const url = new URL("/clients", baseUrl);

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username || url.password
  ) {
    throw new Error("API_BASE_URL must be an HTTP(S) address without credentials");
  }

  return url.toString();
}

