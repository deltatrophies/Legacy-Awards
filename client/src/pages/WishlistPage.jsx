import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { products, formatPrice } from "../data/products.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/account.css";

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState(() => readStorage("wishlist", []));
  const savedProducts = useMemo(() => products.filter((product) => wishlist.includes(product.id)), [wishlist]);
  const categoryCount = useMemo(() => new Set(savedProducts.map((product) => product.category).filter(Boolean)).size, [savedProducts]);

  useEffect(() => {
    document.title = "Wishlist - Legacy Awards";
  }, []);

  const removeItem = (id) => {
    const next = wishlist.filter((item) => item !== id);
    setWishlist(next);
    writeStorage("wishlist", next);
  };

  return (
    <main className="account-page wishlist-page">
      <section className="wishlist-hero">
        <div>
          <p className="account-label">Wishlist</p>
          <h1>Saved awards</h1>
          <span>Keep your shortlisted trophies, plaques, medals, and crystal awards in one focused workspace.</span>
        </div>
        <div className="wishlist-summary" aria-label="Wishlist summary">
          <div><strong>{savedProducts.length}</strong><span>Saved</span></div>
          <div><strong>{categoryCount}</strong><span>Categories</span></div>
          <div><strong>{savedProducts.length ? "Ready" : "Empty"}</strong><span>Quote list</span></div>
        </div>
      </section>

      {savedProducts.length ? (
        <>
          <div className="wishlist-toolbar">
            <div>
              <strong>{savedProducts.length} saved product{savedProducts.length === 1 ? "" : "s"}</strong>
              <span>Review, compare, and open any product to choose quantity before adding it to cart.</span>
            </div>
            <Link to="/products">Browse more</Link>
          </div>

          <section className={`wishlist-grid ${savedProducts.length === 1 ? "is-single" : ""}`}>
            {savedProducts.map((product) => (
              <article className="wishlist-card" key={product.id}>
                <Link className="wishlist-media" to={`/products/${product.id}`} aria-label={`View ${product.name}`}>
                  <span>{product.badge || product.category}</span>
                  <img src={product.image} alt={product.name} />
                </Link>
                <div className="wishlist-card-body">
                  <div className="wishlist-card-kicker">
                    <span>{product.category}</span>
                    <span>{product.delivery}</span>
                  </div>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <div className="wishlist-specs">
                    <div><span>Material</span><strong>{product.material || "-"}</strong></div>
                    <div><span>Min Qty</span><strong>{product.minOrder || 1}</strong></div>
                  </div>
                  <div className="wishlist-price-row">
                    <div>
                      <span>Starting from</span>
                      <strong>{formatPrice(product.price)}</strong>
                    </div>
                    <small>{product.tag}</small>
                  </div>
                </div>
                <div className="wishlist-actions">
                  <Link to={`/products/${product.id}`}>View product</Link>
                  <button type="button" onClick={() => removeItem(product.id)}>Remove</button>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="account-empty wishlist-empty">
          <div>♡</div>
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any product to save it here for later.</p>
          <Link to="/products">Explore products</Link>
        </section>
      )}
    </main>
  );
}
