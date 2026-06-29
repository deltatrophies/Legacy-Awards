import { Link } from "react-router-dom";
import { policyLinks } from "../../data/navigation.js";
import { BUSINESS_NAME } from "../../config/business.js";
import "../../styles/layout/footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <div className="footer-logo">
            Legacy <span>Awards</span>
          </div>
          <p className="footer-about">
            Premium trophy and award manufacturers trusted by schools, corporates,
            and institutions across India since 2001.
          </p>
        </div>
        <div>
          <div className="footer-col-head">Products</div>
          <ul className="footer-link-list">
            <li><Link to="/products">Trophies</Link></li>
            <li><Link to="/products">Plaques</Link></li>
            <li><Link to="/products">Medals</Link></li>
            <li><Link to="/products">Crystal Awards</Link></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-head">Services</div>
          <ul className="footer-link-list">
            <li><Link to="/custom">Custom Design</Link></li>
            <li><Link to="/contact">Bulk Orders</Link></li>
            <li><Link to="/custom">Engraving</Link></li>
            <li><Link to="/contact">Express Delivery</Link></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-head">Policies</div>
          <ul className="footer-link-list">
            {policyLinks.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">&copy; 2026 {BUSINESS_NAME}. All rights reserved.</div>
        <div className="footer-tagline">Where Stone meets Gold meets Glory</div>
      </div>
    </footer>
  );
}
