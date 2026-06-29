import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { readStorage } from "../utils/storage.js";
import { formatPrice } from "../data/products.js";
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

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const lastQuote = readStorage("lastQuote", null);
  const quoteItems = lastQuote?.items || [];

  if (loading) return <AccountShell><div className="account-card">Loading orders...</div></AccountShell>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <AccountShell>
      {lastQuote ? (
        <section className="account-card order-card">
          <div className="order-head">
            <div>
              <span className="account-label">Latest request</span>
              <h2>{lastQuote.id || lastQuote.reference}</h2>
            </div>
            <span className="order-status">Under review</span>
          </div>
          <div className="order-metrics">
            <div><span>Items</span><strong>{quoteItems.length}</strong></div>
            <div><span>Estimate</span><strong>{formatPrice(lastQuote.total || 0)}</strong></div>
            <div><span>Preference</span><strong>{lastQuote.customer?.preference || "WhatsApp"}</strong></div>
          </div>
          <div className="order-items">
            {quoteItems.slice(0, 4).map((item) => (
              <div key={item.productId || item.name}>
                <span>{item.name}</span>
                <strong>Qty {item.quantity || item.qty || 1}</strong>
              </div>
            ))}
          </div>
          <div className="account-actions">
            <Link to="/quote-success">View request</Link>
            <Link to="/products">Order more</Link>
          </div>
        </section>
      ) : (
        <section className="account-empty">
          <div>📦</div>
          <h2>No orders yet</h2>
          <p>Your submitted quote requests and orders will appear here after checkout.</p>
          <Link to="/products">Browse awards</Link>
        </section>
      )}
    </AccountShell>
  );
}
