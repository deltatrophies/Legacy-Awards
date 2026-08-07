import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatPrice, products as fallbackProducts } from "../data/products.js";
import { catalogApi } from "../services/apiClient.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/commerce.css";

const COMPARE_STORAGE_KEY = "compareProducts";
const MAX_COMPARE_ITEMS = 3;

function parseCompareIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE_ITEMS);
}

function formatCategory(value) {
  return String(value || "Uncategorized").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function productImage(product) {
  return product.images?.[0]?.url || product.image || "/images/shopping.jpg";
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const compareParam = searchParams.get("items") || "";
  const queryIds = useMemo(() => parseCompareIds(compareParam), [compareParam]);
  const [catalog, setCatalog] = useState(fallbackProducts);
  const [selectedIds, setSelectedIds] = useState(() => {
    const stored = readStorage(COMPARE_STORAGE_KEY, []);
    return queryIds.length ? queryIds : stored.slice(0, MAX_COMPARE_ITEMS);
  });

  useEffect(() => {
    document.title = "Compare Awards - Legacy Awards";
  }, []);

  useEffect(() => {
    let active = true;
    catalogApi.list().then((items) => {
      if (active && items.length) setCatalog(items);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (queryIds.length) {
      setSelectedIds(queryIds);
      writeStorage(COMPARE_STORAGE_KEY, queryIds);
    }
  }, [compareParam]);

  const selectedProducts = useMemo(() => selectedIds.map((id) => catalog.find((item) => item.id === id)).filter(Boolean), [catalog, selectedIds]);
  const lowestPrice = selectedProducts.length ? Math.min(...selectedProducts.map((item) => Number(item.price) || 0)) : 0;

  const updateSelection = (nextIds) => {
    const next = nextIds.slice(0, MAX_COMPARE_ITEMS);
    setSelectedIds(next);
    writeStorage(COMPARE_STORAGE_KEY, next);
    if (next.length) setSearchParams({ items: next.join(",") });
    else setSearchParams({});
  };

  const removeProduct = (id) => updateSelection(selectedIds.filter((item) => item !== id));
  const clearComparison = () => updateSelection([]);

  const comparisonRows = [
    ["Price", (product) => formatPrice(product.price)],
    ["Material", (product) => product.material || "Not specified"],
    ["Size", (product) => product.size || "Not specified"],
    ["Delivery", (product) => product.delivery || "Confirmed on quote"],
    ["Minimum order", (product) => `${product.minOrder || 1} unit${Number(product.minOrder || 1) > 1 ? "s" : ""}`],
    ["Category", (product) => formatCategory(product.category)],
    ["Best for", (product) => product.useCase || "Events and recognition"],
    ["Finish", (product) => product.tag || product.badge || "Customizable"],
    ["Customization", () => "Text, logo and artwork proof"],
    ["Description", (product) => product.description || "No description added."],
  ];

  if (!selectedProducts.length) {
    return (
      <main className="commerce-page compare-page">
        <section className="compare-empty">
          <span>Product comparison</span>
          <h1>No products selected</h1>
          <p>Select products from the catalogue and use the compare checkbox to build a side-by-side comparison.</p>
          <Link to="/products">Browse products</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="commerce-page compare-page">
      <header className="compare-hero">
        <div>
          <span>Product comparison</span>
          <h1>Compare selected awards</h1>
          <p>Review price, finish, size, delivery and quantity requirements before opening the product for final customization.</p>
        </div>
        <div className="compare-hero-actions">
          <Link to="/products">Add more products</Link>
          <button type="button" onClick={clearComparison}>Clear comparison</button>
        </div>
      </header>

      <section className="compare-product-strip" style={{ "--compare-count": selectedProducts.length }}>
        {selectedProducts.map((product) => (
          <article className="compare-product-card" key={product.id}>
            <button type="button" onClick={() => removeProduct(product.id)} aria-label={`Remove ${product.name}`}>x</button>
            <div className="compare-product-image">
              {Number(product.price) === lowestPrice ? <span>Best value</span> : null}
              <img src={productImage(product)} alt={product.name} />
            </div>
            <div className="compare-product-copy">
              <small>{formatCategory(product.category)}</small>
              <h2>{product.name}</h2>
              <strong>{formatPrice(product.price)}</strong>
              <div>
                <Link to={`/products/${product.id}`}>View details</Link>
                <Link to={`/custom?product=${product.id}`}>Customize</Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="compare-board" aria-label="Detailed product comparison">
        {comparisonRows.map(([label, getValue]) => (
          <div className="compare-row" style={{ "--compare-count": selectedProducts.length }} key={label}>
            <div className="compare-row-label">{label}</div>
            {selectedProducts.map((product) => (
              <div className="compare-cell" key={`${product.id}-${label}`}>{getValue(product)}</div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
