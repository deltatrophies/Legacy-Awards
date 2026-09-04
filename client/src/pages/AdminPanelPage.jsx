import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { adminApi, catalogApi, categoryApi, uploadProductImage } from "../services/apiClient.js";
import { squareThumbnail } from "../utils/cloudinaryImage.js";
import "../styles/pages/admin.css";

const productTemplate = {
  slug: "",
  sku: "",
  name: "",
  category: "trophies",
  price: "",
  tag: "",
  description: "",
  badge: "",
  imageUrls: "",
  material: "",
  size: "",
  delivery: "",
  useCase: "",
  minOrder: 1,
  isActive: true,
};

const categoryTemplate = {
  slug: "",
  name: "",
  description: "",
  imageUrl: "",
  sortOrder: 0,
  isActive: true,
};

const couponTemplate = {
  code: "",
  type: "percentage",
  value: "",
  minimumSubtotal: 0,
  maximumDiscount: "",
  active: true,
  startsAt: "",
  expiresAt: "",
};

const settingsTemplate = {
  businessName: "Legacy Awards",
  email: "orders@legacyawards.in",
  phone: "",
  whatsapp: "91XXXXXXXXXX",
  address: "B-14, Okhla Phase II, New Delhi - 110020",
  timings: "Mon-Sat, 10:00 AM - 7:00 PM",
  mapUrl: "",
  instagramUrl: "",
  facebookUrl: "",
};

const sections = [
  ["dashboard", "Dashboard"],
  ["products", "Products"],
  ["categories", "Categories"],
  ["coupons", "Coupons"],
  ["inquiries", "Inquiries"],
  ["orders", "Orders"],
  ["settings", "Settings"],
];

const inquiryStatuses = ["new", "contacted", "qualified", "closed", "spam"];
const orderStatuses = ["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"];
const quoteStatuses = ["submitted", "reviewing", "quoted", "accepted", "expired", "cancelled"];
const adminProductPageSize = 50;

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatMoney(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getId(item) {
  return item?._id || item?.id || item?.databaseId;
}

function customerContactNumber(value, defaultCountryCode = "91") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `${defaultCountryCode}${digits}` : digits;
}

function customerWhatsAppUrl(customer, reference) {
  const number = customerContactNumber(customer?.phone);
  if (!number) return "";
  const message = `Hi ${customer?.name || "there"}, this is Legacy Awards regarding quotation ${reference}. We are ready to help with your payment and next steps.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function AdminGuard({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) return <main className="admin-loading">Loading admin...</main>;
  if (!user || user.role !== "admin") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export { AdminGuard };

export default function AdminPanelPage() {
  const { section = "dashboard", detailType, detailId } = useParams();
  const activeSection = sections.some(([key]) => key === section) ? section : "dashboard";
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [settings, setSettings] = useState(settingsTemplate);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const categoryOptions = useMemo(() => (
    categories.length ? categories.filter((item) => item.isActive !== false) : [{ slug: "trophies", name: "Trophies" }]
  ), [categories]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, categoryData, inquiryData, quoteData, orderData, couponData, settingsData] = await Promise.all([
        adminApi.summary(),
        categoryApi.adminList(),
        adminApi.listInquiries(),
        adminApi.listQuotes(),
        adminApi.listOrders(),
        adminApi.listCoupons(),
        adminApi.getSettings(),
      ]);
      setSummary(summaryData);
      setCategories(categoryData || []);
      setInquiries(inquiryData || []);
      setQuotes(quoteData || []);
      setOrders(orderData || []);
      setCoupons(couponData || []);
      setSettings({ ...settingsTemplate, ...(settingsData || {}) });
    } catch (requestError) {
      setError(requestError.message || "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = `Admin ${sections.find(([key]) => key === activeSection)?.[1]} - Legacy Awards`;
  }, [activeSection]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (activeSection !== "orders") return undefined;
    let active = true;
    let refreshing = false;
    const refreshOrderPipeline = async () => {
      if (refreshing || document.hidden) return;
      refreshing = true;
      try {
        const [quoteData, orderData] = await Promise.all([adminApi.listQuotes(), adminApi.listOrders()]);
        if (active) {
          setQuotes(quoteData || []);
          setOrders(orderData || []);
        }
      } catch {
        // The regular refresh button remains available if a background refresh fails.
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(refreshOrderPipeline, 5000);
    window.addEventListener("focus", refreshOrderPipeline);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOrderPipeline);
    };
  }, [activeSection]);

  const announce = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const fail = (requestError) => {
    setError(requestError.message || "The action could not be completed.");
  };

  return (
    <AdminGuard>
      <main className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="admin-brand" to="/admin/dashboard">Legacy Admin</Link>
          <nav className="admin-nav" aria-label="Admin sections">
            {sections.map(([key, label]) => (
              <NavLink key={key} to={`/admin/${key}`} className={({ isActive }) => isActive || activeSection === key ? "active" : ""}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="admin-user-box">
            <span>{user.firstName} {user.lastName}</span>
            <small>{user.email}</small>
            <button type="button" onClick={logout}>Logout</button>
          </div>
        </aside>

        <section className="admin-main">
          <header className="admin-topbar">
            <div>
              <p className="admin-eyebrow">Admin panel</p>
              <h1>{sections.find(([key]) => key === activeSection)?.[1]}</h1>
            </div>
            <button className="admin-secondary-button" type="button" onClick={refreshAll}>Refresh</button>
          </header>

          {notice || error ? (
            <div className="admin-toast-stack" aria-live="polite">
              {notice ? <p className="admin-alert admin-alert-success" role="status">{notice}</p> : null}
              {error ? <p className="admin-alert admin-alert-error" role="alert">{error}</p> : null}
            </div>
          ) : null}
          {loading ? <div className="admin-empty">Loading admin data...</div> : null}

          {!loading && activeSection === "dashboard" ? <Dashboard summary={summary} /> : null}
          {!loading && activeSection === "products" ? (
            <ProductManager
              categories={categoryOptions}
              onError={fail}
              onSaved={() => { announce("Product saved."); refreshAll(); }}
            />
          ) : null}
          {!loading && activeSection === "categories" ? (
            <CategoryManager
              categories={categories}
              onError={fail}
              onSaved={() => { announce("Category saved."); refreshAll(); }}
            />
          ) : null}
          {!loading && activeSection === "coupons" ? (
            <CouponManager
              coupons={coupons}
              onError={fail}
              onSaved={() => { announce("Coupon saved."); refreshAll(); }}
            />
          ) : null}
          {!loading && activeSection === "inquiries" ? (
            <InquiryManager
              detailId={detailId}
              detailType={detailType}
              inquiries={inquiries}
              onError={fail}
              onUpdated={() => { announce("Inquiry updated."); refreshAll(); }}
            />
          ) : null}
          {!loading && activeSection === "orders" ? (
            <OrderManager
              onError={fail}
              onUpdated={() => { announce("Order updated."); refreshAll(); }}
              detailId={detailId}
              detailType={detailType}
              orders={orders}
              quotes={quotes}
            />
          ) : null}
          {!loading && activeSection === "settings" ? (
            <SettingsManager
              onError={fail}
              onSaved={(nextSettings) => { setSettings(nextSettings); announce("Settings saved."); }}
              settings={settings}
            />
          ) : null}
        </section>
      </main>
    </AdminGuard>
  );
}

function Dashboard({ summary }) {
  const counts = summary?.counts || {};
  const cards = [
    ["Active products", counts.activeProducts || 0],
    ["Total products", counts.totalProducts || 0],
    ["Categories", counts.totalCategories || 0],
    ["New inquiries", counts.newInquiries || 0],
    ["Pending orders", counts.pendingOrders || 0],
    ["Total orders", counts.totalOrders || 0],
  ];

  return (
    <div className="admin-dashboard">
      <section className="admin-metric-grid">
        {cards.map(([label, value]) => (
          <article className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="admin-two-column">
        <RecentList title="Recent inquiries" rows={summary?.recentInquiries || []} type="inquiry" />
        <RecentList title="Recent orders" rows={summary?.recentOrders || []} type="order" />
      </section>
    </div>
  );
}

function RecentList({ rows, title, type }) {
  return (
    <article className="admin-panel">
      <h2>{title}</h2>
      {rows.length ? rows.map((row) => (
        <div className="admin-recent-row" key={getId(row)}>
          <div>
            <strong>{type === "order" ? row.reference : row.name}</strong>
            <span>{type === "order" ? row.fulfillmentStatus : row.status}</span>
          </div>
          <small>{formatDate(row.createdAt)}</small>
        </div>
      )) : <p className="admin-muted">No records yet.</p>}
    </article>
  );
}

function ProductManager({ categories, onSaved, onError }) {
  const [form, setForm] = useState(productTemplate);
  const [editingSlug, setEditingSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEditSlug, setLoadingEditSlug] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [activeView, setActiveView] = useState("list");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listMeta, setListMeta] = useState({
    page: 1,
    pages: 1,
    total: 0,
    activeTotal: 0,
    categoryCounts: {},
  });
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.slug || category.id, category.name])), [categories]);

  useEffect(() => {
    let active = true;
    setListLoading(true);
    catalogApi.adminList({ page, limit: adminProductPageSize, category: categoryFilter })
      .then((result) => {
        if (!active) return;
        setProducts(result.data || []);
        setListMeta((current) => ({ ...current, ...(result.meta || {}) }));
      })
      .catch((requestError) => {
        if (active) onError(requestError);
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => { active = false; };
  }, [categoryFilter, page]);

  const groupedProducts = useMemo(() => {
    const groups = new Map();
    products.forEach((product) => {
      const key = product.category || "uncategorized";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: categoryNames.get(key) || key.replaceAll("-", " "),
          products: [],
        });
      }
      groups.get(key).products.push(product);
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        products: group.products.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryNames, products]);
  const categoryFilters = useMemo(() => {
    const counts = listMeta.categoryCounts || {};
    const allCount = Object.values(counts).reduce((sum, item) => sum + (item.total || 0), 0);
    const knownKeys = new Set(categories.map((category) => category.slug || category.id));
    const known = categories
      .map((category) => {
        const key = category.slug || category.id;
        return { key, name: category.name, count: counts[key]?.total || 0 };
      })
      .filter((category) => category.count > 0);
    const unknown = Object.entries(counts)
      .filter(([key, item]) => !knownKeys.has(key) && item.total > 0)
      .map(([key, item]) => ({ key, name: key.replaceAll("-", " "), count: item.total }));
    return [{ key: "all", name: "All", count: allCount }, ...known, ...unknown];
  }, [categories, listMeta.categoryCounts]);
  const visibleGroups = groupedProducts;
  const activeCount = listMeta.activeTotal || 0;

  const selectCategory = (key) => {
    setCategoryFilter(key);
    setPage(1);
  };

  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "name" && !editingSlug) next.slug = slugify(value);
    return next;
  });

  const imageUrls = useMemo(() => form.imageUrls.split("\n").map((url) => url.trim()).filter(Boolean).slice(0, 4), [form.imageUrls]);

  const setImageUrls = (urls) => set("imageUrls", urls.filter(Boolean).slice(0, 4).join("\n"));

  const editProduct = async (summaryProduct) => {
    const slug = summaryProduct.id || summaryProduct.slug;
    setLoadingEditSlug(slug);
    try {
      const product = await catalogApi.get(slug);
      setEditingSlug(slug);
      setForm({
        ...productTemplate,
        slug,
        sku: product.sku || "",
        name: product.name || "",
        category: product.category || categories[0]?.slug || "trophies",
        price: product.price || "",
        tag: product.tag || "",
        description: product.description || "",
        badge: product.badge || "",
        imageUrls: (product.images?.length ? product.images.map((image) => image.url) : [product.image]).filter(Boolean).join("\n"),
        material: product.material || "",
        size: product.size || "",
        delivery: product.delivery || "",
        useCase: product.useCase || "",
        minOrder: product.minOrder || 1,
        isActive: product.isActive !== false,
      });
      setActiveView("form");
    } catch (requestError) {
      onError(requestError);
    } finally {
      setLoadingEditSlug("");
    }
  };

  const reset = () => {
    setEditingSlug("");
    setForm(productTemplate);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        minOrder: Number(form.minOrder || 1),
        images: imageUrls.map((url) => ({ url, alt: form.name })),
      };
      delete payload.imageUrls;
      if (editingSlug) await catalogApi.update(editingSlug, payload);
      else await catalogApi.create(payload);
      reset();
      onSaved();
      setActiveView("list");
    } catch (requestError) {
      onError(requestError);
    } finally {
      setSaving(false);
    }
  };

  const archive = async (product) => {
    try {
      await catalogApi.remove(product.id || product.slug);
      onSaved();
    } catch (requestError) {
      onError(requestError);
    }
  };

  const uploadImages = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    const availableSlots = Math.max(4 - imageUrls.length, 0);
    if (!availableSlots) {
      onError(new Error("Maximum 4 product images are allowed."));
      return;
    }
    setUploadingImages(true);
    try {
      const uploads = await Promise.all(selectedFiles.slice(0, availableSlots).map((file) => uploadProductImage(file)));
      setImageUrls([...imageUrls, ...uploads.map((item) => item.url)]);
    } catch (requestError) {
      onError(requestError);
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (url) => setImageUrls(imageUrls.filter((item) => item !== url));

  const restore = async (product) => {
    try {
      await catalogApi.restore(product.id || product.slug);
      onSaved();
    } catch (requestError) {
      onError(requestError);
    }
  };

  return (
    <section className="admin-product-workspace">
      <div className="admin-product-switcher" role="tablist" aria-label="Product manager views">
        <button type="button" className={activeView === "list" ? "active" : ""} onClick={() => setActiveView("list")}>Product List</button>
        <button type="button" className={activeView === "form" ? "active" : ""} onClick={() => setActiveView("form")}>{editingSlug ? "Edit Product" : "Add Product"}</button>
      </div>

      {activeView === "form" ? <form className="admin-form-panel admin-product-form" onSubmit={submit}>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Catalog item</p>
            <h2>{editingSlug ? "Edit product" : "Add product"}</h2>
          </div>
          <span className={`admin-status-pill ${form.isActive ? "is-active" : "is-inactive"}`}>{form.isActive ? "Active" : "Inactive"}</span>
        </div>

        <div className="admin-form-section">
          <h3>Identity</h3>
          <div className="admin-form-grid">
            <Field label="Name"><input required value={form.name} onChange={(event) => set("name", event.target.value)} /></Field>
            <Field label="Category">
              <select required value={form.category} onChange={(event) => set("category", event.target.value)}>
                {categories.map((category) => <option key={category.slug || category.id} value={category.slug || category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Slug"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => set("slug", event.target.value)} /></Field>
            <Field label="SKU"><input required value={form.sku} onChange={(event) => set("sku", event.target.value.toUpperCase())} /></Field>
          </div>
        </div>

        <div className="admin-form-section">
          <h3>Pricing and specs</h3>
          <div className="admin-form-grid">
            <Field label="Price"><input min="0" required type="number" value={form.price} onChange={(event) => set("price", event.target.value)} /></Field>
            <Field label="Minimum order"><input min="1" required type="number" value={form.minOrder} onChange={(event) => set("minOrder", event.target.value)} /></Field>
            <Field label="Material"><input value={form.material} onChange={(event) => set("material", event.target.value)} /></Field>
            <Field label="Size"><input value={form.size} onChange={(event) => set("size", event.target.value)} /></Field>
            <Field label="Delivery"><input value={form.delivery} onChange={(event) => set("delivery", event.target.value)} /></Field>
            <Field label="Use case"><input value={form.useCase} onChange={(event) => set("useCase", event.target.value)} /></Field>
          </div>
        </div>

        <div className="admin-form-section">
          <h3>Description and media</h3>
          <div className="admin-form-grid">
            <Field label="Tag"><input value={form.tag} onChange={(event) => set("tag", event.target.value)} /></Field>
            <Field label="Badge"><input value={form.badge} onChange={(event) => set("badge", event.target.value)} /></Field>
          </div>
          <Field label="Description"><textarea required rows="4" value={form.description} onChange={(event) => set("description", event.target.value)} /></Field>
          <Field label="Image URLs"><textarea rows="3" value={form.imageUrls} onChange={(event) => setImageUrls(event.target.value.split("\n"))} placeholder="/images/example.jpg" /></Field>
          <div className="admin-product-images">
            <div className="admin-product-upload-head">
              <span>{imageUrls.length}/4 images</span>
              <label>
                {uploadingImages ? "Uploading..." : "Upload images"}
                <input accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploadingImages || imageUrls.length >= 4} multiple type="file" onChange={(event) => { uploadImages(event.target.files); event.target.value = ""; }} />
              </label>
            </div>
            <div className="admin-product-image-grid">
              {imageUrls.length ? imageUrls.map((url, index) => (
                <figure key={url}>
                  <img src={url} alt="" />
                  <figcaption>{index === 0 ? "Main image" : `Image ${index + 1}`}</figcaption>
                  <button type="button" onClick={() => removeImage(url)}>Remove</button>
                </figure>
              )) : <p className="admin-muted">Upload or paste up to 4 product images. First image is used as the main catalogue image.</p>}
            </div>
          </div>
        </div>

        <label className="admin-check"><input checked={form.isActive} type="checkbox" onChange={(event) => set("isActive", event.target.checked)} /> Active product</label>
        <div className="admin-button-row">
          <button className="admin-primary-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save product"}</button>
          <button className="admin-secondary-button" type="button" onClick={reset}>Clear</button>
        </div>
      </form> : null}

      {activeView === "list" ? <div className="admin-product-list-panel">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Category view</p>
            <h2>Product list</h2>
          </div>
          <div className="admin-list-stats">
            <span><strong>{listMeta.total || 0}</strong> Total</span>
            <span><strong>{activeCount}</strong> Active</span>
          </div>
        </div>

        <div className="admin-category-toggle" aria-label="Filter products by category">
          {categoryFilters.map((category) => (
            <button type="button" className={categoryFilter === category.key ? "active" : ""} key={category.key} onClick={() => selectCategory(category.key)}>
              <span>{category.name}</span>
              <strong>{category.count}</strong>
            </button>
          ))}
        </div>

        {listLoading ? <p className="admin-empty">Loading products...</p> : visibleGroups.length ? visibleGroups.map((group) => {
          const groupStats = listMeta.categoryCounts?.[group.key];
          const groupTotal = groupStats?.total || group.products.length;
          const groupActive = groupStats?.active ?? group.products.filter((product) => product.isActive !== false).length;
          return (
            <section className="admin-category-group" key={group.key}>
              <header className="admin-category-head">
                <div>
                  <h3>{group.name}</h3>
                  <span>{group.key}</span>
                </div>
                <div className="admin-category-count">
                  <strong>{groupTotal}</strong>
                  <span>{groupActive} active</span>
                </div>
              </header>
              <div className="admin-product-stack">
                {group.products.map((product) => (
                  <article className="admin-product-row" key={product.id || product.slug}>
                    <div className="admin-product-thumb">
                      {product.image ? (
                        <img
                          src={squareThumbnail(product.image, 112)}
                          alt=""
                          width="56"
                          height="56"
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                        />
                      ) : <span>{product.name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="admin-product-main">
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.sku || product.id || product.slug}</small>
                      </div>
                      <div className="admin-product-meta">
                        <span>{formatMoney(product.price)}</span>
                        <span>Min {product.minOrder || 1}</span>
                        <span>{product.material || "No material"}</span>
                      </div>
                    </div>
                    <span className={`admin-status-pill ${product.isActive === false ? "is-inactive" : "is-active"}`}>{product.isActive === false ? "Inactive" : "Active"}</span>
                    <div className="admin-row-actions">
                      <button disabled={loadingEditSlug === (product.id || product.slug)} type="button" onClick={() => editProduct(product)}>
                        {loadingEditSlug === (product.id || product.slug) ? "Loading..." : "Edit"}
                      </button>
                      {product.isActive === false
                        ? <button type="button" onClick={() => restore(product)}>Restore</button>
                        : <button type="button" onClick={() => archive(product)}>Archive</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        }) : <p className="admin-empty">No products found.</p>}

        {!listLoading && listMeta.pages > 1 ? (
          <nav className="admin-product-pagination" aria-label="Product list pages">
            <button disabled={page <= 1} type="button" onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span>Page <strong>{listMeta.page || page}</strong> of <strong>{listMeta.pages}</strong></span>
            <button disabled={page >= listMeta.pages} type="button" onClick={() => setPage((current) => Math.min(listMeta.pages, current + 1))}>Next</button>
          </nav>
        ) : null}
      </div> : null}
    </section>
  );
}

function CategoryManager({ categories, onSaved, onError }) {
  const [form, setForm] = useState(categoryTemplate);
  const [editingSlug, setEditingSlug] = useState("");
  const [activeView, setActiveView] = useState("list");
  const activeCount = categories.filter((category) => category.isActive !== false).length;
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => {
    const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    return orderDiff || a.name.localeCompare(b.name);
  }), [categories]);

  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "name" && !editingSlug) next.slug = slugify(value);
    return next;
  });

  const submit = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder || 0) };
      if (editingSlug) await categoryApi.update(editingSlug, payload);
      else await categoryApi.create(payload);
      setForm(categoryTemplate);
      setEditingSlug("");
      onSaved();
      setActiveView("list");
    } catch (requestError) {
      onError(requestError);
    }
  };

  const edit = (category) => {
    setEditingSlug(category.slug);
    setForm({ ...categoryTemplate, ...category });
    setActiveView("form");
  };

  const archive = async (category) => {
    try {
      await categoryApi.remove(category.slug);
      onSaved();
    } catch (requestError) {
      onError(requestError);
    }
  };

  const restore = async (category) => {
    try {
      await categoryApi.restore(category.slug);
      onSaved();
    } catch (requestError) {
      onError(requestError);
    }
  };

  return (
    <section className="admin-category-workspace">
      <div className="admin-product-switcher" role="tablist" aria-label="Category manager views">
        <button type="button" className={activeView === "list" ? "active" : ""} onClick={() => setActiveView("list")}>Category List</button>
        <button type="button" className={activeView === "form" ? "active" : ""} onClick={() => setActiveView("form")}>{editingSlug ? "Edit Category" : "Add Category"}</button>
      </div>

      {activeView === "form" ? <form className="admin-form-panel admin-category-form" onSubmit={submit}>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Catalog group</p>
            <h2>{editingSlug ? "Edit category" : "Add category"}</h2>
          </div>
          <span className={`admin-status-pill ${form.isActive ? "is-active" : "is-inactive"}`}>{form.isActive ? "Active" : "Inactive"}</span>
        </div>

        <div className="admin-form-section">
          <h3>Category details</h3>
          <div className="admin-form-grid">
            <Field label="Name"><input required value={form.name} onChange={(event) => set("name", event.target.value)} /></Field>
            <Field label="Slug"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => set("slug", event.target.value)} /></Field>
            <Field label="Sort order"><input min="0" type="number" value={form.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} /></Field>
            <Field label="Image URL"><input value={form.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} /></Field>
          </div>
        </div>

        <div className="admin-form-section">
          <h3>Display copy</h3>
          <Field label="Description"><textarea rows="4" value={form.description} onChange={(event) => set("description", event.target.value)} /></Field>
        </div>

        <label className="admin-check"><input checked={form.isActive} type="checkbox" onChange={(event) => set("isActive", event.target.checked)} /> Active category</label>
        <div className="admin-button-row">
          <button className="admin-primary-button" type="submit">Save category</button>
          <button className="admin-secondary-button" type="button" onClick={() => { setEditingSlug(""); setForm(categoryTemplate); }}>Clear</button>
        </div>
      </form> : null}

      {activeView === "list" ? <div className="admin-category-list-panel">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Structured categories</p>
            <h2>Category list</h2>
          </div>
          <div className="admin-list-stats">
            <span><strong>{categories.length}</strong> Total</span>
            <span><strong>{activeCount}</strong> Active</span>
          </div>
        </div>

        <div className="admin-category-stack">
          {sortedCategories.length ? sortedCategories.map((category) => (
            <article className="admin-category-row" key={category.slug || category.id}>
              <div className="admin-category-thumb">
                {category.imageUrl ? <img src={category.imageUrl} alt="" /> : <span>{category.name.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="admin-category-main">
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.slug}</small>
                </div>
                <p>{category.description || "No description added."}</p>
                <div className="admin-product-meta">
                  <span>Order {Number(category.sortOrder || 0)}</span>
                </div>
              </div>
              <span className={`admin-status-pill ${category.isActive === false ? "is-inactive" : "is-active"}`}>{category.isActive === false ? "Inactive" : "Active"}</span>
              <div className="admin-row-actions">
                <button type="button" onClick={() => edit(category)}>Edit</button>
                {category.isActive === false
                  ? <button type="button" onClick={() => restore(category)}>Restore</button>
                  : <button type="button" onClick={() => archive(category)}>Archive</button>}
              </div>
            </article>
          )) : <p className="admin-empty">No categories found.</p>}
        </div>
      </div> : null}
    </section>
  );
}

function CouponManager({ coupons, onSaved, onError }) {
  const [form, setForm] = useState(couponTemplate);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const edit = (coupon) => {
    setEditingId(getId(coupon));
    setForm({
      ...couponTemplate,
      code: coupon.code || "",
      type: coupon.type || "percentage",
      value: coupon.value ?? "",
      minimumSubtotal: coupon.minimumSubtotal ?? 0,
      maximumDiscount: coupon.maximumDiscount ?? "",
      active: coupon.active !== false,
      startsAt: coupon.startsAt ? String(coupon.startsAt).slice(0, 10) : "",
      expiresAt: coupon.expiresAt ? String(coupon.expiresAt).slice(0, 10) : "",
    });
  };

  const reset = () => {
    setEditingId("");
    setForm(couponTemplate);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        value: Number(form.value),
        minimumSubtotal: Number(form.minimumSubtotal || 0),
        maximumDiscount: form.maximumDiscount === "" ? undefined : Number(form.maximumDiscount),
        startsAt: form.startsAt || undefined,
        expiresAt: form.expiresAt || undefined,
      };
      if (editingId) await adminApi.updateCoupon(editingId, payload);
      else await adminApi.createCoupon(payload);
      reset();
      onSaved();
    } catch (requestError) {
      onError(requestError);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon) => {
    try {
      await adminApi.updateCoupon(getId(coupon), { active: !coupon.active });
      onSaved();
    } catch (requestError) {
      onError(requestError);
    }
  };

  return (
    <section className="admin-coupon-workspace">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Discount control</p>
          <h2>Coupon dashboard</h2>
        </div>
        <div className="admin-list-stats">
          <span><strong>{coupons.length}</strong> Total</span>
          <span><strong>{coupons.filter((coupon) => coupon.active).length}</strong> Active</span>
        </div>
      </div>

      <div className="admin-two-column admin-coupon-layout">
        <form className="admin-form-panel" onSubmit={submit}>
          <h2>{editingId ? "Edit coupon" : "Add coupon"}</h2>
          <div className="admin-form-grid">
            <Field label="Code"><input required value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} /></Field>
            <Field label="Type"><select value={form.type} onChange={(event) => set("type", event.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></Field>
            <Field label={form.type === "percentage" ? "Value %" : "Value Rs."}><input min="0" required type="number" value={form.value} onChange={(event) => set("value", event.target.value)} /></Field>
            <Field label="Minimum subtotal"><input min="0" type="number" value={form.minimumSubtotal} onChange={(event) => set("minimumSubtotal", event.target.value)} /></Field>
            <Field label="Maximum discount"><input min="0" type="number" value={form.maximumDiscount} onChange={(event) => set("maximumDiscount", event.target.value)} placeholder="Optional" /></Field>
            <Field label="Starts"><input type="date" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} /></Field>
            <Field label="Expires"><input type="date" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} /></Field>
          </div>
          <label className="admin-check"><input checked={form.active} type="checkbox" onChange={(event) => set("active", event.target.checked)} /> Active coupon</label>
          <div className="admin-button-row">
            <button className="admin-primary-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save coupon"}</button>
            <button className="admin-secondary-button" type="button" onClick={reset}>Clear</button>
          </div>
        </form>

        <section className="admin-order-panel">
          {coupons.length ? (
            <div className="admin-coupon-stack">
              {coupons.map((coupon) => (
                <article className="admin-coupon-row" key={getId(coupon)}>
                  <div>
                    <strong>{coupon.code}</strong>
                    <small>{coupon.type === "percentage" ? `${coupon.value}% off` : `${formatMoney(coupon.value)} off`}</small>
                  </div>
                  <div>
                    <span>Min {formatMoney(coupon.minimumSubtotal)}</span>
                    <span>{coupon.maximumDiscount ? `Cap ${formatMoney(coupon.maximumDiscount)}` : "No cap"}</span>
                  </div>
                  <span className={`admin-status-pill ${coupon.active ? "is-active" : "is-inactive"}`}>{coupon.active ? "Active" : "Inactive"}</span>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => edit(coupon)}>Edit</button>
                    <button type="button" onClick={() => toggle(coupon)}>{coupon.active ? "Deactivate" : "Activate"}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="admin-empty">No coupons yet.</p>}
        </section>
      </div>
    </section>
  );
}

function InquiryManager({ inquiries, detailType, detailId, onUpdated, onError }) {
  const navigate = useNavigate();
  const [detailInquiry, setDetailInquiry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const decodedDetailId = detailId ? decodeURIComponent(detailId) : "";
  const listInquiry = detailType === "inquiry"
    ? inquiries.find((inquiry) => [getId(inquiry), inquiry.reference].includes(decodedDetailId))
    : null;
  const selectedInquiry = listInquiry || detailInquiry;

  useEffect(() => {
    if (detailType !== "inquiry" || !decodedDetailId || listInquiry) {
      setDetailInquiry(null);
      return undefined;
    }
    let mounted = true;
    setDetailLoading(true);
    adminApi.getInquiry(decodedDetailId)
      .then((data) => { if (mounted) setDetailInquiry(data); })
      .catch(onError)
      .finally(() => { if (mounted) setDetailLoading(false); });
    return () => { mounted = false; };
  }, [decodedDetailId, detailType, listInquiry, onError]);

  const updateStatus = async (inquiry, status) => {
    try {
      await adminApi.updateInquiry(getId(inquiry), { status });
      onUpdated();
    } catch (requestError) {
      onError(requestError);
    }
  };

  if (detailType) {
    if (detailLoading) {
      return (
        <section className="admin-order-workspace">
          <Link className="admin-back-link" to="/admin/inquiries">Back to inquiries</Link>
          <p className="admin-empty">Loading inquiry detail...</p>
        </section>
      );
    }
    if (!selectedInquiry) {
      return (
        <section className="admin-order-workspace">
          <Link className="admin-back-link" to="/admin/inquiries">Back to inquiries</Link>
          <p className="admin-empty">This inquiry detail could not be found.</p>
        </section>
      );
    }

    return (
      <InquiryDetail
        inquiry={selectedInquiry}
        onBack={() => navigate("/admin/inquiries")}
        onStatus={updateStatus}
      />
    );
  }

  return (
    <section className="admin-order-workspace">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Customer requests</p>
          <h2>Inquiry management</h2>
        </div>
        <div className="admin-list-stats">
          <span><strong>{inquiries.length}</strong> Total inquiries</span>
          <span><strong>{inquiries.filter((inquiry) => inquiry.status === "new").length}</strong> New</span>
        </div>
      </div>

      <section className="admin-order-panel">
        {inquiries.length ? (
          <div className="admin-order-stack">
            {inquiries.map((inquiry) => (
              <article className="admin-order-row admin-inquiry-row is-clickable" key={getId(inquiry) || inquiry.reference} onClick={() => navigate(`/admin/inquiries/inquiry/${encodeURIComponent(getId(inquiry) || inquiry.reference)}`)}>
                <div className="admin-order-main">
                  <strong>{inquiry.reference}</strong>
                  <small>{formatDate(inquiry.createdAt)}</small>
                </div>
                <div className="admin-order-customer">
                  <strong>{inquiry.name}</strong>
                  <small>{inquiry.email}{inquiry.phone ? ` - ${inquiry.phone}` : ""}</small>
                </div>
                <div className="admin-order-customer">
                  <strong>{inquiry.type}</strong>
                  <small>{inquiry.organization}{inquiry.quantity ? ` - Qty ${inquiry.quantity}` : ""}</small>
                </div>
                <select value={inquiry.status} onClick={(event) => event.stopPropagation()} onChange={(event) => updateStatus(inquiry, event.target.value)}>
                  {inquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </article>
            ))}
          </div>
        ) : <p className="admin-empty">No inquiries found.</p>}
      </section>
    </section>
  );
}

function InquiryDetail({ inquiry, onBack, onStatus }) {
  return (
    <section className="admin-order-detail">
      <button className="admin-secondary-button admin-detail-back" type="button" onClick={onBack}>Back to inquiries</button>

      <header className="admin-detail-hero">
        <div>
          <p className="admin-eyebrow">Inquiry request</p>
          <h2>{inquiry.reference}</h2>
          <span>{formatDate(inquiry.createdAt)}</span>
        </div>
        <div className="admin-detail-actions">
          <select value={inquiry.status} onChange={(event) => onStatus(inquiry, event.target.value)}>
            {inquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </header>

      <div className="admin-detail-grid">
        <section className="admin-detail-card">
          <h3>Customer</h3>
          <dl className="admin-detail-list">
            <div><dt>Name</dt><dd>{inquiry.name || "-"}</dd></div>
            <div><dt>Email</dt><dd>{inquiry.email || "-"}</dd></div>
            <div><dt>Phone</dt><dd>{inquiry.phone || "-"}</dd></div>
            <div><dt>Organization</dt><dd>{inquiry.organization || "-"}</dd></div>
          </dl>
        </section>

        <section className="admin-detail-card">
          <h3>Requirement</h3>
          <dl className="admin-detail-list">
            <div><dt>Type</dt><dd>{inquiry.type || "-"}</dd></div>
            <div><dt>Quantity</dt><dd>{inquiry.quantity || "-"}</dd></div>
            <div><dt>Event</dt><dd>{inquiry.event || "-"}</dd></div>
            <div><dt>Status</dt><dd>{inquiry.status || "-"}</dd></div>
          </dl>
        </section>
      </div>

      <section className="admin-detail-card">
        <h3>Message</h3>
        <p className="admin-detail-note">{inquiry.message || "No message added."}</p>
      </section>

      {inquiry.attachment?.url ? (
        <section className="admin-detail-card">
          <h3>Attachment</h3>
          <a className="admin-attachment-link" href={inquiry.attachment.url} target="_blank" rel="noreferrer">
            Open attached reference
          </a>
        </section>
      ) : null}
    </section>
  );
}

function OrderManager({ orders, quotes, detailType, detailId, onUpdated, onError }) {
  const [activeView, setActiveView] = useState("quotes");
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const navigate = useNavigate();
  const decodedDetailId = detailId ? decodeURIComponent(detailId) : "";
  const listQuote = detailType === "quote" ? quotes.find((quote) => [getId(quote), quote.reference].includes(decodedDetailId)) : null;
  const listOrder = detailType === "paid" ? orders.find((order) => [getId(order), order.reference].includes(decodedDetailId)) : null;
  const selectedQuote = listQuote || (detailType === "quote" ? detailRecord : null);
  const selectedOrder = listOrder || (detailType === "paid" ? detailRecord : null);

  useEffect(() => {
    if (!detailType || !decodedDetailId || listQuote || listOrder) {
      setDetailRecord(null);
      return undefined;
    }
    let mounted = true;
    setDetailLoading(true);
    const loader = detailType === "quote" ? adminApi.getQuote(decodedDetailId) : adminApi.getOrder(decodedDetailId);
    loader
      .then((data) => { if (mounted) setDetailRecord(data); })
      .catch(onError)
      .finally(() => { if (mounted) setDetailLoading(false); });
    return () => { mounted = false; };
  }, [decodedDetailId, detailType, listOrder, listQuote, onError]);

  const updateStatus = async (order, fulfillmentStatus) => {
    try {
      await adminApi.updateOrder(getId(order), { fulfillmentStatus });
      onUpdated();
    } catch (requestError) {
      onError(requestError);
    }
  };

  const updateQuoteStatus = async (quote, input) => {
    try {
      const updated = await adminApi.updateQuote(getId(quote), typeof input === "string" ? { status: input } : input);
      onUpdated();
      return updated;
    } catch (requestError) {
      onError(requestError);
      return null;
    }
  };

  if (detailType) {
    const record = detailType === "quote" ? selectedQuote : selectedOrder;
    if (detailLoading) {
      return (
        <section className="admin-order-workspace">
          <Link className="admin-back-link" to="/admin/orders">Back to orders</Link>
          <p className="admin-empty">Loading order detail...</p>
        </section>
      );
    }
    if (!record) {
      return (
        <section className="admin-order-workspace">
          <Link className="admin-back-link" to="/admin/orders">Back to orders</Link>
          <p className="admin-empty">This order detail could not be found.</p>
        </section>
      );
    }

    return (
      <OrderDetail
        kind={detailType}
        order={selectedOrder}
        quote={selectedQuote}
        onBack={() => navigate("/admin/orders")}
        onOrderStatus={updateStatus}
        onQuoteStatus={updateQuoteStatus}
      />
    );
  }

  return (
    <section className="admin-order-workspace">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Order pipeline</p>
          <h2>Quote requests and paid orders</h2>
        </div>
        <div className="admin-list-stats">
          <span><strong>{quotes.length}</strong> Quote requests</span>
          <span><strong>{orders.length}</strong> Paid orders</span>
        </div>
      </div>

      <div className="admin-order-switcher" role="tablist" aria-label="Order views">
        <button type="button" className={activeView === "quotes" ? "active" : ""} onClick={() => setActiveView("quotes")}>
          <span>Quote Requests</span>
          <strong>{quotes.length}</strong>
        </button>
        <button type="button" className={activeView === "paid" ? "active" : ""} onClick={() => setActiveView("paid")}>
          <span>Paid Orders</span>
          <strong>{orders.length}</strong>
        </button>
      </div>

      {activeView === "quotes" ? <section className="admin-order-panel">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">From cart submissions</p>
            <h2>Quote requests</h2>
          </div>
        </div>
        {quotes.length ? (
          <div className="admin-order-stack">
            {quotes.map((quote) => (
              <article className="admin-order-row is-clickable" key={quote.id || quote.reference} onClick={() => navigate(`/admin/orders/quote/${encodeURIComponent(getId(quote) || quote.reference)}`)}>
                <div className="admin-order-main">
                  <strong>{quote.reference}</strong>
                  <small>{formatDate(quote.createdAt)} · {quote.items?.length || 0} item{quote.items?.length === 1 ? "" : "s"}</small>
                  {quote.customerDecision && quote.customerDecision !== "pending" ? <span className={`admin-decision-label is-${quote.customerDecision}`}>{quote.customerDecision === "accepted" ? "Customer accepted" : "Sales contact requested"}</span> : null}
                </div>
                <div className="admin-order-customer">
                  <strong>{quote.customer?.name || "Customer"}</strong>
                  <small>{quote.customer?.phone || ""}{quote.customer?.email ? ` · ${quote.customer.email}` : ""}</small>
                </div>
                <div className="admin-order-total">{formatMoney(quote.total)}</div>
                <select value={quote.status} onClick={(event) => event.stopPropagation()} onChange={(event) => updateQuoteStatus(quote, event.target.value)}>
                  {quoteStatuses.filter((status) => status !== "accepted" || quote.status === "accepted").map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </article>
            ))}
          </div>
        ) : <p className="admin-empty">No quote requests yet.</p>}
      </section> : null}

      {activeView === "paid" ? <section className="admin-order-panel">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">After payment</p>
            <h2>Paid orders</h2>
          </div>
        </div>
        {orders.length ? (
          <div className="admin-order-stack">
            {orders.map((order) => (
              <article className="admin-order-row is-clickable" key={order._id || order.id || order.reference} onClick={() => navigate(`/admin/orders/paid/${encodeURIComponent(getId(order) || order.reference)}`)}>
                <div className="admin-order-main">
                  <strong>{order.reference}</strong>
                  <small>{formatDate(order.createdAt)} · {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"}</small>
                </div>
                <div className="admin-order-customer">
                  <strong>{order.customer?.name || order.customer?.email || "Customer"}</strong>
                  <small>{order.customer?.phone || ""}{order.customer?.email ? ` · ${order.customer.email}` : ""}</small>
                </div>
                <div className="admin-order-total">{formatMoney(order.total)}</div>
                <span className={`admin-status-pill ${order.paymentStatus === "paid" ? "is-active" : "is-inactive"}`}>{order.paymentStatus || "pending"}</span>
                <select value={order.fulfillmentStatus} onClick={(event) => event.stopPropagation()} onChange={(event) => updateStatus(order, event.target.value)}>
                  {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </article>
            ))}
          </div>
        ) : <p className="admin-empty">No paid orders yet.</p>}
      </section> : null}
    </section>
  );
}

function OrderDetail({ kind, quote, order, onBack, onQuoteStatus, onOrderStatus }) {
  const record = kind === "quote" ? quote : order;
  const customer = record.customer || {};
  const items = record.items || [];
  const isQuote = kind === "quote";
  const [quoteForm, setQuoteForm] = useState(() => ({
    status: record.status || "submitted",
    subtotal: record.subtotal || 0,
    discount: record.discount || 0,
    total: record.total || 0,
    expiresAt: toLocalDateTimeInput(record.expiresAt),
    paymentMethod: record.paymentMethod || "pending",
    customerNotes: record.customerNotes || "",
    internalNotes: record.internalNotes || "",
  }));
  const [savingQuote, setSavingQuote] = useState(false);

  useEffect(() => {
    if (!isQuote) return;
    setQuoteForm({
      status: record.status || "submitted",
      subtotal: record.subtotal || 0,
      discount: record.discount || 0,
      total: record.total || 0,
      expiresAt: toLocalDateTimeInput(record.expiresAt),
      paymentMethod: record.paymentMethod || "pending",
      customerNotes: record.customerNotes || "",
      internalNotes: record.internalNotes || "",
    });
  }, [
    isQuote,
    record.customerNotes,
    record.discount,
    record.expiresAt,
    record.id,
    record.internalNotes,
    record.paymentMethod,
    record.reference,
    record.status,
    record.subtotal,
    record.total,
  ]);

  const customerAccepted = isQuote && (record.customerDecision === "accepted" || record.status === "accepted");
  const salesRequested = isQuote && record.customerDecision === "sales_requested";
  const customerWhatsApp = customerWhatsAppUrl(customer, record.reference);
  const customerCallNumber = customerContactNumber(customer.phone);

  const choosePaymentMethod = async (paymentMethod) => {
    setSavingQuote(true);
    try {
      const updated = await onQuoteStatus(record, { paymentMethod });
      if (!updated) return;
      setQuoteForm((current) => ({ ...current, paymentMethod }));
      if (paymentMethod === "whatsapp" && customerWhatsApp) window.open(customerWhatsApp, "_blank", "noopener,noreferrer");
    } finally {
      setSavingQuote(false);
    }
  };

  const setQuoteField = (key, value) => setQuoteForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "subtotal" || key === "discount") {
      next.total = Math.max(Number(next.subtotal || 0) - Number(next.discount || 0), 0);
    }
    return next;
  });

  const saveQuote = async (event) => {
    event.preventDefault();
    setSavingQuote(true);
    try {
      await onQuoteStatus(record, {
        status: quoteForm.status,
        subtotal: Number(quoteForm.subtotal || 0),
        discount: Number(quoteForm.discount || 0),
        total: Number(quoteForm.total || 0),
        expiresAt: quoteForm.expiresAt ? new Date(quoteForm.expiresAt).toISOString() : undefined,
        customerNotes: quoteForm.customerNotes,
        internalNotes: quoteForm.internalNotes,
      });
    } finally {
      setSavingQuote(false);
    }
  };

  return (
    <section className="admin-order-detail">
      <button className="admin-secondary-button admin-detail-back" type="button" onClick={onBack}>Back to orders</button>

      <header className="admin-detail-hero">
        <div>
          <p className="admin-eyebrow">{isQuote ? "Quote request" : "Paid order"}</p>
          <h2>{record.reference}</h2>
          <span>{formatDate(record.createdAt)}</span>
        </div>
        <div className="admin-detail-actions">
          {isQuote ? (
            <select value={record.status} onChange={(event) => onQuoteStatus(record, event.target.value)}>
              {quoteStatuses.filter((status) => status !== "accepted" || record.status === "accepted").map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          ) : (
            <>
              <span className={`admin-status-pill ${record.paymentStatus === "paid" ? "is-active" : "is-inactive"}`}>{record.paymentStatus || "pending"}</span>
              <select value={record.fulfillmentStatus} onChange={(event) => onOrderStatus(record, event.target.value)}>
                {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </>
          )}
        </div>
      </header>

      <div className="admin-detail-grid">
        <section className="admin-detail-card">
          <h3>Customer</h3>
          <dl className="admin-detail-list">
            <div><dt>Name</dt><dd>{customer.name || "-"}</dd></div>
            <div><dt>Phone</dt><dd>{customer.phone || "-"}</dd></div>
            <div><dt>Email</dt><dd>{customer.email || "-"}</dd></div>
            <div><dt>Organization</dt><dd>{customer.organization || "-"}</dd></div>
            <div><dt>Preference</dt><dd>{customer.preference || "-"}</dd></div>
          </dl>
        </section>

        <section className="admin-detail-card">
          <h3>{isQuote ? "Quote" : "Order"} summary</h3>
          <dl className="admin-detail-list">
            <div><dt>Items</dt><dd>{items.length}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatMoney(record.subtotal)}</dd></div>
            <div><dt>Discount</dt><dd>{formatMoney(record.discount)}</dd></div>
            <div><dt>Total</dt><dd>{formatMoney(record.total)}</dd></div>
            {isQuote ? <div><dt>Expires</dt><dd>{formatDate(record.expiresAt)}</dd></div> : <div><dt>Payment</dt><dd>{record.paymentStatus || "-"}</dd></div>}
            {isQuote ? <div><dt>Customer decision</dt><dd>{record.customerDecision === "accepted" || record.status === "accepted" ? "Quotation accepted" : record.customerDecision === "sales_requested" ? "Wants sales assistance" : "Waiting for customer"}</dd></div> : null}
            {isQuote && record.salesContactRequestedAt ? <div><dt>Sales requested</dt><dd>{formatDate(record.salesContactRequestedAt)}</dd></div> : null}
            {isQuote && record.salesContactChannel ? <div><dt>Contact channel</dt><dd>{record.salesContactChannel === "whatsapp" ? "WhatsApp" : "Phone call"}</dd></div> : null}
            {isQuote && customerAccepted ? <div><dt>Payment route</dt><dd>{record.paymentMethod === "razorpay" ? "Website / Razorpay" : record.paymentMethod === "whatsapp" ? "WhatsApp / manual QR" : "Not decided"}</dd></div> : null}
          </dl>
        </section>
      </div>

      {isQuote && (salesRequested || customerAccepted) ? (
        <section className={`admin-detail-card admin-customer-decision is-${customerAccepted ? "accepted" : "sales"}`}>
          <div>
            <p className="admin-eyebrow">Customer activity · auto-updated</p>
            <h3>{customerAccepted ? "Customer accepted this quotation" : "Customer wants to speak with sales"}</h3>
            <span>{customerAccepted
              ? `Accepted ${record.customerDecisionAt ? formatDate(record.customerDecisionAt) : "recently"}. Choose how payment should be collected.`
              : `${record.salesContactChannel ? `Preferred channel: ${record.salesContactChannel === "whatsapp" ? "WhatsApp" : "phone call"}.` : "No channel selected yet."} You can contact the customer proactively.`}</span>
          </div>
          <div className="admin-customer-contact-actions">
            {customerWhatsApp ? <a href={customerWhatsApp} target="_blank" rel="noreferrer">WhatsApp customer</a> : null}
            {customerCallNumber ? <a href={`tel:+${customerCallNumber}`}>Call customer</a> : null}
          </div>
        </section>
      ) : null}

      {customer.notes ? (
        <section className="admin-detail-card">
          <h3>Customer notes</h3>
          <p className="admin-detail-note">{customer.notes}</p>
        </section>
      ) : null}

      {isQuote ? (
        <form className="admin-detail-card admin-quote-editor" onSubmit={saveQuote}>
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">Admin quote editor</p>
              <h3>Final price and customer instructions</h3>
            </div>
            <span className="admin-status-pill is-active">{formatMoney(quoteForm.total)}</span>
          </div>
          <div className="admin-form-grid">
            <Field label="Status"><select value={quoteForm.status} onChange={(event) => setQuoteField("status", event.target.value)}>{quoteStatuses.filter((status) => status !== "accepted" || record.status === "accepted").map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
            <Field label="Quote valid until"><input required step="60" type="datetime-local" value={quoteForm.expiresAt} onChange={(event) => setQuoteField("expiresAt", event.target.value)} /></Field>
            <Field label="Subtotal"><input min="0" type="number" value={quoteForm.subtotal} onChange={(event) => setQuoteField("subtotal", event.target.value)} /></Field>
            <Field label="Discount"><input min="0" type="number" value={quoteForm.discount} onChange={(event) => setQuoteField("discount", event.target.value)} /></Field>
            <Field label="Total"><input min="0" type="number" value={quoteForm.total} onChange={(event) => setQuoteField("total", event.target.value)} /></Field>
          </div>
          <Field label="Customer note"><textarea rows="3" value={quoteForm.customerNotes} onChange={(event) => setQuoteField("customerNotes", event.target.value)} placeholder="Visible to customer in My Orders" /></Field>
          <Field label="Internal note"><textarea rows="3" value={quoteForm.internalNotes} onChange={(event) => setQuoteField("internalNotes", event.target.value)} placeholder="Only visible to admin" /></Field>
          <button className="admin-primary-button" disabled={savingQuote} type="submit">{savingQuote ? "Saving quote..." : "Save quote details"}</button>
        </form>
      ) : null}

      {customerAccepted ? (
        <section className="admin-detail-card admin-payment-routing">
          <div>
            <p className="admin-eyebrow">Payment routing</p>
            <h3>Choose how this customer should pay</h3>
            <span>The selected option appears automatically in the customer&apos;s My Orders page.</span>
          </div>
          <div className="admin-payment-options">
            <button className={quoteForm.paymentMethod === "razorpay" ? "active" : ""} disabled={savingQuote} type="button" onClick={() => choosePaymentMethod("razorpay")}>
              <strong>Website payment</strong>
              <span>Show the online payment button. Gateway checkout will be connected later.</span>
            </button>
            <button className={quoteForm.paymentMethod === "whatsapp" ? "active" : ""} disabled={savingQuote} type="button" onClick={() => choosePaymentMethod("whatsapp")}>
              <strong>WhatsApp payment</strong>
              <span>Open the customer chat and arrange a verified QR/manual payment.</span>
            </button>
          </div>
          {quoteForm.paymentMethod !== "pending" ? <button className="admin-payment-reset" disabled={savingQuote} type="button" onClick={() => choosePaymentMethod("pending")}>Clear payment selection</button> : null}
        </section>
      ) : null}

      <section className="admin-detail-card">
        <h3>Items</h3>
        {items.length ? (
          <div className="admin-detail-items">
            {items.map((item, index) => (
              <article className="admin-detail-item" key={item._id || `${item.name}-${index}`}>
                <div className="admin-detail-item-media">
                  {item.image ? <img src={item.image} alt="" /> : <span>{String(index + 1).padStart(2, "0")}</span>}
                </div>
                <div className="admin-detail-item-main">
                  <strong>{item.name}</strong>
                  <small>{item.sku || item.kind || "Item"}</small>
                  {item.design ? <p>{Object.entries(item.design).filter(([, value]) => value).slice(0, 8).map(([key, value]) => `${key}: ${value}`).join(" | ")}</p> : null}
                </div>
                <div className="admin-detail-item-numbers">
                  <span>Qty {item.quantity}</span>
                  <span>{formatMoney(item.unitPrice)} each</span>
                  <strong>{formatMoney(item.lineTotal)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="admin-empty">No item details found.</p>}
      </section>
    </section>
  );
}

function SettingsManager({ settings, onSaved, onError }) {
  const [form, setForm] = useState(settings);
  const [pricingText, setPricingText] = useState(JSON.stringify(settings.customPricing || {}, null, 2));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
    setPricingText(JSON.stringify(settings.customPricing || {}, null, 2));
  }, [settings]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const customPricing = pricingText.trim() ? JSON.parse(pricingText) : undefined;
      const payload = {
        businessName: form.businessName,
        email: form.email,
        phone: form.phone || "",
        whatsapp: form.whatsapp || "",
        address: form.address,
        timings: form.timings || "",
        mapUrl: form.mapUrl || "",
        instagramUrl: form.instagramUrl || "",
        facebookUrl: form.facebookUrl || "",
        customPricing,
      };
      const nextSettings = await adminApi.updateSettings(payload);
      onSaved(nextSettings);
    } catch (requestError) {
      onError(requestError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-form-panel admin-settings-form" onSubmit={submit}>
      <h2>Contact and site settings</h2>
      <div className="admin-form-grid">
        <Field label="Business name"><input required value={form.businessName} onChange={(event) => set("businessName", event.target.value)} /></Field>
        <Field label="Email"><input required type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
        <Field label="WhatsApp"><input value={form.whatsapp} onChange={(event) => set("whatsapp", event.target.value)} /></Field>
        <Field label="Timings"><input value={form.timings} onChange={(event) => set("timings", event.target.value)} /></Field>
        <Field label="Map URL"><input value={form.mapUrl} onChange={(event) => set("mapUrl", event.target.value)} /></Field>
        <Field label="Instagram URL"><input value={form.instagramUrl} onChange={(event) => set("instagramUrl", event.target.value)} /></Field>
        <Field label="Facebook URL"><input value={form.facebookUrl} onChange={(event) => set("facebookUrl", event.target.value)} /></Field>
      </div>
      <Field label="Address"><textarea required rows="3" value={form.address} onChange={(event) => set("address", event.target.value)} /></Field>
      <Field label="Custom pricing JSON"><textarea rows="10" value={pricingText} onChange={(event) => setPricingText(event.target.value)} placeholder='{"tip":{"classic":300},"bulkDiscounts":[{"minQuantity":50,"rate":8}]}' /></Field>
      <button className="admin-primary-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save settings"}</button>
    </form>
  );
}

function Field({ children, label }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DataTable({ columns, rows }) {
  if (!rows.length) return <p className="admin-empty">No records found.</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
