import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import { formatPrice } from "../data/products.js";
import { ORDER_STATUS_CHANGED_EVENT, ORDER_STATUS_CHANGED_STORAGE_KEY, orderApi, quoteApi } from "../services/apiClient.js";
import "../styles/pages/account.css";

function AccountShell({ children }) {
  return (
    <main className="account-page">
      <section className="account-hero">
        <p>My Orders</p>
        <h1>Quote & order history</h1>
        <span>Track your latest quote requests and continue shopping when you need more awards.</span>
      </section>
      {children}
    </main>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const lastQuote = readStorage("lastQuote", null);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fallbackQuote, setFallbackQuote] = useState(lastQuote);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const loadHistory = async () => {
    if (!user) return;
    try {
      setHistoryError("");
      const [quoteResult, orderResult, publicQuoteResult] = await Promise.allSettled([
        quoteApi.mine(),
        orderApi.mine(),
        lastQuote?.accessToken && (lastQuote.reference || lastQuote.id)
          ? quoteApi.public(lastQuote.reference || lastQuote.id, lastQuote.accessToken)
          : Promise.resolve(null),
      ]);

      let nextQuotes = quoteResult.status === "fulfilled" ? quoteResult.value || [] : [];
      const nextOrders = orderResult.status === "fulfilled" ? orderResult.value || [] : [];

      if (publicQuoteResult.status === "fulfilled" && publicQuoteResult.value) {
        const freshQuote = { ...publicQuoteResult.value, id: publicQuoteResult.value.reference, accessToken: lastQuote.accessToken };
        setFallbackQuote(freshQuote);
        writeStorage("lastQuote", freshQuote);
        nextQuotes = [freshQuote, ...nextQuotes.filter((quote) => quote.reference !== freshQuote.reference)];
      } else if (quoteResult.status === "rejected" && orderResult.status === "rejected") {
        throw quoteResult.reason || orderResult.reason;
      }

      setQuotes(nextQuotes);
      setOrders(nextOrders);
    } catch (requestError) {
      setHistoryError(requestError.message || "Could not load your latest order status.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    setHistoryLoading(true);
    loadHistory();
    const refreshOnFocus = () => loadHistory();
    const refreshOnStorage = (event) => {
      if (event.key === ORDER_STATUS_CHANGED_STORAGE_KEY) loadHistory();
    };
    const timer = window.setInterval(loadHistory, 10000);
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener(ORDER_STATUS_CHANGED_EVENT, refreshOnFocus);
    window.addEventListener("storage", refreshOnStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener(ORDER_STATUS_CHANGED_EVENT, refreshOnFocus);
      window.removeEventListener("storage", refreshOnStorage);
    };
  }, [user]);

  const visibleQuotes = useMemo(() => {
    if (quotes.length || !fallbackQuote) return quotes;
    return [{ ...fallbackQuote, reference: fallbackQuote.reference || fallbackQuote.id, status: fallbackQuote.status || "submitted" }];
  }, [fallbackQuote, quotes]);
  const hasHistory = visibleQuotes.length || orders.length;

  if (loading) return <AccountShell><div className="account-card">Loading orders...</div></AccountShell>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <AccountShell>
      {historyError ? <p className="account-form-error">{historyError}</p> : null}
      {historyLoading ? <div className="account-card">Loading latest status...</div> : null}

      {!historyLoading && hasHistory ? (
        <div className="order-history">
          {visibleQuotes.length ? (
            <section className="account-card order-card">
              <div className="order-section-head">
                <div>
                  <span className="account-label">Quote requests</span>
                  <h2>Requests sent to Legacy Awards</h2>
                </div>
                <button type="button" onClick={loadHistory}>Refresh</button>
              </div>
              <div className="order-list">
                {visibleQuotes.map((quote) => <HistoryCard key={quote.id || quote.reference} record={quote} type="quote" />)}
              </div>
            </section>
          ) : null}

          {orders.length ? (
            <section className="account-card order-card">
              <div className="order-section-head">
                <div>
                  <span className="account-label">Paid orders</span>
                  <h2>Confirmed production orders</h2>
                </div>
                <button type="button" onClick={loadHistory}>Refresh</button>
              </div>
              <div className="order-list">
                {orders.map((order) => <HistoryCard key={order._id || order.id || order.reference} record={order} type="order" />)}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {!historyLoading && !hasHistory ? (
        <section className="account-empty">
          <div>--</div>
          <h2>No orders yet</h2>
          <p>Your submitted quote requests and orders will appear here after checkout.</p>
          <Link to="/products">Browse awards</Link>
        </section>
      ) : null}
    </AccountShell>
  );
}

function HistoryCard({ record, type }) {
  const items = record.items || [];
  const status = type === "quote" ? record.status : record.fulfillmentStatus;
  const label = type === "quote" ? "Quote request" : "Paid order";
  const statusLabel = type === "quote" ? "Quote status" : "Order status";

  return (
    <article className="order-history-card">
      <div className="order-head">
        <div>
          <span className="account-label">{label}</span>
          <h2>{record.reference || record.id}</h2>
          <small>{formatDate(record.createdAt)}</small>
        </div>
        <div className="order-status-wrap" aria-label={`${statusLabel}: ${String(status || "submitted").replaceAll("-", " ")}`}>
          <span>{statusLabel}</span>
          <strong className="order-status">{String(status || "submitted").replaceAll("-", " ")}</strong>
        </div>
      </div>
      <div className="order-metrics">
        <div><span>Items</span><strong>{items.length}</strong></div>
        <div><span>{type === "quote" ? "Estimate" : "Total"}</span><strong>{formatPrice(record.total || 0)}</strong></div>
        <div><span>{type === "quote" ? "Preference" : "Payment"}</span><strong>{type === "quote" ? record.customer?.preference || "WhatsApp" : record.paymentStatus || "Pending"}</strong></div>
      </div>
      <div className="order-items">
        {items.slice(0, 4).map((item, index) => (
          <div key={item._id || item.productId || `${item.name}-${index}`}>
            <span>{item.name}</span>
            <strong>Qty {item.quantity || item.qty || 1}</strong>
          </div>
        ))}
      </div>
      <div className="account-actions">
        <Link to="/products">Order more</Link>
      </div>
    </article>
  );
}
