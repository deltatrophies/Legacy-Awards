const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;
let accessToken = sessionStorage.getItem("legacyAccessToken") || "";
let refreshPromise;
const authRoutesWithoutRefresh = new Set(["/auth/register", "/auth/login", "/auth/refresh", "/auth/logout"]);

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function setAccessToken(token) {
  accessToken = token || "";
  if (token) sessionStorage.setItem("legacyAccessToken", token);
  else sessionStorage.removeItem("legacyAccessToken");
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session refresh failed");
        const payload = await response.json();
        setAccessToken(payload.data.accessToken);
        return payload.data;
      })
      .finally(() => { refreshPromise = undefined; });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}, allowRefresh = true) {
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  if (options.body && !isForm) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && allowRefresh && !authRoutesWithoutRefresh.has(path)) {
    try {
      await refreshSession();
      return apiRequest(path, options, false);
    } catch {
      setAccessToken("");
    }
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error?.message || "The request could not be completed", response.status, payload?.error?.code, payload?.error?.details);
  }
  return payload.data;
}

export const authApi = {
  async restore() {
    const data = await refreshSession();
    return data.user;
  },
  async register(input) {
    const data = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(input) }, false);
    setAccessToken(data.accessToken);
    return data.user;
  },
  async login(input) {
    const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(input) }, false);
    setAccessToken(data.accessToken);
    return data.user;
  },
  updateProfile: (input) => apiRequest("/auth/me", { method: "PATCH", body: JSON.stringify(input) }),
  updateAvatar(file) {
    const body = new FormData();
    body.append("file", file);
    return apiRequest("/auth/me/avatar", { method: "PATCH", body });
  },
  async logout() {
    await apiRequest("/auth/logout", { method: "POST" }, false);
    setAccessToken("");
  },
};

export const catalogApi = {
  list: () => apiRequest("/products?limit=100"),
  get: (slug) => apiRequest(`/products/${encodeURIComponent(slug)}`),
};

export const quoteApi = {
  create: (input) => apiRequest("/quotes", { method: "POST", body: JSON.stringify(input) }),
};

export async function uploadArtwork(file) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest("/uploads/image", { method: "POST", body });
}

export async function submitInquiry(formData) {
  return apiRequest("/inquiries", { method: "POST", body: formData }, false);
}

export const legacyApi = { submitInquiry };
