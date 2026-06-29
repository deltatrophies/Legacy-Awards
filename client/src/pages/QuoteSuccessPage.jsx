import { Link, Navigate } from "react-router-dom";
import { BUSINESS_NAME, createWhatsAppUrl } from "../config/business.js";
import { formatPrice } from "../data/products.js";
import { readStorage } from "../utils/storage.js";
import "../styles/pages/quote.css";

export default function QuoteSuccessPage() {
  const quote = readStorage("lastQuote", null);
  if (!quote) return <Navigate to="/cart" replace />;
  const href = createWhatsAppUrl(`Hi ${BUSINESS_NAME}, I submitted quote ${quote.id} for ${formatPrice(quote.total)}. Please help me with the next steps.`);
  return <main className="success-page"><section><span className="success-mark">OK</span><p className="eyebrow">Request received</p><h1>Thank you, {quote.customer.name}</h1><p>Your quote request is ready for review. Keep this ID for future communication.</p><div className="quote-id"><span>Quote ID</span><strong>{quote.id}</strong></div><div className="success-summary"><div><span>Items</span><strong>{quote.items.length}</strong></div><div><span>Estimate</span><strong>{formatPrice(quote.total)}</strong></div><div><span>Preference</span><strong>{quote.customer.preference}</strong></div></div><div className="success-actions"><a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">Continue on WhatsApp</a><button type="button" onClick={()=>window.print()}>Print Quote</button><Link to="/products">Continue shopping</Link></div></section></main>;
}
