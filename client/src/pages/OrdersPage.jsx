import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createWhatsAppUrl } from "../config/business.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { formatPrice } from "../data/products.js";
import { ORDER_STATUS_CHANGED_EVENT, ORDER_STATUS_CHANGED_STORAGE_KEY, orderApi, paymentApi, quoteApi, settingsApi } from "../services/apiClient.js";
import "../styles/pages/account.css";

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayScriptPromise;

function loadRazorpayCheckout() {
  if (typeof window.Razorpay === "function") return Promise.resolve(window.Razorpay);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_URL}"]`);
    const script = existing || document.createElement("script");
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error("Secure checkout took too long to load. Please try again."));
    }, 15000);
    const onLoad = () => {
      window.clearTimeout(timer);
      if (typeof window.Razorpay === "function") resolve(window.Razorpay);
      else {
        script.remove();
        reject(new Error("Secure checkout did not initialize"));
      }
    };
    const onError = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Secure checkout could not be loaded. Check your connection and try again."));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = RAZORPAY_CHECKOUT_URL;
      script.async = true;
      script.dataset.legacyRazorpay = "true";
      document.head.appendChild(script);
    }
  }).catch((error) => {
    razorpayScriptPromise = undefined;
    throw error;
  });
  return razorpayScriptPromise;
}

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
      let nextOrders = orderResult.status === "fulfilled" ? orderResult.value || [] : [];

      if (publicQuoteResult.status === "fulfilled" && publicQuoteResult.value) {
        const freshQuote = { ...publicQuoteResult.value, id: publicQuoteResult.value.reference, accessToken: lastQuote.accessToken };
        setFallbackQuote(freshQuote);
        writeStorage("lastQuote", freshQuote);
        nextQuotes = [freshQuote, ...nextQuotes.filter((quote) => quote.reference !== freshQuote.reference)];
      } else if (quoteResult.status === "rejected" && orderResult.status === "rejected") {
        throw quoteResult.reason || orderResult.reason;
      }

      const publicQuote = publicQuoteResult.status === "fulfilled" ? publicQuoteResult.value : null;
      if (!user && publicQuote?.paymentStatus === "paid" && lastQuote?.accessToken) {
        const publicOrder = await orderApi.publicByQuote(publicQuote.reference, lastQuote.accessToken).catch(() => null);
        if (publicOrder) nextOrders = [publicOrder, ...nextOrders.filter((order) => order.reference !== publicOrder.reference)];
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
    const whatsappUrl = channel === "whatsapp"
      ? createWhatsAppUrl(`Hi ${businessContact.businessName}, I want to discuss quotation ${quote.reference}.`, businessContact.whatsapp)
      : "";
    const chatWindow = whatsappUrl.startsWith("http") ? window.open("about:blank", "_blank") : null;
    if (chatWindow) chatWindow.opener = null;
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
        if (chatWindow) chatWindow.location.assign(whatsappUrl);
        else if (whatsappUrl.startsWith("http")) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        else window.location.assign(whatsappUrl);
      }
      if (channel === "call") {
        const number = String(businessContact.phone || businessContact.whatsapp || "").replace(/[^\d+]/g, "");
        window.location.assign(number ? `tel:${number.startsWith("+") ? number : `+${number}`}` : "/contact");
      }
      return true;
    } catch (requestError) {
      chatWindow?.close();
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

  const payOnline = async (quote) => {
    const quoteReference = quote.reference || quote.id;
    const quoteToken = quote.accessToken || (lastQuote?.reference === quote.reference ? lastQuote.accessToken : "");
    setBusyQuote(quoteReference);
    setHistoryError("");
    setHistoryNotice("");
    try {
      const checkoutOrder = await paymentApi.createOrder(quoteReference, quoteToken);
      if (checkoutOrder.alreadyPaid) {
        await loadHistory();
        setActiveTab("orders");
        setHistoryNotice(`Payment already confirmed. Order ${checkoutOrder.orderReference || ""} is ready.`.trim());
        return;
      }

      const RazorpayCheckout = await loadRazorpayCheckout();
      const checkoutResponse = await new Promise((resolve, reject) => {
        let completed = false;
        const checkout = new RazorpayCheckout({
          key: checkoutOrder.keyId,
          amount: checkoutOrder.amountMinor,
          currency: checkoutOrder.currency,
          name: businessContact.businessName || "Legacy Awards",
          description: `Payment for quotation ${quoteReference}`,
          order_id: checkoutOrder.gatewayOrderId,
          prefill: {
            name: quote.customer?.name || user?.name || "",
            email: quote.customer?.email || user?.email || "",
            contact: quote.customer?.phone || user?.phone || "",
          },
          notes: { quoteReference },
          theme: { color: "#5c1a1a" },
          retry: { enabled: true },
          handler(response) {
            completed = true;
            resolve(response);
          },
          modal: {
            ondismiss() {
              if (!completed) reject(Object.assign(new Error("Payment window closed"), { code: "CHECKOUT_DISMISSED" }));
            },
          },
        });
        checkout.on("payment.failed", (event) => {
          const reason = event?.error?.description || "Payment attempt failed. You can retry securely in the checkout window.";
          setHistoryError(reason);
        });
        try {
          checkout.open();
        } catch (error) {
          reject(error);
        }
      });

      const result = await paymentApi.verify({
        quoteReference,
        razorpay_order_id: checkoutResponse.razorpay_order_id,
        razorpay_payment_id: checkoutResponse.razorpay_payment_id,
        razorpay_signature: checkoutResponse.razorpay_signature,
      }, quoteToken);
      await loadHistory();
      setActiveTab("orders");
      setHistoryError("");
      setHistoryNotice(`Payment confirmed securely. Paid order ${result.orderReference} has been created.`);
    } catch (requestError) {
      if (requestError.code === "CHECKOUT_DISMISSED") {
        setHistoryNotice("Checkout was closed. If your bank was debited, do not pay again—refresh this page; confirmation updates automatically.");
      } else {
        setHistoryError(requestError.message || "Payment could not be completed. Please try again.");
      }
    } finally {
      setBusyQuote("");
    }
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
                      onPay={payOnline}
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
  const paymentConfirmed = type === "quote" && record.paymentStatus === "paid";
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
      {type === "quote" && !customerAccepted && record.customerDecision !== "sales_requested" ? <p className="order-status-note">{quoteStatusCopy[status] || "We will keep this request updated here."}</p> : null}
      {hasAdminQuote || customerAccepted ? (
        <div className={`quote-detail-grid ${customerAccepted ? "has-payment" : ""}`}>
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
              {record.expiresAt ? <small>Valid until {formatDate(record.expiresAt)}</small> : null}
            </section>
          ) : null}
          {customerAccepted ? (
            <section className={`quote-payment-step is-${record.paymentMethod || "pending"}`}>
              <div className="quote-payment-confirmed">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Quotation accepted</strong>
                  <small>Price confirmed and admin notified</small>
                </div>
              </div>
              <span>Payment next step</span>
              {paymentConfirmed ? (
                <>
                  <strong>Payment confirmed</strong>
                  <p>Your paid order has been created and is available in the Paid Orders tab.</p>
                </>
              ) : record.paymentMethod === "whatsapp" ? (
                <>
                  <strong>Payment through WhatsApp</strong>
                  <p>Continue on WhatsApp to receive the verified QR or bank details.</p>
                  <button type="button" onClick={() => onOpenPaymentWhatsApp(record)}>Get payment details</button>
                </>
              ) : record.paymentMethod === "razorpay" ? (
                <>
                  <strong>Online payment requested</strong>
                  <p>Your quote is ready for website payment.</p>
                  <button type="button" disabled={busy} onClick={() => onPay(record)}>{busy ? "Opening secure checkout..." : `Pay ${formatPrice(record.total || 0)}`}</button>
                </>
              ) : (
                <>
                  <strong>Payment method being confirmed</strong>
                  <p>Admin is choosing website or WhatsApp payment. This page updates automatically.</p>
                </>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
      {record.customerDecision === "sales_requested" ? (
        <div className="quote-decision-confirmation is-sales">
          <strong>Sales conversation requested</strong>
          <span>Our team has your request{record.salesContactChannel ? ` and your ${record.salesContactChannel === "whatsapp" ? "WhatsApp" : "call"} preference` : " and can contact you directly"}.</span>
        </div>
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
