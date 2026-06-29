import { Link } from "react-router-dom";
import { formatPrice } from "../../data/products.js";

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 5.8c-1.6-1.9-4.4-1.6-5.8.1L12 9.2 9 5.9C7.6 4.2 4.8 3.9 3.2 5.8c-1.7 2-1.4 5 .4 6.8L12 21l8.4-8.4c1.8-1.8 2.1-4.8.4-6.8Z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

export default function ProductCard({ product, wishlisted, compared, onWishlist, onCompare }) {
  const badgeClass = `product-badge badge-${product.badge.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <article className="catalog-card">
      <div className="catalog-card-top">
        <span className={badgeClass}>{product.badge}</span>
        <button className={`icon-action wishlist-action ${wishlisted ? "active" : ""}`} type="button" onClick={() => onWishlist(product.id)} aria-label={`${wishlisted ? "Remove" : "Add"} ${product.name} ${wishlisted ? "from" : "to"} wishlist`} title="Wishlist">
          <HeartIcon filled={wishlisted} />
        </button>
      </div>

      <Link className="catalog-image" to={`/products/${product.id}`} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} loading="lazy" />
      </Link>

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
            <span className="price-label">Starting from</span>
            <strong>{formatPrice(product.price)}</strong>
          </div>
          <Link className="text-link" to={`/products/${product.id}`}>View details</Link>
        </div>

        <label className="compare-check"><input type="checkbox" checked={compared} onChange={() => onCompare(product.id)} /> Compare</label>
      </div>
    </article>
  );
}
