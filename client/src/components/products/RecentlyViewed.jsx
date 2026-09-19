import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { catalogApi } from "../../services/apiClient.js";
import { readStorage, writeStorage } from "../../utils/storage.js";

export default function RecentlyViewed({ exclude }) {
  const [catalog, setCatalog] = useState([]);
  const viewedIds = useMemo(() => readStorage("recentlyViewed", []).filter((id) => id !== exclude), [exclude]);
  const viewed = useMemo(() => viewedIds.map((id) => catalog.find((item) => item.id === id)).filter(Boolean).slice(0, 4), [catalog, viewedIds]);
  useEffect(() => {
    let active = true;
    catalogApi.list().then((items) => {
      if (!active) return;
      setCatalog(items || []);
      const validIds = new Set((items || []).map((item) => item.id));
      const stored = readStorage("recentlyViewed", []);
      const next = stored.filter((id) => validIds.has(id));
      if (next.length !== stored.length) writeStorage("recentlyViewed", next);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!viewed.length) return null;
  return (
    <section className="recent-section">
      <div className="section-heading"><div><span>Continue browsing</span><h2>Recently Viewed</h2></div></div>
      <div className="recent-grid">{viewed.map((item) => <Link to={`/products/${item.id}`} key={item.id}><img src={item.image} alt="" /><span>{item.name}</span><strong>{`Rs. ${item.price.toLocaleString("en-IN")}`}</strong></Link>)}</div>
    </section>
  );
}
