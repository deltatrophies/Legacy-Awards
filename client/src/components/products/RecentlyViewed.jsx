import { useMemo } from "react";
import { Link } from "react-router-dom";
import { products } from "../../data/products.js";
import { readStorage } from "../../utils/storage.js";

export default function RecentlyViewed({ exclude }) {
  const viewed = useMemo(() => readStorage("recentlyViewed", []).filter((id) => id !== exclude).map((id) => products.find((item) => item.id === id)).filter(Boolean).slice(0, 4), [exclude]);
  if (!viewed.length) return null;
  return (
    <section className="recent-section">
      <div className="section-heading"><div><span>Continue browsing</span><h2>Recently Viewed</h2></div></div>
      <div className="recent-grid">{viewed.map((item) => <Link to={`/products/${item.id}`} key={item.id}><img src={item.image} alt="" /><span>{item.name}</span><strong>{`Rs. ${item.price.toLocaleString("en-IN")}`}</strong></Link>)}</div>
    </section>
  );
}
