import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createWhatsAppUrl } from "../config/business.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { formatPrice } from "../data/products.js";
import { ORDER_STATUS_CHANGED_EVENT, ORDER_STATUS_CHANGED_STORAGE_KEY, orderApi, quoteApi, settingsApi } from "../services/apiClient.js";
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
  quoted: "Final quote is ready. Accept it or speak with our sales team if you need help.",
  accepted: "Quotation accepted. Admin is confirming the payment method.",
  expired: "This quote has expired. Send a fresh request to continue.",
  cancelled: "This quote was cancelled.",
};

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const lastQuote = readStorage("lastQuote", null);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fallbackQuote, setFallbackQuote] = useState(lastQuote);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [busyQuote, setBusyQuote] = useState("");
  const [activeTab, setActiveTab] = useState("quotes");
  const [businessContact, setBusinessContact] = useState({ businessName: "Legacy Awards", phone: "", whatsapp: "" });

  useEffect(() => {
    document.title = "My Orders - Legacy Awards";
    settingsApi.get().then((settings) => {
      if (settings) setBusinessContact((current) => ({ ...current, ...settings }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!historyNotice) return undefined;
    const timer = window.setTimeout(() => setHistoryNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [historyNotice]);

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
      setHistoryNotice("Quotation accepted. Legacy Awards has been notified and will now select the payment method.");
      await loadHistory();
    } catch (requestError) {
      setHistoryError(requestError.message || "Could not accept this quote.");
    } finally {
      setBusyQuote("");
    }
  };

  const requestSalesContact = async (quote, channel) => {
    setBusyQuote(quote.reference || quote.id);
    setHistoryError("");
    try {
      const token = quote.accessToken || (lastQuote?.reference === quote.reference ? lastQuote.accessToken : "");
      if (quote.id && !quote.accessToken) await quoteApi.contactSalesMine(quote.id, channel);
      else await quoteApi.contactSales(quote.reference, token, channel);
      setHistoryNotice(channel
        ? `Your ${channel === "whatsapp" ? "WhatsApp" : "call"} preference has been shared with our sales team.`
        : "Your request to speak with a sales executive has been shared. Our team can contact you even if you do not choose a channel.");
      await loadHistory();
      if (channel === "whatsapp") {
        const url = createWhatsAppUrl(`Hi ${businessContact.businessName}, I want to discuss quotation ${quote.reference}.`, businessContact.whatsapp);
        if (url.startsWith("http")) window.open(url, "_blank", "noopener,noreferrer");
        else window.location.assign(url);
      }
      if (channel === "call") {
        const number = String(businessContact.phone || businessContact.whatsapp || "").replace(/[^\d+]/g, "");
        window.location.assign(number ? `tel:${number.startsWith("+") ? number : `+${number}`}` : "/contact");
      }
      return true;
    } catch (requestError) {
      setHistoryError(requestError.message || "Could not notify the sales team.");
      return false;
    } finally {
      setBusyQuote("");
    }
  };

  const openPaymentWhatsApp = (quote) => {
    const url = createWhatsAppUrl(`Hi ${businessContact.businessName}, I accepted quotation ${quote.reference}. Please share the payment QR/details.`, businessContact.whatsapp);
    if (url.startsWith("http")) window.open(url, "_blank", "noopener,noreferrer");
    else window.location.assign(url);
  };

  const showOnlinePaymentNotice = () => {
    setHistoryNotice("Online payment has been selected for this quotation. Secure checkout will be enabled here shortly.");
  };

  if (loading) return <AccountShell><div className="account-card">Loading orders...</div></AccountShell>;

  return (
    <AccountShell>
      {historyError ? <p className="account-form-error">{historyError}</p> : null}
      {historyNotice ? <p className="account-form-success">{historyNotice}</p> : null}
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
                      onContactSales={requestSalesContact}
                      onOpenPaymentWhatsApp={openPaymentWhatsApp}
                      onPay={showOnlinePaymentNotice}
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

function HistoryCard({ busy = false, onAccept, onContactSales, onOpenPaymentWhatsApp, onPay, record, type }) {
  const [showSalesChoices, setShowSalesChoices] = useState(record.customerDecision === "sales_requested");
  const items = record.items || [];
  const quoteExpired = type === "quote" && record.status !== "accepted" && record.expiresAt && new Date(record.expiresAt) <= new Date();
  const status = type === "quote" ? (quoteExpired ? "expired" : record.status) : record.fulfillmentStatus;
  const label = type === "quote" ? "Quote request" : "Paid order";
  const statusLabel = type === "quote" ? "Quote status" : "Order status";
  const customerAccepted = type === "quote" && (record.customerDecision === "accepted" || status === "accepted");
  const canAccept = type === "quote" && status === "quoted" && !customerAccepted;
  const canContactSales = type === "quote" && status === "quoted" && !customerAccepted;
  const itemEstimate = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const requestEstimate = record.requestEstimate ?? (itemEstimate > 0 ? itemEstimate : record.total ?? 0);
  const hasAdminQuote = type === "quote" && (Boolean(record.customerNotes) || ["quoted", "accepted"].includes(status));

  useEffect(() => {
    if (record.customerDecision === "sales_requested") setShowSalesChoices(true);
  }, [record.customerDecision]);

  const beginSalesContact = async () => {
    if (await onContactSales(record)) setShowSalesChoices(true);
  };

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
      {record.customerDecision === "sales_requested" ? (
        <div className="quote-decision-confirmation is-sales">
          <strong>Sales conversation requested</strong>
          <span>Our team has your request{record.salesContactChannel ? ` and your ${record.salesContactChannel === "whatsapp" ? "WhatsApp" : "call"} preference` : " and can contact you directly"}.</span>
        </div>
      ) : null}
      {customerAccepted ? (
        <div className="quote-decision-confirmation is-accepted">
          <strong>Quotation accepted</strong>
          <span>Legacy Awards has been notified. Your quoted price is now confirmed.</span>
        </div>
      ) : null}
      {customerAccepted ? (
        <section className={`quote-payment-step is-${record.paymentMethod || "pending"}`}>
          <span>Payment next step</span>
          {record.paymentMethod === "whatsapp" ? (
            <>
              <strong>Payment through WhatsApp</strong>
              <p>Our admin has selected manual payment. Continue on WhatsApp to receive the verified QR or bank details.</p>
              <button type="button" onClick={() => onOpenPaymentWhatsApp(record)}>Get payment details on WhatsApp</button>
            </>
          ) : record.paymentMethod === "razorpay" ? (
            <>
              <strong>Online payment requested</strong>
              <p>Your quote is ready for website payment.</p>
              <button type="button" onClick={() => onPay(record)}>Pay quoted amount</button>
            </>
          ) : (
            <>
              <strong>Payment method is being confirmed</strong>
              <p>Admin will choose secure website payment or manual WhatsApp payment. This page updates automatically.</p>
            </>
          )}
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
        {canContactSales && !showSalesChoices ? <button type="button" disabled={busy} onClick={beginSalesContact}>{busy ? "Notifying..." : "Talk to a sales executive"}</button> : null}
        <Link to="/products">Order more</Link>
      </div>
      {canContactSales && showSalesChoices ? (
        <div className="quote-sales-options">
          <div>
            <strong>How would you like to connect?</strong>
            <span>Your request is already visible to admin. Selecting a channel is optional.</span>
          </div>
          <button type="button" disabled={busy} onClick={() => onContactSales(record, "whatsapp")}>Chat on WhatsApp</button>
          <button type="button" disabled={busy} onClick={() => onContactSales(record, "call")}>Call sales team</button>
        </div>
      ) : null}
    </article>
  );
}
