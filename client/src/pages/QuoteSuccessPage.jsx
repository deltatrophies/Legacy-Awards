import { Link, Navigate } from "react-router-dom";
import { BUSINESS_NAME, createWhatsAppUrl } from "../config/business.js";
import { formatPrice } from "../data/products.js";
import { readStorage } from "../utils/storage.js";
import "../styles/pages/quote.css";
import "../styles/pages/quote-success.css";

export default function QuoteSuccessPage() {
  const quote = readStorage("lastQuote", null);
  if (!quote) return <Navigate to="/cart" replace />;
  const href = createWhatsAppUrl(`Hi ${BUSINESS_NAME}, I submitted quote ${quote.id} for ${formatPrice(quote.total)}. Please help me with the next steps.`);

  return (
    <main className="success-page">
      <section className="success-card">
        <div className="success-intro">
          <div className="success-kicker">
            <span className="success-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">Request received</p>
          </div>
          <h1>Thank you,<br />{quote.customer.name}</h1>
          <p>Your request is safely submitted. Our team will review the products, quantity and timeline before sharing the final quotation.</p>
          <div className="success-next-step">
            <span>What happens next?</span>
            <strong>Track every update from My Orders</strong>
          </div>
        </div>

        <div className="success-details">
          <div className="quote-id">
            <span>Your quote ID</span>
            <strong>{quote.id}</strong>
            <small>Keep this reference for future communication.</small>
          </div>
          <div className="success-summary">
            <div>
              <span>Items</span>
              <strong>{quote.items.length}</strong>
            </div>
            <div>
              <span>Estimate</span>
              <strong>{formatPrice(quote.total)}</strong>
            </div>
            <div>
              <span>Reply preference</span>
              <strong>{quote.customer.preference}</strong>
            </div>
          </div>
          <div className="success-actions">
            <Link to="/account/orders">Open My Orders</Link>
            <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">Continue on WhatsApp</a>
            <button type="button" onClick={() => window.print()}>Print Quote</button>
            <Link to="/products">Continue shopping</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
