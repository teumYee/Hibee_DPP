// HTTP 클라이언트 — base URL은 이 파일에만 둠 (추후 .env로 교체)
import { useAuthStore } from "../../store/auth.store";

/** 개발 중에는 현재 PC의 로컬 IP를 사용한다. */
const BASE_URL = "http://10.240.107.4:8000";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

type QueryValue = string | number | boolean | undefined | null;

function joinPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${p}`;
}

function withQuery(path: string, query?: Record<string, QueryValue>): string {
  const url = joinPath(path);
  if (!query) return url;
  const segments: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    segments.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  if (segments.length === 0) return url;
  return `${url}?${segments.join("&")}`;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options?: {
    body?: unknown;
    query?: Record<string, QueryValue>;
  },
): Promise<T> {
  const url = withQuery(path, options?.query);
  const token = useAuthStore.getState().token;
  const authHeader =
    typeof token === "string" && token.trim().length > 0
      ? `Bearer ${token.trim()}`
      : null;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  /** postUsageLogs·get·post 등 전부 이 경로 — domain API에서 헤더 중복 불필요 */
  if (authHeader != null) {
    headers.Authorization = authHeader;
  }

  const response = await fetch(url, {
    method,
    headers,
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new HttpError(response.status, response.statusText, errBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(
      response.status,
      response.statusText,
      `Invalid JSON: ${text.slice(0, 200)}`,
    );
  }
}

export async function get<T>(
  path: string,
  query?: Record<string, QueryValue>,
): Promise<T> {
  return request<T>("GET", path, { query });
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, { body });
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, { body });
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, { body });
}

export async function del<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
