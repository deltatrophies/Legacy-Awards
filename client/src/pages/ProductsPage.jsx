import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductCard from "../components/products/ProductCard.jsx";
import RecentlyViewed from "../components/products/RecentlyViewed.jsx";
import { CATALOG_CHANGED_EVENT, CATALOG_CHANGED_STORAGE_KEY, catalogApi, categoryApi } from "../services/apiClient.js";
import { formatPrice } from "../utils/formatPrice.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/commerce.css";

const COMPARE_STORAGE_KEY = "compareProducts";
const PAGE_SIZE = 24;

function formatCategory(value) {
  if (value === "all") return "All Products";
  return String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const category = searchParams.get("category") || "all";
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("featured");
  const [wishlist, setWishlist] = useState(() => readStorage("wishlist", []));
  const [compare, setCompare] = useState(() => readStorage(COMPARE_STORAGE_KEY, []).slice(0, 3));
  const [searchFocused, setSearchFocused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    document.title = "Products - Legacy Awards";
  }, []);

  const applyCatalog = (products, categoryItems) => {
    const nextProducts = products || [];
    const validIds = new Set(nextProducts.map((item) => item.id));
    setCatalog(nextProducts);
    setCatalogCategories(categoryItems || []);
    setCategoriesLoaded(true);
    setWishlist((current) => {
      const next = current.filter((id) => validIds.has(id));
      if (next.length !== current.length) writeStorage("wishlist", next);
      return next;
    });
    setCompare((current) => {
      const next = current.filter((id) => validIds.has(id));
      if (next.length !== current.length) writeStorage(COMPARE_STORAGE_KEY, next);
      return next;
    });
    const recent = readStorage("recentlyViewed", []);
    const validRecent = recent.filter((id) => validIds.has(id));
    if (validRecent.length !== recent.length) writeStorage("recentlyViewed", validRecent);
  };

  const loadCatalog = () => Promise.all([catalogApi.list(), categoryApi.list()])
    .then(([products, categoryItems]) => applyCatalog(products, categoryItems))
    .catch(() => {});

  useEffect(() => {
    let active = true;
    Promise.all([catalogApi.list(), categoryApi.list()])
      .then(([products, categoryItems]) => {
        if (!active) return;
        applyCatalog(products, categoryItems);
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
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleProducts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setCurrentPage(1); }, [query, category, price, sort]);
  useEffect(() => { if (currentPage > pageCount) setCurrentPage(pageCount); }, [currentPage, pageCount]);
  const toggleWishlist = (id) => setWishlist((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; writeStorage("wishlist", next); return next; });
  const updateCompare = (updater) => setCompare((current) => {
    const next = updater(current).slice(0, 3);
    writeStorage(COMPARE_STORAGE_KEY, next);
    return next;
  });
  const toggleCompare = (id) => updateCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const changePage = (nextPage) => {
    setCurrentPage(nextPage);
    window.requestAnimationFrame(() => {
      document.getElementById("catalog-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const selectCategory = (nextCategory) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextCategory === "all") nextParams.delete("category");
    else nextParams.set("category", nextCategory);
    setSearchParams(nextParams);
  };
  useEffect(() => {
    if (!categoriesLoaded || category === "all") return;
    const exists = catalogCategories.some((item) => (item.slug || item.id) === category);
    if (!exists) selectCategory("all");
  }, [catalogCategories, categoriesLoaded, category]);
  const compareProducts = compare.map((id) => catalog.find((item) => item.id === id)).filter(Boolean);
  const compareHref = `/compare?items=${compareProducts.map((item) => encodeURIComponent(item.id)).join(",")}`;
  const clearFilters = () => { setQuery(""); selectCategory("all"); setPrice("all"); setSort("featured"); };
  const categoryCounts = useMemo(() => {
    const counts = new Map([["all", catalog.length]]);
    catalog.forEach((product) => counts.set(product.category, (counts.get(product.category) || 0) + 1));
    return counts;
  }, [catalog]);
  const hasActiveFilters = query || category !== "all" || price !== "all" || sort !== "featured";
  const activeCategory = catalogCategories.find((item) => (item.slug || item.id) === category);
  const activeCategoryName = category === "all" ? "All Products" : activeCategory?.name || formatCategory(category);

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
            <p>{category === "all" ? "Browse the complete award catalogue." : activeCategory?.description || "Filtered catalogue results."}</p>
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
          {[{ slug: "all", name: "All Products" }, ...catalogCategories].map((item) => {
            const key = item.slug || item.id;
            return (
            <button type="button" className={category === key ? "active" : ""} onClick={() => selectCategory(key)} key={key}>
              <span>{item.name || formatCategory(key)}</span>
              <strong>{categoryCounts.get(key) || 0}</strong>
            </button>
          ); })}
        </nav>
      </section>

      <div className="result-line" id="catalog-products">
        <span>{filtered.length} products found</span>
        <span>{wishlist.length} saved</span>
      </div>
      {filtered.length ? <section className="catalog-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} wishlisted={wishlist.includes(product.id)} compared={compare.includes(product.id)} onWishlist={toggleWishlist} onCompare={toggleCompare} />)}</section> : <div className="catalog-empty"><h2>{catalog.length ? "No matching awards" : "Catalogue is currently empty"}</h2><p>{catalog.length ? "Try a broader search or clear the current filters." : "New products added from the admin panel will appear here automatically."}</p>{catalog.length ? <button onClick={clearFilters}>Clear filters</button> : null}</div>}
      {pageCount > 1 ? <nav className="catalog-pagination" aria-label="Product pages">
        <button type="button" disabled={currentPage === 1} onClick={() => changePage(Math.max(1, currentPage - 1))}>Previous</button>
        <span>Page {currentPage} of {pageCount}</span>
        <button type="button" disabled={currentPage === pageCount} onClick={() => changePage(Math.min(pageCount, currentPage + 1))}>Next</button>
      </nav> : null}
      <RecentlyViewed />
      {compareProducts.length > 0 && <aside className="compare-tray">
        <div><strong>Compare awards</strong><span>{compareProducts.length}/3 selected</span></div>
        <div className="compare-items">{compareProducts.map((item) => <div key={item.id}><button onClick={() => toggleCompare(item.id)} aria-label={`Remove ${item.name}`}>x</button><strong>{item.name}</strong><span>{item.material}</span><span>{item.size}</span><span>{formatPrice(item.price)}</span><span>{item.delivery}</span></div>)}</div>
        <div className="compare-tray-actions">
          <Link className="compare-open" to={compareHref}>Open comparison</Link>
          <button className="clear-compare" onClick={() => updateCompare(() => [])}>Clear</button>
        </div>
      </aside>}
    </main>
  );
}
