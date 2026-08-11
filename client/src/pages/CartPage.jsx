import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPrice } from "../data/products.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { quoteApi } from "../services/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/pages/quote.css";
import "../styles/pages/cart-modern.css";

export default function CartPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState(() => readStorage("cart", []));
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", organization: "", notes: "", preference: "WhatsApp" });
  useEffect(() => {
    document.title = "Quote Cart - Legacy Awards";
  }, []);
  useEffect(() => {
    if (!user) return;
    setCustomer((current) => ({
      ...current,
      name: current.name || `${user.firstName} ${user.lastName}`.trim(),
      email: current.email || user.email,
    }));
  }, [user]);
  const subtotal = useMemo(() => items.reduce((sum,item) => sum + (Number(item.price)||0) * (Number(item.qty)||1),0),[items]);
  const discount = couponApplied?.discount || 0;
  const estimatedTotal = Math.max(subtotal - discount, 0);
  const updateItems = (next) => { setItems(next); writeStorage("cart",next); };
  const changeQty = (id, qty) => {
    setCouponApplied(null);
    setCouponMessage("");
    updateItems(items.map((item) => item.id === id ? { ...item, qty: Math.max(Number(item.minOrder) || 1, qty) } : item));
  };
  const setCustomerField = (field, value) => {
    setCustomer((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const validateCustomer = () => {
    const nextErrors = {};
    const name = customer.name.trim();
    const email = customer.email.trim();
    const rawPhoneDigits = customer.phone.replace(/\D/g, "");
    const phoneDigits = rawPhoneDigits.length === 12 && rawPhoneDigits.startsWith("91") ? rawPhoneDigits.slice(2) : rawPhoneDigits;

    if (!name) nextErrors.name = "Please enter your full name.";
    else if (name.length < 2) nextErrors.name = "Name must be at least 2 characters.";
    if (!customer.phone.trim()) nextErrors.phone = "Please enter your phone number.";
    else if (phoneDigits.length !== 10) nextErrors.phone = "Please enter a valid 10-digit phone number.";
    if (!email) nextErrors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Please enter a valid email address.";
    if (customer.organization.length > 160) nextErrors.organization = "Organization must be under 160 characters.";
    if (customer.notes.length > 2000) nextErrors.notes = "Notes must be under 2000 characters.";
    return nextErrors;
  };
  const scrollToField = (field) => {
    const input = document.querySelector(`.cart-page [name="${field}"]`);
    const wrapper = input?.closest(".cart-field") || input;
    if (!input || !wrapper) return;
    const navHeight = document.querySelector(".site-nav")?.offsetHeight || 0;
    const targetTop = wrapper.getBoundingClientRect().top + window.scrollY - navHeight - 28;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
    window.setTimeout(() => input.focus({ preventScroll: true }), 300);
  };
  const fieldClass = (field) => errors[field] ? "cart-field cart-field--error" : "cart-field";
  const fieldError = (field) => errors[field] ? <small className="cart-field-error" id={`cart-${field}-error`}>{errors[field]}</small> : null;
  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    setCouponMessage("");
    setError("");
    setCouponApplied(null);
    if (!code) {
      setCouponMessage("Enter a coupon code first.");
      return;
    }
    try {
      setCouponLoading(true);
      const result = await quoteApi.validateCoupon({ code, subtotal });
      setCoupon(result.code || code);
      setCouponApplied(result);
      setCouponMessage(`${result.code} applied. You saved ${formatPrice(result.discount)}.`);
    } catch (requestError) {
      setCouponMessage(requestError.message || "This coupon could not be applied.");
    } finally {
      setCouponLoading(false);
    }
  };
  const submit = async () => {
    const validationErrors = validateCustomer();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      setError("");
      window.requestAnimationFrame(() => scrollToField(Object.keys(validationErrors)[0]));
      return;
    }
    setSubmitting(true); setError("");
    try {
      const payloadItems = items.map((item) => item.design
        ? { kind: "custom", quantity: Number(item.qty) || 1, design: item.design }
        : { kind: "catalog", productId: item.id, quantity: Number(item.qty) || 1 });
      const data = await quoteApi.create({ customer, items: payloadItems, couponCode: couponApplied ? couponApplied.code : "" });
      writeStorage("lastQuote", { ...data, id: data.reference });
      writeStorage("cart", []);
      navigate("/quote-success");
    } catch (requestError) {
      setError(requestError.message || "We could not submit your quote. Please try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <main className="quote-page cart-page">
      <header className="quote-head cart-head">
        <div>
          <span>Review your selection</span>
          <h1>My Cart</h1>
          <p>Fine-tune quantities and customization details before sending your requirements to our award specialists.</p>
        </div>
        <div className="cart-progress" aria-label="Quote request progress">
          <span className="active"><b>1</b>Cart</span>
          <i />
          <span className="active"><b>2</b>Details</span>
          <i />
          <span><b>3</b>Request</span>
        </div>
      </header>

      {!items.length ? (
        <section className="quote-empty cart-empty">
          <div className="empty-cart-icon" aria-hidden="true">◇</div>
          <span>Your selection is waiting</span>
          <h2>Your cart is empty</h2>
          <p>Browse ready-made awards or create a fully customized trophy to start your quote.</p>
          <div><Link to="/products">Explore products</Link><Link to="/custom">Build a trophy</Link></div>
        </section>
      ) : (
        <div className="quote-layout">
          <section className="quote-items">
            <div className="panel-title">
              <div><span>{items.length} {items.length === 1 ? "selection" : "selections"}</span><h2>Selected awards</h2></div>
              <button type="button" onClick={() => window.print()}>Print summary</button>
            </div>

            <div className="cart-item-list">
              {items.map((item) => {
                const minimum = Number(item.minOrder) || 1;
                const quantity = Number(item.qty) || minimum;
                return (
                  <article className="quote-item" key={item.id}>
                    <div className="cart-item-media"><img src={item.image || item.visual || "/images/shopping.jpg"} alt={item.name} /></div>
                    <div className="cart-item-copy">
                      <span>{item.tag || "Award"}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description || item.desc}</p>
                      {item.design && <div className="item-options">{item.design.size} · {item.design.finish} · {item.design.packaging || "standard"} packaging</div>}
                      <div className="item-buttons">
                        {item.designId && <Link to={`/custom?design=${item.designId}`}>Edit design</Link>}
                        <button type="button" onClick={() => updateItems(items.filter((old) => old.id !== item.id))}>Remove</button>
                      </div>
                    </div>
                    <div className="item-price">
                      <strong>{formatPrice((Number(item.price) || 0) * quantity)}</strong>
                      <small>{formatPrice(item.price)} each</small>
                      <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                        <button type="button" onClick={() => changeQty(item.id, quantity - 1)} disabled={quantity <= minimum} aria-label={`Decrease ${item.name} quantity`}>−</button>
                        <input type="number" min={minimum} value={quantity} onChange={(event) => changeQty(item.id, Number(event.target.value) || minimum)} aria-label={`${item.name} quantity`} />
                        <button type="button" onClick={() => changeQty(item.id, quantity + 1)} aria-label={`Increase ${item.name} quantity`}>+</button>
                      </div>
                      {minimum > 1 && <em>Minimum {minimum}</em>}
                    </div>
                  </article>
                );
              })}
            </div>

            <Link className="continue-shopping" to="/products">← Continue shopping</Link>
          </section>

          <aside className="quote-summary">
            <div className={`checkout-access ${user ? "ready" : "guest"}`}>
              <span className="access-icon" aria-hidden="true">{user ? "✓" : "○"}</span>
              <div>
                <strong>{user ? `Signed in as ${user.firstName}` : "Continue as guest"}</strong>
                <small>{user ? "This quote will be saved to your account." : "No login needed. You can view this quote later from My Orders on this browser."}</small>
              </div>
              {!user && <button type="button" onClick={() => navigate("/login", { state: { from: "/cart" } })}>Sign in instead</button>}
            </div>

            <div className="summary-heading"><span>Secure quote review</span><h2>Order summary</h2></div>
            <div className="coupon-box">
              <label htmlFor="coupon">Promo code</label>
              <div><input id="coupon" placeholder="Enter code" value={coupon} onChange={(event) => { setCoupon(event.target.value.toUpperCase()); setCouponApplied(null); setCouponMessage(""); }} /><button type="button" disabled={couponLoading} onClick={applyCoupon}>{couponLoading ? "Checking..." : "Apply"}</button></div>
              {couponMessage ? <small className={couponApplied ? "coupon-success" : "coupon-error"}>{couponMessage}</small> : null}
            </div>
            <div className="summary-lines">
              <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>Discount</span><strong>{formatPrice(discount)}</strong></div>
              <div className="grand-total"><span>Estimated total</span><strong>{formatPrice(estimatedTotal)}</strong></div>
            </div>

            <div className="customer-heading"><span>Contact information</span><h3>Request details</h3></div>
            <div className="customer-form">
              <label className={fieldClass("name")}>Full name *<input aria-describedby={errors.name ? "cart-name-error" : undefined} aria-invalid={Boolean(errors.name)} name="name" type="text" value={customer.name} onChange={(event) => setCustomerField("name", event.target.value)} />{fieldError("name")}</label>
              <label className={fieldClass("phone")}>Phone *<input aria-describedby={errors.phone ? "cart-phone-error" : undefined} aria-invalid={Boolean(errors.phone)} name="phone" type="tel" value={customer.phone} onChange={(event) => setCustomerField("phone", event.target.value)} placeholder="10-digit mobile number" />{fieldError("phone")}</label>
              <label className={fieldClass("email")}>Email *<input aria-describedby={errors.email ? "cart-email-error" : undefined} aria-invalid={Boolean(errors.email)} name="email" type="email" value={customer.email} onChange={(event) => setCustomerField("email", event.target.value)} />{fieldError("email")}</label>
              <label className={fieldClass("organization")}>Organization<input aria-describedby={errors.organization ? "cart-organization-error" : undefined} aria-invalid={Boolean(errors.organization)} name="organization" type="text" value={customer.organization} onChange={(event) => setCustomerField("organization", event.target.value)} />{fieldError("organization")}</label>
              <label className="cart-field">Preferred response<select name="preference" value={customer.preference} onChange={(event) => setCustomerField("preference", event.target.value)}><option>WhatsApp</option><option>Email</option><option>Phone call</option></select></label>
              <label className={fieldClass("notes")}>Notes<textarea aria-describedby={errors.notes ? "cart-notes-error" : undefined} aria-invalid={Boolean(errors.notes)} name="notes" rows="3" value={customer.notes} onChange={(event) => setCustomerField("notes", event.target.value)} />{fieldError("notes")}</label>
            </div>
            {error && <p className="quote-error">{error}</p>}
            <button className="submit-quote" type="button" disabled={submitting || authLoading} onClick={submit}>{authLoading ? "Checking account..." : submitting ? "Submitting..." : "Send Quote Request"}</button>
            <div className="secure-note"><span aria-hidden="true">⌁</span><p><strong>No payment collected now</strong>Your artwork, final price and production timeline are confirmed before payment.</p></div>
          </aside>
        </div>
      )}
    </main>
  );
}
