const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;
export const CATALOG_CHANGED_EVENT = "legacy-catalog-changed";
export const CATALOG_CHANGED_STORAGE_KEY = "legacyCatalogChangedAt";
export const ORDER_STATUS_CHANGED_EVENT = "legacy-order-status-changed";
export const ORDER_STATUS_CHANGED_STORAGE_KEY = "legacyOrderStatusChangedAt";
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

function notifyCatalogChanged() {
  const changedAt = String(Date.now());
  localStorage.setItem(CATALOG_CHANGED_STORAGE_KEY, changedAt);
  window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT, { detail: { changedAt } }));
}

function notifyOrderStatusChanged() {
  const changedAt = String(Date.now());
  localStorage.setItem(ORDER_STATUS_CHANGED_STORAGE_KEY, changedAt);
  window.dispatchEvent(new CustomEvent(ORDER_STATUS_CHANGED_EVENT, { detail: { changedAt } }));
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
  adminList: () => apiRequest("/products?limit=200&includeInactive=true"),
  async create(input) {
    const product = await apiRequest("/products", { method: "POST", body: JSON.stringify(input) });
    notifyCatalogChanged();
    return product;
  },
  async update(slug, input) {
    const product = await apiRequest(`/products/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(input) });
    notifyCatalogChanged();
    return product;
  },
  async remove(slug) {
    const result = await apiRequest(`/products/${encodeURIComponent(slug)}`, { method: "DELETE" });
    notifyCatalogChanged();
    return result;
  },
};

export const categoryApi = {
  list: () => apiRequest("/categories"),
  adminList: () => apiRequest("/categories?includeInactive=true"),
  create: (input) => apiRequest("/categories", { method: "POST", body: JSON.stringify(input) }),
  update: (slug, input) => apiRequest(`/categories/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (slug) => apiRequest(`/categories/${encodeURIComponent(slug)}`, { method: "DELETE" }),
};

export const quoteApi = {
  create: (input) => apiRequest("/quotes", { method: "POST", body: JSON.stringify(input) }),
  mine: () => apiRequest("/quotes/mine?limit=100"),
  public: (reference, accessToken) => apiRequest(`/quotes/public/${encodeURIComponent(reference)}`, { headers: { "x-quote-token": accessToken || "" } }, false),
};

export const orderApi = {
  mine: () => apiRequest("/orders/mine?limit=100"),
};

export const adminApi = {
  summary: () => apiRequest("/admin/summary"),
  listInquiries: () => apiRequest("/inquiries?limit=100"),
  updateInquiry: (id, input) => apiRequest(`/inquiries/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  listQuotes: () => apiRequest("/quotes?limit=100"),
  async updateQuote(id, input) {
    const quote = await apiRequest(`/quotes/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify(input) });
    notifyOrderStatusChanged();
    return quote;
  },
  listOrders: () => apiRequest("/orders?limit=100"),
  async updateOrder(id, input) {
    const order = await apiRequest(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
    notifyOrderStatusChanged();
    return order;
  },
  getSettings: () => apiRequest("/settings"),
  updateSettings: (input) => apiRequest("/settings", { method: "PATCH", body: JSON.stringify(input) }),
};

export const settingsApi = {
  get: () => apiRequest("/settings"),
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
