import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import RecentlyViewed from "../components/products/RecentlyViewed.jsx";
import { formatPrice, getProductBySlug } from "../data/products.js";
import { CATALOG_CHANGED_EVENT, CATALOG_CHANGED_STORAGE_KEY, catalogApi } from "../services/apiClient.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { optimizedImage, responsiveImageProps } from "../utils/cloudinaryImage.js";
import "../styles/pages/commerce.css";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(() => getProductBySlug(slug));
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState(product?.minOrder || 1);
  const [selectedImage, setSelectedImage] = useState(product?.image || "");
  const [quantityNotice, setQuantityNotice] = useState("");

  const loadProduct = () => {
    catalogApi.get(slug).then((item) => { setProduct(item); setQty(item.minOrder || 1); }).catch(() => {
      if (!getProductBySlug(slug)) setNotFound(true);
    });
  };

  useEffect(() => {
    let active = true;
    setProduct(getProductBySlug(slug)); setNotFound(false);
    catalogApi.get(slug).then((item) => { if (active) { setProduct(item); setQty(item.minOrder || 1); } }).catch(() => { if (active && !getProductBySlug(slug)) setNotFound(true); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === CATALOG_CHANGED_STORAGE_KEY) loadProduct();
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, loadProduct);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CATALOG_CHANGED_EVENT, loadProduct);
      window.removeEventListener("storage", handleStorage);
    };
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    document.title = `${product.name} - Legacy Awards`;
    setSelectedImage(product.images?.[0]?.url || product.image || "");
    const recent = readStorage("recentlyViewed", []).filter((id) => id !== product.id);
    writeStorage("recentlyViewed", [product.id, ...recent].slice(0, 8));
  }, [product]);

  useEffect(() => {
    if (!quantityNotice) return undefined;
    const timer = window.setTimeout(() => setQuantityNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [quantityNotice]);

  if (notFound) return <Navigate to="/products" replace />;
  if (!product) return <main className="commerce-page detail-page"><p>Loading product...</p></main>;
  const galleryImages = (product.images?.length ? product.images.map((image) => image.url) : [product.image]).filter(Boolean).slice(0, 4);
  const activeImage = selectedImage || galleryImages[0] || product.image;
  const addToQuote = () => {
    if (qty < product.minOrder) {
      setQuantityNotice(`Minimum order is ${product.minOrder} unit${product.minOrder > 1 ? "s" : ""} for this product.`);
      setQty(product.minOrder);
      return;
    }
    const cart = readStorage("cart", []);
    const existing = cart.find((item) => item.id === product.id);
    const next = existing ? cart.map((item) => item.id === product.id ? { ...item, qty: item.qty + qty } : item) : [...cart, { ...product, qty }];
    writeStorage("cart", next);
    navigate("/cart");
  };
  const changeQuantity = (value) => {
    const nextQuantity = Number(value) || product.minOrder;
    if (nextQuantity < product.minOrder) {
      setQuantityNotice(`Minimum order is ${product.minOrder} unit${product.minOrder > 1 ? "s" : ""} for this product.`);
      setQty(product.minOrder);
      return;
    }
    setQty(nextQuantity);
  };

  return (
    <main className="commerce-page detail-page">
      {quantityNotice ? (
        <div className="detail-toast" role="status" aria-live="polite">
          <strong>Minimum quantity required</strong>
          <span>{quantityNotice}</span>
        </div>
      ) : null}
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/products">Products</Link><span>/</span><span>{product.name}</span></div>
      <section className="product-detail">
        <div className="detail-media">
          <div className="detail-media-top">
            {product.badge ? <span className="product-badge">{product.badge}</span> : <span />}
            <span className="detail-media-code">{product.sku || product.id}</span>
          </div>
          <div className="detail-image-stage">
            <img {...responsiveImageProps(activeImage, [640, 960, 1400])} sizes="(max-width: 900px) 100vw, 50vw" alt={product.name} decoding="async" />
          </div>
          {galleryImages.length > 1 ? (
            <div
              className="detail-thumb-row"
              aria-label="Product images"
              style={{ "--detail-thumb-count": Math.min(galleryImages.length, 4) }}
            >
              {galleryImages.map((image, index) => (
                <button
                  aria-label={`Show product image ${index + 1}`}
                  className={image === activeImage ? "active" : ""}
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                >
                  <img src={optimizedImage(image, 180)} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="detail-copy">
          <p className="catalog-tag">{product.tag}</p>
          <h1>{product.name}</h1>
          <div className="detail-price-card">
            <p className="detail-price">{formatPrice(product.price)} {Number(product.price) > 0 ? <small>per piece</small> : null}</p>
            <span>Bulk quote available</span>
          </div>
          <p className="detail-description">{product.description}</p>

          <dl className="spec-grid">
            <div><dt>Material</dt><dd>{product.material}</dd></div>
            <div><dt>Size</dt><dd>{product.size}</dd></div>
            <div><dt>Delivery</dt><dd>{product.delivery}</dd></div>
            <div><dt>Minimum order</dt><dd>{product.minOrder} unit{product.minOrder > 1 ? "s" : ""}</dd></div>
            <div className="wide"><dt>Best for</dt><dd>{product.useCase}</dd></div>
            <div><dt>Customization</dt><dd>Text and logo</dd></div>
          </dl>

          <div className="detail-purchase-panel">
            <label className="detail-qty-field">
              <span>Quantity</span>
              <input type="number" min={product.minOrder} value={qty} onChange={(event) => changeQuantity(event.target.value)} />
            </label>
            <div className="detail-actions">
              <button className="primary-command" onClick={addToQuote}>Add to Quote Cart</button>
              <Link className="secondary-command" to={`/custom?product=${product.id}`}>Customize</Link>
            </div>
            <p className="detail-note">Design proof shared before production. Final price may vary with artwork, finish and quantity.</p>
          </div>
        </div>
      </section>
      <RecentlyViewed exclude={product.id} />
    </main>
  );
}
