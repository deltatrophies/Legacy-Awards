import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ORDER_STATUS_CHANGED_EVENT, ORDER_STATUS_CHANGED_STORAGE_KEY, paymentApi, salesApi } from "../services/apiClient.js";
import "../styles/pages/admin.css";

const salesRoles = ["sales", "sales_manager", "staff", "admin"];
const managerRoles = ["sales_manager", "staff", "admin"];
const quoteStatuses = ["submitted", "reviewing", "quoted", "accepted", "expired", "cancelled"];
const orderStatuses = ["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"];

const getId = (item) => item?._id || item?.id || item?.reference;
const money = (value) => Number(value || 0) > 0 ? `Rs. ${Number(value).toLocaleString("en-IN")}` : "Price on request";
const dateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const localDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const assigneeName = (record) => record?.assignedTo ? `${record.assignedTo.firstName || ""} ${record.assignedTo.lastName || ""}`.trim() || record.assignedTo.email : "Unassigned";
const customerNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};

function SalesGuard({ children }) {
  const location = useLocation();
  const { loading, user } = useAuth();
  if (loading) return <main className="admin-loading">Loading sales workspace...</main>;
  if (!user || !salesRoles.includes(user.role)) return <Navigate to="/sales/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function SalesPanelPage() {
  const { section = "dashboard", detailId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const canManage = managerRoles.includes(user?.role);
  const [summary, setSummary] = useState({});
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [team, setTeam] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [view, setView] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "sales" && view !== "mine") setView("mine");
  }, [user?.role, view]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!user || !salesRoles.includes(user.role)) {
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const detailRequest = detailId && ["leads", "orders"].includes(section)
        ? (section === "leads" ? salesApi.getQuote(detailId) : salesApi.getOrder(detailId))
          .then((data) => ({ data }))
          .catch((detailError) => ({ error: detailError }))
        : Promise.resolve(null);
      const results = await Promise.all([
        salesApi.summary(),
        salesApi.listQuotes(view),
        salesApi.listOrders(view),
        canManage ? salesApi.team() : Promise.resolve([]),
        detailRequest,
      ]);
      setSummary(results[0] || {});
      setQuotes(results[1] || []);
      setOrders(results[2] || []);
      setTeam(results[3] || []);
      const detailResult = results[4];
      if (detailResult?.error) {
        setDetailRecord(null);
        if (!quiet) setError(detailResult.error.message || "This record could not be loaded.");
      } else {
        setDetailRecord(detailResult?.data ? { kind: section, data: detailResult.data } : null);
        setError("");
      }
    } catch (requestError) {
      if (!quiet) setError(requestError.message || "Sales workspace could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [canManage, detailId, section, user, view]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { document.title = `${section === "orders" ? "Paid Orders" : section === "leads" ? "Sales Leads" : "Sales Dashboard"} - Legacy Awards`; }, [section]);
  useEffect(() => {
    let refreshing = false;
    const poll = async () => {
      if (document.hidden || refreshing) return;
      refreshing = true;
      try { await refresh({ quiet: true }); } finally { refreshing = false; }
    };
    const timer = window.setInterval(poll, 5_000);
    const storage = (event) => { if (event.key === ORDER_STATUS_CHANGED_STORAGE_KEY) void poll(); };
    const visibility = () => { if (!document.hidden) void poll(); };
    window.addEventListener("focus", poll);
    window.addEventListener("storage", storage);
    window.addEventListener(ORDER_STATUS_CHANGED_EVENT, poll);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", poll);
      window.removeEventListener("storage", storage);
      window.removeEventListener(ORDER_STATUS_CHANGED_EVENT, poll);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);

  const perform = async (key, action, success) => {
    setBusy(key); setError("");
    try {
      await action();
      setNotice(success);
      window.setTimeout(() => setNotice(""), 3200);
      await refresh({ quiet: true });
      return true;
    } catch (requestError) {
      setError(requestError.message || "The action could not be completed.");
      return false;
    } finally { setBusy(""); }
  };

  const visibleSections = [["dashboard", "Dashboard"], ["leads", "Leads"], ["orders", "Paid Orders"]];
  const visibleViews = canManage ? ["all", "mine", "unassigned"] : ["mine"];
  const selectedQuote = section === "leads" && detailId ? (detailRecord?.kind === "leads" ? detailRecord.data : quotes.find((item) => String(getId(item)) === detailId || item.reference === detailId)) : null;
  const selectedOrder = section === "orders" && detailId ? (detailRecord?.kind === "orders" ? detailRecord.data : orders.find((item) => String(getId(item)) === detailId || item.reference === detailId)) : null;

  return (
    <SalesGuard>
      <main className="admin-shell sales-shell">
        <aside className="admin-sidebar sales-sidebar">
          <Link className="admin-brand" to="/sales/dashboard">Legacy Sales</Link>
          <nav className="admin-nav" aria-label="Sales sections">
            {visibleSections.map(([key, label]) => <NavLink key={key} to={`/sales/${key}`} className={() => section === key ? "active" : ""}>{label}</NavLink>)}
          </nav>
          <div className="admin-user-box"><span>{user?.firstName} {user?.lastName}</span><small>{user?.jobTitle || (canManage ? "Sales Manager" : "Sales Executive")}</small><small>{user?.email}</small><button type="button" onClick={logout}>Logout</button></div>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar"><div><p className="admin-eyebrow">Sales workspace · individual activity</p><h1>{visibleSections.find(([key]) => key === section)?.[1] || "Dashboard"}</h1></div><button className="admin-secondary-button" type="button" onClick={() => refresh()}>Refresh</button></header>
          {notice || error ? <div className="admin-toast-stack" aria-live="polite">{notice ? <p className="admin-alert admin-alert-success">{notice}</p> : null}{error ? <p className="admin-alert admin-alert-error" role="alert">{error}</p> : null}</div> : null}
          <div className="sales-view-filter" aria-label="Work ownership filter">
            {visibleViews.map((item) => <button type="button" className={view === item ? "active" : ""} key={item} onClick={() => setView(item)}>{item === "all" ? "All team work" : item === "mine" ? "Assigned to me" : "Unassigned queue"}</button>)}
          </div>
          {loading ? <p className="admin-empty">Loading your pipeline...</p> : null}
          {!loading && section === "dashboard" ? <SalesDashboard summary={summary} quotes={quotes} navigate={navigate} canManage={canManage} /> : null}
          {!loading && section === "leads" ? (detailId
            ? <SalesQuoteDetail quote={selectedQuote} team={team} user={user} busy={busy} onBack={() => navigate("/sales/leads")} onPerform={perform} />
            : <SalesLeadList quotes={quotes} team={team} user={user} busy={busy} navigate={navigate} onPerform={perform} />) : null}
          {!loading && section === "orders" ? (detailId
            ? <SalesOrderDetail order={selectedOrder} team={team} user={user} busy={busy} onBack={() => navigate("/sales/orders")} onPerform={perform} />
            : <SalesOrderList orders={orders} team={team} user={user} busy={busy} navigate={navigate} onPerform={perform} />) : null}
        </section>
      </main>
    </SalesGuard>
  );
}

function SalesDashboard({ summary, quotes, navigate, canManage }) {
  const cards = [["Assigned leads", summary.assignedLeads || 0], ...(canManage ? [["Unassigned queue", summary.unassignedLeads || 0]] : []), ["Needs attention", summary.needsAttention || 0], ["Follow-ups due", summary.followUpsDue || 0], ["Open paid orders", summary.openOrders || 0], ["Total paid orders", summary.paidOrders || 0]];
  const attention = quotes.filter((quote) => ["accepted", "sales_requested"].includes(quote.customerDecision) && !["paid", "refunded"].includes(quote.paymentStatus)).slice(0, 6);
  return <div className="admin-dashboard"><section className="admin-metric-grid">{cards.map(([label, value]) => <article className="admin-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="admin-panel"><div className="admin-section-heading"><div><p className="admin-eyebrow">Priority desk</p><h2>Customer actions requiring attention</h2></div></div>{attention.length ? <div className="admin-order-stack">{attention.map((quote) => <SalesCustomerActivity key={quote.reference} quote={quote} onOpen={() => navigate(`/sales/leads/${encodeURIComponent(getId(quote))}`)} />)}</div> : <p className="admin-empty">No urgent customer action right now.</p>}</section></div>;
}

function OwnershipControl({ record, team, user, busy, kind, onPerform }) {
  const canManage = managerRoles.includes(user.role);
  const isMine = String(record.assignedTo?.id || record.assignedTo?._id || "") === String(user.id);
  if (canManage) return <label className="sales-owner-control"><span>Owner</span><select disabled={Boolean(busy)} value={record.assignedTo?.id || record.assignedTo?._id || ""} onChange={(event) => onPerform(`assign-${getId(record)}`, () => kind === "quote" ? salesApi.assignQuote(getId(record), event.target.value) : salesApi.assignOrder(getId(record), event.target.value), "Assignment updated.")}><option value="">Unassigned queue</option>{team.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>;
  if (!record.assignedTo) return <span className="sales-owner-badge">Awaiting manager assignment</span>;
  return <span className={`sales-owner-badge ${isMine ? "is-mine" : ""}`}>{isMine ? "Assigned to you" : `Owned by ${assigneeName(record)}`}</span>;
}

function SalesLeadList({ quotes, team, user, busy, navigate, onPerform }) {
  return <section className="admin-order-workspace"><div className="admin-section-heading"><div><p className="admin-eyebrow">Ownership-driven pipeline</p><h2>Quote requests</h2></div><span className="admin-status-pill is-active">{quotes.length} visible</span></div>{quotes.length ? <div className="sales-card-grid">{quotes.map((quote) => <article className={`sales-work-card priority-${quote.priority || "normal"}`} key={quote.reference}><button className="sales-card-open" type="button" onClick={() => navigate(`/sales/leads/${encodeURIComponent(getId(quote))}`)}><span className="sales-card-kicker">{quote.priority || "normal"} priority · {quote.status}</span><strong>{quote.reference}</strong><h3>{quote.customer?.name || "Customer"}</h3><small>{quote.customer?.phone} {quote.customer?.email ? `· ${quote.customer.email}` : ""}</small><div className="sales-card-meta"><span>{money(quote.total)}</span><span>{dateTime(quote.followUpAt || quote.createdAt)}</span></div>{quote.customerDecision !== "pending" ? <b>{quote.customerDecision === "accepted" ? "Customer accepted" : "Sales contact requested"}</b> : null}</button><OwnershipControl record={quote} team={team} user={user} busy={busy} kind="quote" onPerform={onPerform} /></article>)}</div> : <p className="admin-empty">No quote requests in this view.</p>}</section>;
}

function SalesOrderList({ orders, team, user, busy, navigate, onPerform }) {
  return <section className="admin-order-workspace"><div className="admin-section-heading"><div><p className="admin-eyebrow">Confirmed business</p><h2>Paid orders</h2></div><span className="admin-status-pill is-active">{orders.length} visible</span></div>{orders.length ? <div className="sales-card-grid">{orders.map((order) => <article className="sales-work-card" key={order.reference}><button className="sales-card-open" type="button" onClick={() => navigate(`/sales/orders/${encodeURIComponent(getId(order))}`)}><span className="sales-card-kicker">{order.paymentProvider === "manual" ? "WhatsApp payment" : "Razorpay"} · {order.fulfillmentStatus}</span><strong>{order.reference}</strong><h3>{order.customer?.name || "Customer"}</h3><small>{order.customer?.phone} {order.customer?.email ? `· ${order.customer.email}` : ""}</small><div className="sales-card-meta"><span>{money(order.total)}</span><span>Paid {dateTime(order.paidAt)}</span></div></button><OwnershipControl record={order} team={team} user={user} busy={busy} kind="order" onPerform={onPerform} /></article>)}</div> : <p className="admin-empty">No paid orders in this view.</p>}</section>;
}

function SalesQuoteDetail({ quote, team, user, busy, onBack, onPerform }) {
  const [form, setForm] = useState(null);
  useEffect(() => { if (quote) setForm({ status: quote.status, priority: quote.priority || "normal", followUpAt: localDateTime(quote.followUpAt), subtotal: quote.subtotal || 0, discount: quote.discount || 0, total: quote.total || 0, expiresAt: localDateTime(quote.expiresAt), customerNotes: quote.customerNotes || "", internalNotes: quote.internalNotes || "", lostReason: quote.lostReason || "" }); }, [quote]);
  if (!quote || !form) return <EmptyDetail onBack={onBack} />;
  const isManager = managerRoles.includes(user.role);
  const isMine = String(quote.assignedTo?.id || quote.assignedTo?._id || "") === String(user.id);
  const canEdit = isManager || isMine;
  const locked = ["processing", "paid", "refunded"].includes(quote.paymentStatus);
  const accepted = quote.customerDecision === "accepted" || quote.status === "accepted";
  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (["subtotal", "discount"].includes(key)) next.total = Math.max(Number(next.subtotal || 0) - Number(next.discount || 0), 0);
    return next;
  });
  const save = (event) => {
    event.preventDefault();
    const status = ["submitted", "reviewing"].includes(form.status) ? "quoted" : form.status;
    return onPerform(`save-${getId(quote)}`, () => salesApi.updateQuote(getId(quote), { ...form, status, subtotal: Number(form.subtotal), discount: Number(form.discount), total: Number(form.total), expiresAt: new Date(form.expiresAt).toISOString(), followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null }), "Quotation updated and activity recorded.");
  };
  const number = customerNumber(quote.customer?.phone);
  const whatsapp = number ? `https://wa.me/${number}?text=${encodeURIComponent(`Hi ${quote.customer?.name || "there"}, this is Legacy Awards regarding quotation ${quote.reference}.`)}` : "";
  return <section className="admin-order-detail"><button className="admin-secondary-button admin-detail-back" type="button" onClick={onBack}>Back to leads</button><header className="admin-detail-hero"><div><p className="admin-eyebrow">{locked ? `Payment ${quote.paymentStatus}` : "Sales-owned quotation"}</p><h2>{quote.reference}</h2><span>{dateTime(quote.createdAt)} · {assigneeName(quote)}</span></div><OwnershipControl record={quote} team={team} user={user} busy={busy} kind="quote" onPerform={onPerform} /></header><div className="admin-detail-grid"><ContactCard customer={quote.customer} whatsapp={whatsapp} number={number} /><SummaryCard record={quote} /></div>{quote.customerDecision === "sales_requested" && !locked ? <SalesCustomerActivity quote={quote} /> : null}{accepted && !locked && canEdit ? <section className="admin-detail-card admin-customer-decision is-accepted"><div><p className="admin-eyebrow">Customer accepted</p><h3>Choose the secure payment route</h3><span>The selected route appears for the customer immediately.</span></div><div className="admin-customer-contact-actions"><button className={quote.paymentMethod === "razorpay" ? "active" : ""} disabled={Boolean(busy)} type="button" onClick={() => onPerform(`pay-${getId(quote)}`, () => salesApi.updateQuote(getId(quote), { paymentMethod: "razorpay" }), "Website payment selected.")}>Website / Razorpay</button><button className={quote.paymentMethod === "whatsapp" ? "active" : "is-secondary"} disabled={Boolean(busy)} type="button" onClick={() => onPerform(`pay-${getId(quote)}`, () => salesApi.updateQuote(getId(quote), { paymentMethod: "whatsapp" }), "WhatsApp payment selected.")}>WhatsApp / QR</button>{quote.paymentMethod === "whatsapp" ? <button className="is-manual-confirm" disabled={Boolean(busy)} type="button" onClick={() => { if (window.confirm(`Confirm ${money(quote.total)} received for ${quote.reference}?`)) onPerform(`manual-${getId(quote)}`, () => paymentApi.confirmManual(getId(quote)), "Payment confirmed and paid order created."); }}>Mark payment received</button> : null}</div></section> : null}{canEdit && !locked ? <form className="admin-detail-card admin-quote-editor" onSubmit={save}><div className="admin-section-heading"><div><p className="admin-eyebrow">Quotation workspace</p><h3>Price, follow-up and customer message</h3></div><span className="admin-status-pill is-active">{money(form.total)}</span></div><div className="admin-form-grid"><Field label="Status"><select value={form.status} onChange={(event) => set("status", event.target.value)}>{quoteStatuses.filter((status) => status !== "accepted" || quote.status === "accepted").map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="Priority"><select value={form.priority} onChange={(event) => set("priority", event.target.value)}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></Field><Field label="Follow-up"><input type="datetime-local" value={form.followUpAt} onChange={(event) => set("followUpAt", event.target.value)} /></Field><Field label="Valid until"><input required type="datetime-local" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} /></Field><Field label="Subtotal"><input min="0" type="number" value={form.subtotal} onChange={(event) => set("subtotal", event.target.value)} /></Field><Field label="Discount"><input min="0" type="number" value={form.discount} onChange={(event) => set("discount", event.target.value)} /></Field><Field label="Total"><input min="0" type="number" value={form.total} onChange={(event) => set("total", event.target.value)} /></Field></div><Field label="Customer note"><textarea rows="3" value={form.customerNotes} onChange={(event) => set("customerNotes", event.target.value)} /></Field><Field label="Private team note"><textarea rows="3" value={form.internalNotes} onChange={(event) => set("internalNotes", event.target.value)} /></Field>{form.status === "cancelled" ? <Field label="Lost / cancellation reason"><textarea rows="2" value={form.lostReason} onChange={(event) => set("lostReason", event.target.value)} /></Field> : null}<button className="admin-primary-button" disabled={Boolean(busy)} type="submit">{busy ? "Saving..." : "Save quotation"}</button></form> : !canEdit ? <p className="admin-empty">This lead must be assigned by a Sales Manager or Admin before it can be handled.</p> : null}<ItemsCard items={quote.items} /><ActivityTimeline activity={quote.activity} /></section>;
}

function SalesOrderDetail({ order, team, user, busy, onBack, onPerform }) {
  if (!order) return <EmptyDetail onBack={onBack} />;
  const isManager = managerRoles.includes(user.role);
  const isMine = String(order.assignedTo?.id || order.assignedTo?._id || "") === String(user.id);
  const canEdit = isManager || isMine;
  const number = customerNumber(order.customer?.phone);
  const whatsapp = number ? `https://wa.me/${number}?text=${encodeURIComponent(`Hi ${order.customer?.name || "there"}, this is Legacy Awards regarding paid order ${order.reference}.`)}` : "";
  return <section className="admin-order-detail"><button className="admin-secondary-button admin-detail-back" type="button" onClick={onBack}>Back to paid orders</button><header className="admin-detail-hero"><div><p className="admin-eyebrow">Paid order · {order.paymentProvider === "manual" ? "WhatsApp" : "Razorpay"}</p><h2>{order.reference}</h2><span>Paid {dateTime(order.paidAt)} · {assigneeName(order)}</span></div><OwnershipControl record={order} team={team} user={user} busy={busy} kind="order" onPerform={onPerform} /></header><div className="admin-detail-grid"><ContactCard customer={order.customer} whatsapp={whatsapp} number={number} /><SummaryCard record={order} /></div>{canEdit ? <section className="admin-detail-card"><div className="admin-section-heading"><div><p className="admin-eyebrow">Fulfillment</p><h3>Order progress</h3></div><select disabled={Boolean(busy)} value={order.fulfillmentStatus} onChange={(event) => onPerform(`status-${getId(order)}`, () => salesApi.updateOrder(getId(order), { fulfillmentStatus: event.target.value }), "Order status updated.")}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></div></section> : <p className="admin-empty">This order must be assigned by a Sales Manager or Admin before fulfillment can be updated.</p>}<ItemsCard items={order.items} /><ActivityTimeline activity={order.activity} /></section>;
}

function ContactCard({ customer = {}, whatsapp, number }) { return <section className="admin-detail-card"><h3>Customer</h3><dl className="admin-detail-list"><div><dt>Name</dt><dd>{customer.name || "-"}</dd></div><div><dt>Phone</dt><dd>{customer.phone || "-"}</dd></div><div><dt>Email</dt><dd>{customer.email || "-"}</dd></div><div><dt>Organization</dt><dd>{customer.organization || "-"}</dd></div></dl><div className="admin-customer-contact-actions">{whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp customer</a> : null}{number ? <a className="is-secondary" href={`tel:+${number}`}>Call customer</a> : null}</div></section>; }
function SalesCustomerActivity({ quote, onOpen }) {
  const accepted = quote.customerDecision === "accepted" || quote.status === "accepted";
  const number = customerNumber(quote.customer?.phone);
  const whatsapp = number ? `https://wa.me/${number}?text=${encodeURIComponent(`Hi ${quote.customer?.name || "there"}, this is Legacy Awards regarding quotation ${quote.reference}.`)}` : "";
  const requestedAt = quote.salesContactRequestedAt || quote.customerDecisionAt;
  return <section className={`admin-detail-card admin-customer-decision is-${accepted ? "accepted" : "sales"}`}><div><p className="admin-eyebrow">Customer activity · auto-updated</p><h3>{accepted ? "Customer accepted this quotation" : "Customer wants to speak with sales"}</h3><span>{accepted ? `Accepted ${requestedAt ? dateTime(requestedAt) : "recently"}. Open the lead to choose a payment route.` : `${quote.salesContactChannel ? `Preferred channel: ${quote.salesContactChannel === "whatsapp" ? "WhatsApp" : "phone call"}.` : "No channel selected yet."} ${requestedAt ? `Requested ${dateTime(requestedAt)}.` : ""} Contact the customer proactively.`}</span></div><div className="admin-customer-contact-actions">{onOpen ? <button type="button" onClick={onOpen}>Open lead</button> : null}{!accepted && whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp customer</a> : null}{!accepted && number ? <a className="is-secondary" href={`tel:+${number}`}>Call customer</a> : null}</div></section>;
}
function SummaryCard({ record }) { return <section className="admin-detail-card"><h3>Summary</h3><dl className="admin-detail-list"><div><dt>Items</dt><dd>{record.items?.length || 0}</dd></div><div><dt>Subtotal</dt><dd>{money(record.subtotal)}</dd></div><div><dt>Discount</dt><dd>{money(record.discount)}</dd></div><div><dt>Total</dt><dd>{money(record.total)}</dd></div><div><dt>Payment</dt><dd>{record.paymentStatus || "unpaid"}</dd></div>{record.followUpAt ? <div><dt>Follow-up</dt><dd>{dateTime(record.followUpAt)}</dd></div> : null}</dl></section>; }
function ItemsCard({ items = [] }) { return <section className="admin-detail-card"><h3>Items</h3><div className="admin-detail-items">{items.map((item, index) => <article className="admin-detail-item" key={item._id || `${item.name}-${index}`}><div className="admin-detail-item-media">{item.image ? <img src={item.image} alt="" /> : <span>{index + 1}</span>}</div><div className="admin-detail-item-main"><strong>{item.name}</strong><small>{item.sku || item.kind}</small></div><div className="admin-detail-item-numbers"><span>Qty {item.quantity}</span><strong>{money(item.lineTotal)}</strong></div></article>)}</div></section>; }
function ActivityTimeline({ activity = [] }) { return <section className="admin-detail-card"><div className="admin-section-heading"><div><p className="admin-eyebrow">Audit trail</p><h3>Activity timeline</h3></div><span>{activity.length} events</span></div>{activity.length ? <ol className="sales-activity-list">{activity.map((entry) => <li key={entry.id || `${entry.type}-${entry.createdAt}`}><span aria-hidden="true" /><div><strong>{entry.message}</strong><small>{entry.actorName} · {dateTime(entry.createdAt)}</small></div></li>)}</ol> : <p className="admin-empty">No activity recorded yet.</p>}</section>; }
function Field({ children, label }) { return <label className="admin-field"><span>{label}</span>{children}</label>; }
function EmptyDetail({ onBack }) { return <section className="admin-order-detail"><button className="admin-secondary-button" type="button" onClick={onBack}>Back</button><p className="admin-empty">This record is unavailable or assigned to another salesperson.</p></section>; }
