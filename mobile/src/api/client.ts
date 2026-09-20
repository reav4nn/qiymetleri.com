import { fetch } from "expo/fetch";

const fallbackApiUrl = "https://qiymetleri.onrender.com";
export const API_REQUEST_TIMEOUT_MS = 8_000;

export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ResourceNotFoundError extends ApiError {
  constructor() {
    super("Resource not found", 404, "HTTP_ERROR");
    this.name = "ResourceNotFoundError";
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new ResourceNotFoundError();
    }
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, response.status, "HTTP_ERROR");
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("Invalid JSON response", response.status, "INVALID_RESPONSE");
    }
  } catch (error) {
    if (timedOut) {
      throw new ApiError("Network request timed out", 0, "NETWORK_ERROR");
    }
    if (error instanceof ApiError || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function buildQuery(
  values: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
