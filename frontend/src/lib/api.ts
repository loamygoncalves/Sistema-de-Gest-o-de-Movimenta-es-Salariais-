import { ApiErrorBody } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
const TOKEN_KEY = "sgms.token";

export class ApiError extends Error {
  statusCode: number;
  error?: string;

  constructor(body: ApiErrorBody, statusCode: number) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message || "Erro inesperado";
    super(message);
    this.statusCode = statusCode;
    this.error = body.error;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = new URL(
    path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`
  );
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

function handleUnauthorized() {
  setToken(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("sgms.user");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, unknown>;
  // When true, skips JSON.stringify / Content-Type (used for FormData bodies)
  isFormData?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, isFormData, headers, body, ...rest } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(headers as Record<string, string>),
  };
  if (token) {
    finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, params), {
    ...rest,
    headers: finalHeaders,
    body: body as BodyInit | undefined,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError({ statusCode: 401, message: "Sessão expirada. Faça login novamente." }, 401);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let body: ApiErrorBody = { statusCode: res.status, message: res.statusText };
    if (contentType.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        // ignore parse errors, fall back to statusText
      }
    }
    throw new ApiError(body, res.status);
  }

  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return undefined as unknown as T;
}

export const api = {
  get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, { method: "GET", params });
  },
  post<T>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, {
      method: "POST",
      params,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },
  patch<T>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      params,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },
  delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, { method: "DELETE", params });
  },
  upload<T>(path: string, formData: FormData, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, {
      method: "POST",
      params,
      body: formData,
      isFormData: true,
    });
  },
  /**
   * Downloads a binary/file response (e.g. GET /history/export) and triggers
   * a browser save via a temporary object URL.
   */
  async download(path: string, params: Record<string, unknown> | undefined, filename: string): Promise<void> {
    const token = getToken();
    const res = await fetch(buildUrl(path, params), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new ApiError({ statusCode: 401, message: "Sessão expirada." }, 401);
    }
    if (!res.ok) {
      throw new ApiError({ statusCode: res.status, message: "Falha ao exportar arquivo." }, res.status);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export { API_URL };
