import { formatPrice } from "../../data/products.js";

export default function PriceBreakdown({ pricing }) {
  return <div className="price-breakdown"><h3>Price breakdown</h3>{pricing.lines.map((line) => <div key={line.label}><span>{line.label}</span><strong>{formatPrice(line.value)}</strong></div>)}<div className="discount-line"><span>Bulk discount ({pricing.discountRate}%)</span><strong>-{formatPrice(pricing.discount)}</strong></div><div className="price-total"><span>Total estimate</span><strong>{formatPrice(pricing.total)}</strong></div><small>{formatPrice(pricing.perPiece)} per piece for {pricing.quantity} units</small></div>;
}
