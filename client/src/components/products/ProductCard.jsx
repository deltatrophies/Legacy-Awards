import { Link } from "react-router-dom";
import { formatPrice } from "../../data/products.js";
import { responsiveImageProps } from "../../utils/cloudinaryImage.js";

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 5.8c-1.6-1.9-4.4-1.6-5.8.1L12 9.2 9 5.9C7.6 4.2 4.8 3.9 3.2 5.8c-1.7 2-1.4 5 .4 6.8L12 21l8.4-8.4c1.8-1.8 2.1-4.8.4-6.8Z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

export default function ProductCard({ product, wishlisted, compared, onWishlist, onCompare }) {
  const badgeClass = `product-badge badge-${(product.badge || "catalog").toLowerCase().replaceAll(" ", "-")}`;
  const hasPrice = Number(product.price) > 0;
  return (
    <article className="catalog-card">
      <Link className="catalog-image" to={`/products/${product.id}`} aria-label={`View ${product.name}`}>
        <span className={badgeClass}>{product.badge}</span>
        <img {...responsiveImageProps(product.image)} sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw" alt={product.name} loading="lazy" decoding="async" />
      </Link>
      <button className={`icon-action wishlist-action ${wishlisted ? "active" : ""}`} type="button" onClick={() => onWishlist(product.id)} aria-label={`${wishlisted ? "Remove" : "Add"} ${product.name} ${wishlisted ? "from" : "to"} wishlist`} title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}>
        <HeartIcon filled={wishlisted} />
      </button>

      <div className="catalog-body">
        <div className="catalog-kicker">
          <span>{product.category}</span>
          <span>{product.delivery}</span>
        </div>
        <h3><Link to={`/products/${product.id}`}>{product.name}</Link></h3>
        <p className="catalog-desc">{product.description}</p>

        <div className="catalog-specs">
          <div><span>Material</span><strong>{product.material}</strong></div>
          <div><span>Size</span><strong>{product.size}</strong></div>
          <div><span>Min Qty</span><strong>{product.minOrder || 1}</strong></div>
        </div>

        <div className="catalog-meta"><span>{product.tag}</span><span>{product.useCase}</span></div>

        <div className="catalog-footer">
          <div>
            <span className="price-label">{hasPrice ? "Starting from" : "Pricing"}</span>
            <strong>{formatPrice(product.price)}</strong>
          </div>
          <Link className="catalog-cart-icon" to={`/products/${product.id}`} aria-label={`Open ${product.name} to add to cart`} title="Add to Cart">
            <CartIcon />
          </Link>
        </div>

        <label className="compare-check"><input type="checkbox" checked={compared} onChange={() => onCompare(product.id)} /> Compare</label>
      </div>
    </article>
  );
}
