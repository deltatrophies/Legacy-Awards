import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import { formatPrice } from "../data/products.js";
import { ORDER_STATUS_CHANGED_EVENT, ORDER_STATUS_CHANGED_STORAGE_KEY, orderApi, paymentApi, quoteApi } from "../services/apiClient.js";
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

const quoteStatusCopy = {
  submitted: "Request received. Our team will review your items.",
  reviewing: "We are checking pricing, artwork and timeline.",
  quoted: "Final quote is ready. Accept it to unlock online payment.",
  accepted: "Quote accepted. You can complete payment now.",
  expired: "This quote has expired. Send a fresh request to continue.",
  cancelled: "This quote was cancelled.",
};

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const lastQuote = readStorage("lastQuote", null);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fallbackQuote, setFallbackQuote] = useState(lastQuote);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [busyQuote, setBusyQuote] = useState("");
  const [activeTab, setActiveTab] = useState("quotes");

  useEffect(() => {
    document.title = "My Orders - Legacy Awards";
  }, []);

  const loadHistory = async () => {
    try {
      setHistoryError("");
      const [quoteResult, orderResult, publicQuoteResult] = await Promise.allSettled([
        user ? quoteApi.mine() : Promise.resolve([]),
        user ? orderApi.mine() : Promise.resolve([]),
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
    if (!user && !lastQuote?.accessToken) {
      setHistoryLoading(false);
      return undefined;
    }
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

  useEffect(() => {
    if (!historyLoading && activeTab === "quotes" && !visibleQuotes.length && orders.length) setActiveTab("orders");
  }, [activeTab, historyLoading, orders.length, visibleQuotes.length]);

  const acceptQuote = async (quote) => {
    setBusyQuote(quote.reference || quote.id);
    setHistoryError("");
    try {
      const token = quote.accessToken || (lastQuote?.reference === quote.reference ? lastQuote.accessToken : "");
      if (quote.id && !quote.accessToken) await quoteApi.acceptMine(quote.id);
      else await quoteApi.accept(quote.reference, token);
      await loadHistory();
    } catch (requestError) {
      setHistoryError(requestError.message || "Could not accept this quote.");
    } finally {
      setBusyQuote("");
    }
  };

  const payQuote = async (quote) => {
    setBusyQuote(quote.reference || quote.id);
    setHistoryError("");
    try {
      const token = quote.accessToken || (lastQuote?.reference === quote.reference ? lastQuote.accessToken : "");
      const gateway = await paymentApi.createOrder(quote.reference, token);
      const ready = await loadRazorpay();
      if (!ready) throw new Error("Payment checkout could not load. Please try again or contact us on WhatsApp.");
      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: gateway.keyId,
          amount: gateway.amount * 100,
          currency: gateway.currency,
          name: "Legacy Awards",
          description: quote.reference,
          order_id: gateway.gatewayOrderId,
          prefill: {
            name: quote.customer?.name || "",
            email: quote.customer?.email || "",
            contact: quote.customer?.phone || "",
          },
          handler: async (response) => {
            try {
              await paymentApi.verify({ quoteReference: quote.reference, ...response }, token);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment was cancelled before completion.")) },
        });
        checkout.open();
      });
      await loadHistory();
    } catch (requestError) {
      setHistoryError(requestError.message || "Payment could not be completed.");
    } finally {
      setBusyQuote("");
    }
  };

  if (loading) return <AccountShell><div className="account-card">Loading orders...</div></AccountShell>;

  return (
    <AccountShell>
      {historyError ? <p className="account-form-error">{historyError}</p> : null}
      {historyLoading ? <div className="account-card">Loading latest status...</div> : null}

      {!historyLoading && hasHistory ? (
        <div className="order-history">
          <div className="order-tabs" role="tablist" aria-label="Order history sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "quotes"}
              className={activeTab === "quotes" ? "active" : ""}
              onClick={() => setActiveTab("quotes")}
            >
              <span>Quote Requests</span>
              <strong>{visibleQuotes.length}</strong>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "orders"}
              className={activeTab === "orders" ? "active" : ""}
              onClick={() => setActiveTab("orders")}
            >
              <span>Paid Orders</span>
              <strong>{orders.length}</strong>
            </button>
          </div>

          {activeTab === "quotes" ? (
            <section className="account-card order-card" role="tabpanel">
              <div className="order-section-head">
                <div>
                  <span className="account-label">Quote requests</span>
                  <h2>Requests sent to Legacy Awards</h2>
                </div>
                <button type="button" onClick={loadHistory}>Refresh</button>
              </div>
              {visibleQuotes.length ? (
                <div className="order-list">
                  {visibleQuotes.map((quote) => (
                    <HistoryCard
                      busy={busyQuote === (quote.reference || quote.id)}
                      key={quote.id || quote.reference}
                      onAccept={acceptQuote}
                      onPay={payQuote}
                      record={quote}
                      type="quote"
                    />
                  ))}
                </div>
              ) : <TabEmpty title="No quote requests yet" text="Quote requests you submit from the cart will appear here." />}
            </section>
          ) : null}

          {activeTab === "orders" ? (
            <section className="account-card order-card" role="tabpanel">
              <div className="order-section-head">
                <div>
                  <span className="account-label">Paid orders</span>
                  <h2>Confirmed production orders</h2>
                </div>
                <button type="button" onClick={loadHistory}>Refresh</button>
              </div>
              {orders.length ? (
                <div className="order-list">
                  {orders.map((order) => <HistoryCard key={order._id || order.id || order.reference} record={order} type="order" />)}
                </div>
              ) : <TabEmpty title="No paid orders yet" text="Once a quote is paid, the confirmed order will move into this tab." />}
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

function TabEmpty({ text, title }) {
  return (
    <div className="order-tab-empty">
      <h3>{title}</h3>
      <p>{text}</p>
      <Link to="/products">Browse awards</Link>
    </div>
  );
}

function HistoryCard({ busy = false, onAccept, onPay, record, type }) {
  const items = record.items || [];
  const status = type === "quote" ? record.status : record.fulfillmentStatus;
  const label = type === "quote" ? "Quote request" : "Paid order";
  const statusLabel = type === "quote" ? "Quote status" : "Order status";
  const canAccept = type === "quote" && status === "quoted";
  const canPay = type === "quote" && status === "accepted";
  const itemEstimate = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const requestEstimate = record.requestEstimate ?? (itemEstimate > 0 ? itemEstimate : record.total ?? 0);
  const hasAdminQuote = type === "quote" && (Boolean(record.customerNotes) || ["quoted", "accepted"].includes(status));

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
        <div><span>{type === "quote" ? "Request estimate" : "Total"}</span><strong>{formatPrice(type === "quote" ? requestEstimate : record.total || 0)}</strong></div>
        <div><span>{type === "quote" ? "Preference" : "Payment"}</span><strong>{type === "quote" ? record.customer?.preference || "WhatsApp" : record.paymentStatus || "Pending"}</strong></div>
      </div>
      {type === "quote" ? <p className="order-status-note">{quoteStatusCopy[status] || "We will keep this request updated here."}</p> : null}
      {hasAdminQuote ? (
        <section className="admin-quote-response" aria-label="Quote from Legacy Awards">
          <div className="admin-quote-response__head">
            <div>
              <span>Quote from Legacy Awards</span>
              <strong>Admin response</strong>
            </div>
            <div className="admin-quote-response__price">
              <span>Quoted price</span>
              <strong>{formatPrice(record.total || 0)}</strong>
            </div>
          </div>
          {record.customerNotes ? (
            <div className="admin-quote-response__message">
              <span>Message from our team</span>
              <p>{record.customerNotes}</p>
            </div>
          ) : null}
          {record.expiresAt ? <small>Quote valid until {formatDate(record.expiresAt)}</small> : null}
        </section>
      ) : null}
      <div className="order-items">
        {items.slice(0, 4).map((item, index) => (
          <div key={item._id || item.productId || `${item.name}-${index}`}>
            <span>{item.name}</span>
            <strong>Qty {item.quantity || item.qty || 1}</strong>
          </div>
        ))}
      </div>
      <div className="account-actions">
        {canAccept ? <button type="button" disabled={busy} onClick={() => onAccept(record)}>{busy ? "Accepting..." : "Accept quote"}</button> : null}
        {canPay ? <button type="button" disabled={busy} onClick={() => onPay(record)}>{busy ? "Opening..." : "Pay now"}</button> : null}
        <Link to="/products">Order more</Link>
      </div>
    </article>
  );
}
