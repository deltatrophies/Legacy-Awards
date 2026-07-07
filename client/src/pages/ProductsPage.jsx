import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/products/ProductCard.jsx";
import RecentlyViewed from "../components/products/RecentlyViewed.jsx";
import { categories, products as fallbackProducts } from "../data/products.js";
import { CATALOG_CHANGED_EVENT, CATALOG_CHANGED_STORAGE_KEY, catalogApi, categoryApi } from "../services/apiClient.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/commerce.css";

const categoryCopy = {
  all: "All Products",
  trophies: "Trophies",
  plaques: "Plaques",
  medals: "Medals",
  crystal: "Crystal Awards",
};

const categoryDescriptions = {
  all: "Browse the complete award catalogue.",
  trophies: "Classic and premium trophies for every stage.",
  plaques: "Formal recognition pieces for offices and institutions.",
  medals: "Bulk-friendly medals for schools, sports and events.",
  crystal: "Polished crystal awards for premium recognition.",
};

function formatCategory(value) {
  return categoryCopy[value] || String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("featured");
  const [wishlist, setWishlist] = useState(() => readStorage("wishlist", []));
  const [compare, setCompare] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [catalog, setCatalog] = useState(fallbackProducts);
  const [catalogCategories, setCatalogCategories] = useState(categories);

  const loadCatalog = () => {
    catalogApi.list().then((items) => { if (items.length) setCatalog(items); }).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    catalogApi.list().then((items) => { if (active && items.length) setCatalog(items); }).catch(() => {});
    categoryApi.list()
      .then((items) => {
        if (!active || !items.length) return;
        setCatalogCategories(["all", ...items.map((item) => item.slug || item.id)]);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === CATALOG_CHANGED_STORAGE_KEY) loadCatalog();
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, loadCatalog);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CATALOG_CHANGED_EVENT, loadCatalog);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const filtered = useMemo(() => {
    const result = catalog.filter((product) => {
      const text = `${product.name} ${product.tag} ${product.description} ${product.useCase}`.toLowerCase();
      const categoryMatch = category === "all" || product.category === category || text.includes(category);
      const priceMatch = price === "all" || (price === "under-1000" ? product.price < 1000 : price === "1000-2500" ? product.price >= 1000 && product.price <= 2500 : product.price > 2500);
      return categoryMatch && priceMatch && text.includes(query.toLowerCase());
    });
    return result.sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : a.name.localeCompare(b.name));
  }, [catalog, query, category, price, sort]);

  const suggestions = query.length > 1 ? catalog.filter((item) => `${item.name} ${item.tag} ${item.useCase}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5) : [];
  const toggleWishlist = (id) => setWishlist((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; writeStorage("wishlist", next); return next; });
  const toggleCompare = (id) => setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const compareProducts = compare.map((id) => catalog.find((item) => item.id === id)).filter(Boolean);
  const clearFilters = () => { setQuery(""); setCategory("all"); setPrice("all"); setSort("featured"); };
  const categoryCounts = useMemo(() => {
    const counts = new Map([["all", catalog.length]]);
    catalog.forEach((product) => counts.set(product.category, (counts.get(product.category) || 0) + 1));
    return counts;
  }, [catalog]);
  const hasActiveFilters = query || category !== "all" || price !== "all" || sort !== "featured";
  const activeCategoryName = formatCategory(category);

  return (
    <main className="commerce-page">
      <header className="catalog-hero">
        <div className="catalog-hero-copy">
          <span>Made for meaningful moments</span>
          <h1>Awards for every achievement</h1>
          <p>Explore premium trophies, plaques, medals and crystal awards with dependable customization and bulk pricing.</p>
          <div className="catalog-hero-actions">
            <a href="#catalog-products">Browse catalogue</a>
            <Link to="/custom">Build custom award</Link>
          </div>
        </div>
        <div className="catalog-hero-panel" aria-label="Catalogue highlights">
          <div><strong>{catalog.length}</strong><span>Products</span></div>
          <div><strong>{catalogCategories.length}</strong><span>Categories</span></div>
          <div><strong>3-10</strong><span>Day delivery</span></div>
        </div>
      </header>

      <section className="catalog-control-panel" aria-label="Product filters">
        <div className="catalog-control-head">
          <div>
            <span>Find the right award</span>
            <h2>{activeCategoryName}</h2>
            <p>{categoryDescriptions[category] || "Filtered catalogue results."}</p>
          </div>
          {hasActiveFilters ? <button type="button" onClick={clearFilters}>Clear filters</button> : null}
        </div>

        <section className="catalog-toolbar" aria-label="Search and sorting">
          <div className="search-box">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 150)} placeholder="Search gold, medal, school..." aria-label="Search products" />
            {searchFocused && suggestions.length > 0 && <div className="search-suggestions">{suggestions.map((item) => <Link key={item.id} to={`/products/${item.id}`}><img src={item.image} alt="" /><span>{item.name}<small>{item.tag}</small></span></Link>)}</div>}
          </div>
          <select value={price} onChange={(event) => setPrice(event.target.value)} aria-label="Price range"><option value="all">All prices</option><option value="under-1000">Under Rs. 1,000</option><option value="1000-2500">Rs. 1,000-2,500</option><option value="over-2500">Above Rs. 2,500</option></select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option></select>
        </section>

        <nav className="category-tabs" aria-label="Categories">
          {catalogCategories.map((item) => (
            <button type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>
              <span>{formatCategory(item)}</span>
              <strong>{categoryCounts.get(item) || 0}</strong>
            </button>
          ))}
        </nav>
      </section>

      <div className="result-line" id="catalog-products">
        <span>{filtered.length} products found</span>
        <span>{wishlist.length} saved</span>
      </div>
      {filtered.length ? <section className="catalog-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} wishlisted={wishlist.includes(product.id)} compared={compare.includes(product.id)} onWishlist={toggleWishlist} onCompare={toggleCompare} />)}</section> : <div className="catalog-empty"><h2>No matching awards</h2><p>Try a broader search or clear the current filters.</p><button onClick={clearFilters}>Clear filters</button></div>}
      <RecentlyViewed />
      {compareProducts.length > 0 && <aside className="compare-tray"><div><strong>Compare awards</strong><span>{compareProducts.length}/3 selected</span></div><div className="compare-items">{compareProducts.map((item) => <div key={item.id}><button onClick={() => toggleCompare(item.id)} aria-label={`Remove ${item.name}`}>x</button><strong>{item.name}</strong><span>{item.material}</span><span>{item.size}</span><span>Rs. {item.price.toLocaleString("en-IN")}</span><span>{item.delivery}</span></div>)}</div><button className="clear-compare" onClick={() => setCompare([])}>Clear</button></aside>}
    </main>
  );
}
