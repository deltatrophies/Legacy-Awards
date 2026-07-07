import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { adminApi, catalogApi, categoryApi } from "../services/apiClient.js";
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
  ["inquiries", "Inquiries"],
  ["orders", "Orders"],
  ["settings", "Settings"],
];

const inquiryStatuses = ["new", "contacted", "qualified", "closed", "spam"];
const orderStatuses = ["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"];
const quoteStatuses = ["submitted", "reviewing", "quoted", "accepted", "expired", "cancelled"];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getId(item) {
  return item?._id || item?.id || item?.databaseId;
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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
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
      const [summaryData, productData, categoryData, inquiryData, quoteData, orderData, settingsData] = await Promise.all([
        adminApi.summary(),
        catalogApi.adminList(),
        categoryApi.adminList(),
        adminApi.listInquiries(),
        adminApi.listQuotes(),
        adminApi.listOrders(),
        adminApi.getSettings(),
      ]);
      setSummary(summaryData);
      setProducts(productData || []);
      setCategories(categoryData || []);
      setInquiries(inquiryData || []);
      setQuotes(quoteData || []);
      setOrders(orderData || []);
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

          {notice ? <p className="admin-alert admin-alert-success" role="status">{notice}</p> : null}
          {error ? <p className="admin-alert admin-alert-error" role="alert">{error}</p> : null}
          {loading ? <div className="admin-empty">Loading admin data...</div> : null}

          {!loading && activeSection === "dashboard" ? <Dashboard summary={summary} /> : null}
          {!loading && activeSection === "products" ? (
            <ProductManager
              categories={categoryOptions}
              onError={fail}
              onSaved={() => { announce("Product saved."); refreshAll(); }}
              products={products}
            />
          ) : null}
          {!loading && activeSection === "categories" ? (
            <CategoryManager
              categories={categories}
              onError={fail}
              onSaved={() => { announce("Category saved."); refreshAll(); }}
            />
          ) : null}
          {!loading && activeSection === "inquiries" ? (
            <InquiryManager
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

function ProductManager({ products, categories, onSaved, onError }) {
  const [form, setForm] = useState(productTemplate);
  const [editingSlug, setEditingSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState("list");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.slug || category.id, category.name])), [categories]);
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
  const categoryFilters = useMemo(() => [
    { key: "all", name: "All", count: products.length },
    ...groupedProducts.map((group) => ({ key: group.key, name: group.name, count: group.products.length })),
  ], [groupedProducts, products.length]);
  const visibleGroups = categoryFilter === "all" ? groupedProducts : groupedProducts.filter((group) => group.key === categoryFilter);
  const activeCount = products.filter((product) => product.isActive !== false).length;

  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "name" && !editingSlug) next.slug = slugify(value);
    return next;
  });

  const editProduct = (product) => {
    setEditingSlug(product.id || product.slug);
    setForm({
      ...productTemplate,
      slug: product.id || product.slug,
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
        images: form.imageUrls.split("\n").map((url) => url.trim()).filter(Boolean).map((url) => ({ url, alt: form.name })),
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
          <Field label="Image URLs"><textarea rows="3" value={form.imageUrls} onChange={(event) => set("imageUrls", event.target.value)} placeholder="/images/example.jpg" /></Field>
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
            <span><strong>{products.length}</strong> Total</span>
            <span><strong>{activeCount}</strong> Active</span>
          </div>
        </div>

        <div className="admin-category-toggle" aria-label="Filter products by category">
          {categoryFilters.map((category) => (
            <button type="button" className={categoryFilter === category.key ? "active" : ""} key={category.key} onClick={() => setCategoryFilter(category.key)}>
              <span>{category.name}</span>
              <strong>{category.count}</strong>
            </button>
          ))}
        </div>

        {visibleGroups.length ? visibleGroups.map((group) => {
          const groupActive = group.products.filter((product) => product.isActive !== false).length;
          return (
            <section className="admin-category-group" key={group.key}>
              <header className="admin-category-head">
                <div>
                  <h3>{group.name}</h3>
                  <span>{group.key}</span>
                </div>
                <div className="admin-category-count">
                  <strong>{group.products.length}</strong>
                  <span>{groupActive} active</span>
                </div>
              </header>
              <div className="admin-product-stack">
                {group.products.map((product) => (
                  <article className="admin-product-row" key={product.id || product.slug}>
                    <div className="admin-product-thumb">
                      {product.image ? <img src={product.image} alt="" /> : <span>{product.name.slice(0, 2).toUpperCase()}</span>}
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
                      <button type="button" onClick={() => editProduct(product)}>Edit</button>
                      <button type="button" onClick={() => archive(product)}>Archive</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        }) : <p className="admin-empty">No products found.</p>}
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
                <button type="button" onClick={() => archive(category)}>Archive</button>
              </div>
            </article>
          )) : <p className="admin-empty">No categories found.</p>}
        </div>
      </div> : null}
    </section>
  );
}

function InquiryManager({ inquiries, onUpdated, onError }) {
  const updateStatus = async (inquiry, status) => {
    try {
      await adminApi.updateInquiry(getId(inquiry), { status });
      onUpdated();
    } catch (requestError) {
      onError(requestError);
    }
  };

  return (
    <div className="admin-table-panel">
      <h2>Inquiry management</h2>
      <DataTable
        columns={["Reference", "Customer", "Requirement", "Message", "Status"]}
        rows={inquiries.map((inquiry) => [
          <strong>{inquiry.reference}</strong>,
          <span>{inquiry.name}<small>{inquiry.email}<br />{inquiry.phone}</small></span>,
          <span>{inquiry.type}<small>{inquiry.organization} {inquiry.quantity ? `Qty: ${inquiry.quantity}` : ""}</small></span>,
          <span>{inquiry.message || "-"}<small>{formatDate(inquiry.createdAt)}</small></span>,
          <select value={inquiry.status} onChange={(event) => updateStatus(inquiry, event.target.value)}>
            {inquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>,
        ])}
      />
    </div>
  );
}

function OrderManager({ orders, quotes, detailType, detailId, onUpdated, onError }) {
  const [activeView, setActiveView] = useState("quotes");
  const navigate = useNavigate();
  const decodedDetailId = detailId ? decodeURIComponent(detailId) : "";
  const selectedQuote = detailType === "quote" ? quotes.find((quote) => [getId(quote), quote.reference].includes(decodedDetailId)) : null;
  const selectedOrder = detailType === "paid" ? orders.find((order) => [getId(order), order.reference].includes(decodedDetailId)) : null;

  const updateStatus = async (order, fulfillmentStatus) => {
    try {
      await adminApi.updateOrder(getId(order), { fulfillmentStatus });
      onUpdated();
    } catch (requestError) {
      onError(requestError);
    }
  };

  const updateQuoteStatus = async (quote, status) => {
    try {
      await adminApi.updateQuote(getId(quote), { status });
      onUpdated();
    } catch (requestError) {
      onError(requestError);
    }
  };

  if (detailType) {
    const record = detailType === "quote" ? selectedQuote : selectedOrder;
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
                </div>
                <div className="admin-order-customer">
                  <strong>{quote.customer?.name || "Customer"}</strong>
                  <small>{quote.customer?.phone || ""}{quote.customer?.email ? ` · ${quote.customer.email}` : ""}</small>
                </div>
                <div className="admin-order-total">{formatMoney(quote.total)}</div>
                <select value={quote.status} onClick={(event) => event.stopPropagation()} onChange={(event) => updateQuoteStatus(quote, event.target.value)}>
                  {quoteStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
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
              {quoteStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
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
          </dl>
        </section>
      </div>

      {customer.notes ? (
        <section className="admin-detail-card">
          <h3>Customer notes</h3>
          <p className="admin-detail-note">{customer.notes}</p>
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextSettings = await adminApi.updateSettings(form);
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
