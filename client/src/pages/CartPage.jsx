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
  const [couponApplied, setCouponApplied] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", organization: "", notes: "", preference: "WhatsApp" });
  useEffect(() => {
    if (!user) return;
    setCustomer((current) => ({
      ...current,
      name: current.name || `${user.firstName} ${user.lastName}`.trim(),
      email: current.email || user.email,
    }));
  }, [user]);
  const subtotal = useMemo(() => items.reduce((sum,item) => sum + (Number(item.price)||0) * (Number(item.qty)||1),0),[items]);
  const discount = couponApplied ? Math.round(subtotal * .1) : 0;
  const updateItems = (next) => { setItems(next); writeStorage("cart",next); };
  const changeQty = (id, qty) => updateItems(items.map((item) => item.id === id ? { ...item, qty: Math.max(Number(item.minOrder) || 1, qty) } : item));
  const submit = async () => {
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }
    if (!customer.name.trim() || !/^\+?[0-9 ]{10,16}$/.test(customer.phone)) { setError("Please enter your name and a valid phone number."); return; }
    setSubmitting(true); setError("");
    try {
      const payloadItems = items.map((item) => item.design
        ? { kind: "custom", quantity: Number(item.qty) || 1, design: item.design }
        : { kind: "catalog", productId: item.id, quantity: Number(item.qty) || 1 });
      const data = await quoteApi.create({ customer, items: payloadItems, couponCode: couponApplied ? coupon : "" });
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
          <span className={user ? "active" : ""}><b>2</b>Sign in</span>
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
                <strong>{user ? `Signed in as ${user.firstName}` : "Sign in required to continue"}</strong>
                <small>{user ? "Your account is ready for this request." : "Your cart is saved. Sign in only when you are ready to submit."}</small>
              </div>
              {!user && <button type="button" onClick={() => navigate("/login", { state: { from: "/cart" } })}>Sign in</button>}
            </div>

            <div className="summary-heading"><span>Secure quote review</span><h2>Order summary</h2></div>
            <div className="coupon-box">
              <label htmlFor="coupon">Promo code</label>
              <div><input id="coupon" placeholder="Enter code" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} /><button type="button" onClick={() => { setCouponApplied(coupon === "LEGACY10"); setError(coupon === "LEGACY10" ? "" : "Coupon not recognised."); }}>Apply</button></div>
            </div>
            <div className="summary-lines">
              <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>Discount</span><strong>− {formatPrice(discount)}</strong></div>
              <div className="grand-total"><span>Estimated total</span><strong>{formatPrice(subtotal - discount)}</strong></div>
            </div>

            <div className="customer-heading"><span>Contact information</span><h3>Request details</h3></div>
            <div className="customer-form">
              <label>Full name *<input type="text" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
              <label>Phone *<input type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="10-digit mobile number" /></label>
              <label>Email<input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
              <label>Organization<input type="text" value={customer.organization} onChange={(event) => setCustomer({ ...customer, organization: event.target.value })} /></label>
              <label>Preferred response<select value={customer.preference} onChange={(event) => setCustomer({ ...customer, preference: event.target.value })}><option>WhatsApp</option><option>Email</option><option>Phone call</option></select></label>
              <label>Notes<textarea rows="3" value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} /></label>
            </div>
            {error && <p className="quote-error">{error}</p>}
            <button className="submit-quote" type="button" disabled={submitting || authLoading} onClick={submit}>{authLoading ? "Checking account..." : submitting ? "Submitting..." : user ? "Send Quote Request" : "Sign in to Continue"}</button>
            <div className="secure-note"><span aria-hidden="true">⌁</span><p><strong>No payment collected now</strong>Your artwork, final price and production timeline are confirmed before payment.</p></div>
          </aside>
        </div>
      )}
    </main>
  );
}
