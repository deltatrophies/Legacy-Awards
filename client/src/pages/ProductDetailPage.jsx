import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import RecentlyViewed from "../components/products/RecentlyViewed.jsx";
import { formatPrice, getProductBySlug } from "../data/products.js";
import { CATALOG_CHANGED_EVENT, CATALOG_CHANGED_STORAGE_KEY, catalogApi } from "../services/apiClient.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/commerce.css";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(() => getProductBySlug(slug));
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState(product?.minOrder || 1);

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
    const recent = readStorage("recentlyViewed", []).filter((id) => id !== product.id);
    writeStorage("recentlyViewed", [product.id, ...recent].slice(0, 8));
  }, [product]);

  if (notFound) return <Navigate to="/products" replace />;
  if (!product) return <main className="commerce-page detail-page"><p>Loading product...</p></main>;
  const addToQuote = () => {
    const cart = readStorage("cart", []);
    const existing = cart.find((item) => item.id === product.id);
    const next = existing ? cart.map((item) => item.id === product.id ? { ...item, qty: item.qty + qty } : item) : [...cart, { ...product, qty }];
    writeStorage("cart", next);
    navigate("/cart");
  };

  return (
    <main className="commerce-page detail-page">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/products">Products</Link><span>/</span><span>{product.name}</span></div>
      <section className="product-detail">
        <div className="detail-media"><span className="product-badge">{product.badge}</span><img src={product.image} alt={product.name} /></div>
        <div className="detail-copy"><p className="catalog-tag">{product.tag}</p><h1>{product.name}</h1><p className="detail-price">{formatPrice(product.price)} <small>per piece</small></p><p className="detail-description">{product.description}</p>
          <dl className="spec-grid"><div><dt>Material</dt><dd>{product.material}</dd></div><div><dt>Size</dt><dd>{product.size}</dd></div><div><dt>Delivery</dt><dd>{product.delivery}</dd></div><div><dt>Minimum order</dt><dd>{product.minOrder} unit{product.minOrder > 1 ? "s" : ""}</dd></div><div><dt>Best for</dt><dd>{product.useCase}</dd></div><div><dt>Customization</dt><dd>Text and logo</dd></div></dl>
          <div className="detail-actions"><label>Quantity<input type="number" min={product.minOrder} value={qty} onChange={(event) => setQty(Math.max(product.minOrder, Number(event.target.value) || product.minOrder))} /></label><button className="primary-command" onClick={addToQuote}>Add to Quote Cart</button><Link className="secondary-command" to={`/custom?product=${product.id}`}>Customize</Link></div>
          <p className="detail-note">Design proof shared before production. Final price may vary with artwork, finish and quantity.</p>
        </div>
      </section>
      <RecentlyViewed exclude={product.id} />
    </main>
  );
}
