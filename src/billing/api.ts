import { accessToken } from "./auth.js";
import { functionsBaseUrl } from "./config.js";

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  return fetch(`${functionsBaseUrl()}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
