import "server-only";
import { readApiUrls } from "./api-urls";

function apiUrls() {
  return readApiUrls({ API_BASE_URL: process.env.API_BASE_URL, APP_ORIGIN: process.env.APP_ORIGIN });
}

export function getClientsUrl(): string {
  return apiUrls().internalClients;
}

export function getBrowserClientsUrl(): string {
  return apiUrls().browserClients;
}

export function getBrowserApiOrigin(): string {
  return apiUrls().browserAuthOrigin;
}
