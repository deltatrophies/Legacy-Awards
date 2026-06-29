import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { products, formatPrice } from "../data/products.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/account.css";

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState(() => readStorage("wishlist", []));
  const savedProducts = useMemo(() => products.filter((product) => wishlist.includes(product.id)), [wishlist]);

  const removeItem = (id) => {
    const next = wishlist.filter((item) => item !== id);
    setWishlist(next);
    writeStorage("wishlist", next);
  };

  return (
    <main className="account-page">
      <section className="account-hero">
        <p>Wishlist</p>
        <h1>Saved awards</h1>
        <span>Keep your shortlisted trophies, plaques, medals, and crystal awards in one place.</span>
      </section>

      {savedProducts.length ? (
        <section className="wishlist-grid">
          {savedProducts.map((product) => (
            <article className="wishlist-card" key={product.id}>
              <img src={product.image} alt={product.name} />
              <div>
                <span>{product.tag}</span>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <strong>{formatPrice(product.price)}</strong>
              </div>
              <div className="wishlist-actions">
                <Link to={`/products/${product.id}`}>View product</Link>
                <button type="button" onClick={() => removeItem(product.id)}>Remove</button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="account-empty">
          <div>♡</div>
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any product to save it here for later.</p>
          <Link to="/products">Explore products</Link>
        </section>
      )}
    </main>
  );
}
