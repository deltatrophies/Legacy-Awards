import { useMemo, useState } from "react";
import "../../styles/components/home-experience.css";

const occasions = [
  ["Annual Day", "Academic trophies, medals, and student recognition sets.", "/products"],
  ["Corporate Awards", "Executive trophies, crystal awards, plaques, and bulk name plates.", "/products"],
  ["Sports Tournament", "Cups, medals, shield trophies, and category-wise winner sets.", "/products"],
  ["Employee Recognition", "Monthly, quarterly, and annual award kits for teams.", "/custom"],
  ["Retirement Gift", "Premium mementos, plaques, and personalized appreciation pieces.", "/products"],
  ["School Competition", "Budget-friendly medals, trophies, and custom event branding.", "/custom"],
];

const gallery = [
  ["Corporate gold trophies", "/images/shopping.jpg"],
  ["Academic medals", "/images/medals.jpg"],
  ["Crystal award set", "/images/crystal.jpg"],
  ["Wooden plaques", "/images/plaques.jpg"],
];

function formatMoney(value) {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

export default function HomeExperience() {
  const [quantity, setQuantity] = useState(100);
  const [basePrice, setBasePrice] = useState(850);

  const quote = useMemo(() => {
    const discountRate = quantity >= 500 ? 0.2 : quantity >= 250 ? 0.16 : quantity >= 100 ? 0.1 : quantity >= 50 ? 0.08 : 0;
    const perPiece = basePrice * (1 - discountRate);
    return {
      discountRate,
      perPiece,
      total: perPiece * quantity,
      savings: basePrice * quantity - perPiece * quantity,
    };
  }, [basePrice, quantity]);

  return (
    <section className="home-experience" aria-label="Customer tools">
      <div className="home-tool-grid">
        <div className="bulk-calculator">
          <div className="section-kicker">Bulk Order Calculator</div>
          <h2>Estimate your event award budget before asking for a quote.</h2>
          <div className="calc-controls">
            <label>
              Quantity
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
            </label>
            <label>
              Base price per piece
              <input type="number" min="1" value={basePrice} onChange={(event) => setBasePrice(Math.max(1, Number(event.target.value) || 1))} />
            </label>
          </div>
          <div className="calc-result">
            <div><span>Estimated per piece</span><strong>{formatMoney(quote.perPiece)}</strong></div>
            <div><span>Bulk discount</span><strong>{Math.round(quote.discountRate * 100)}%</strong></div>
            <div><span>Estimated total</span><strong>{formatMoney(quote.total)}</strong></div>
            <div><span>Estimated savings</span><strong>{formatMoney(quote.savings)}</strong></div>
          </div>
          <a href="/custom" className="tool-cta">Build Custom Trophy</a>
        </div>

        <div className="occasion-shop">
          <div className="section-kicker">Occasion-Based Shopping</div>
          <h2>Shop by the event you are planning.</h2>
          <div className="occasion-grid">
            {occasions.map(([title, text, href]) => (
              <a href={href} className="occasion-card" key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="gallery-section">
        <div>
          <div className="section-kicker">Customer Gallery</div>
          <h2>Real award styles customers often request.</h2>
        </div>
        <div className="gallery-grid">
          {gallery.map(([title, src]) => (
            <figure className="gallery-card" key={title}>
              <img src={src} alt={title} />
              <figcaption>{title}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
