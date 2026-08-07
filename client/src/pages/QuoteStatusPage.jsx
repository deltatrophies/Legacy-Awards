import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { formatPrice } from "../data/products.js";
import { paymentApi, quoteApi } from "../services/apiClient.js";
import { writeStorage } from "../utils/storage.js";
import "../styles/pages/quote.css";

const statusCopy = {
  submitted: "Your request has been received and is waiting for review.",
  reviewing: "Our team is checking pricing, artwork and delivery timeline.",
  quoted: "Your final quote is ready. Accept it to unlock payment.",
  accepted: "Quote accepted. You can complete payment now.",
  expired: "This quote has expired. Please request a fresh quote.",
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

export default function QuoteStatusPage() {
  const { reference: routeReference = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ reference: routeReference, identifier: "" });
  const [quote, setQuote] = useState(null);
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [loading, setLoading] = useState(Boolean(routeReference && searchParams.get("token")));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Track Quote - Legacy Awards";
  }, []);

  const rememberQuote = (nextQuote, nextToken = token) => {
    const stored = { ...nextQuote, id: nextQuote.reference || nextQuote.id, accessToken: nextToken };
    setQuote(stored);
    setToken(nextToken);
    writeStorage("lastQuote", stored);
  };

  useEffect(() => {
    if (!routeReference || !token) return;
    let active = true;
    setLoading(true);
    quoteApi.public(routeReference, token)
      .then((data) => { if (active) rememberQuote(data, token); })
      .catch((requestError) => { if (active) setError(requestError.message || "This tracking link could not be opened."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [routeReference, token]);

  const track = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await quoteApi.track(form);
      rememberQuote(data, data.accessToken);
    } catch (requestError) {
      setError(requestError.message || "Could not find a quote for those details.");
    } finally {
      setLoading(false);
    }
  };

  const acceptQuote = async () => {
    if (!quote) return;
    setBusy("accept");
    setError("");
    try {
      const data = await quoteApi.accept(quote.reference, token);
      rememberQuote(data, token);
    } catch (requestError) {
      setError(requestError.message || "Could not accept this quote.");
    } finally {
      setBusy("");
    }
  };

  const payQuote = async () => {
    if (!quote) return;
    setBusy("pay");
    setError("");
    try {
      const gateway = await paymentApi.createOrder(quote.reference, token);
      const ready = await loadRazorpay();
      if (!ready) throw new Error("Payment checkout could not load. Please try again.");
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
      const fresh = await quoteApi.public(quote.reference, token);
      rememberQuote(fresh, token);
    } catch (requestError) {
      setError(requestError.message || "Payment could not be completed.");
    } finally {
      setBusy("");
    }
  };

  const status = quote?.status || "submitted";

  return (
    <main className="quote-page quote-status-page">
      <header className="quote-head">
        <span>Track quote</span>
        <h1>Check your quote status</h1>
        <p>Use your secure tracking link, or enter your quote ID with the same phone or email used while submitting the request.</p>
      </header>

      <div className="quote-status-layout">
        <form className="quote-summary quote-status-form" onSubmit={track}>
          <div className="summary-heading"><span>Lookup</span><h2>Find quote</h2></div>
          <label>Quote ID<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value.toUpperCase() })} placeholder="LAQ-..." /></label>
          <label>Email or phone<input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} placeholder="Email or mobile number" /></label>
          {error ? <p className="quote-error">{error}</p> : null}
          <button className="submit-quote" disabled={loading} type="submit">{loading ? "Checking..." : "Track quote"}</button>
          <p className="privacy-note">For security, quote details are shown only when the tracking token or matching customer contact is provided.</p>
        </form>

        <section className="quote-items quote-status-card">
          {!quote && !loading ? (
            <div className="quote-status-empty">
              <h2>No quote loaded</h2>
              <p>Open your tracking link or use the lookup form to view quote status.</p>
            </div>
          ) : null}
          {loading && !quote ? <div className="quote-status-empty"><h2>Loading quote...</h2></div> : null}
          {quote ? (
            <>
              <div className="order-head">
                <div>
                  <span className="eyebrow">Quote request</span>
                  <h2>{quote.reference}</h2>
                  <small>{statusCopy[status] || "We will keep this request updated here."}</small>
                </div>
                <strong className="order-status">{status.replaceAll("-", " ")}</strong>
              </div>
              <div className="success-summary">
                <div><span>Items</span><strong>{quote.items?.length || 0}</strong></div>
                <div><span>Total</span><strong>{formatPrice(quote.total || 0)}</strong></div>
                <div><span>Preference</span><strong>{quote.customer?.preference || "WhatsApp"}</strong></div>
              </div>
              {quote.customerNotes ? <p className="order-status-note">{quote.customerNotes}</p> : null}
              <div className="order-items">
                {(quote.items || []).map((item, index) => (
                  <div key={item._id || `${item.name}-${index}`}>
                    <span>{item.name}</span>
                    <strong>Qty {item.quantity || 1}</strong>
                  </div>
                ))}
              </div>
              <div className="success-actions">
                {status === "quoted" ? <button type="button" disabled={busy === "accept"} onClick={acceptQuote}>{busy === "accept" ? "Accepting..." : "Accept quote"}</button> : null}
                {status === "accepted" ? <button type="button" disabled={busy === "pay"} onClick={payQuote}>{busy === "pay" ? "Opening..." : "Pay now"}</button> : null}
                <Link to="/account/orders">Open My Orders</Link>
                <Link to="/products">Continue shopping</Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
