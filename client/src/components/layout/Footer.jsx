import { Link } from "react-router-dom";
import { policyLinks } from "../../data/navigation.js";
import { BUSINESS_NAME } from "../../config/business.js";
import "../../styles/layout/footer.css";

function FooterIcon({ type }) {
  const icons = {
    trophy: <><path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /><path d="M12 12v5" /><path d="M8 20h8" /><path d="M9 17h6" /></>,
    plaque: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
    medal: <><path d="m8 3 4 6 4-6" /><path d="M9 3h6" /><circle cx="12" cy="15" r="5" /><path d="m10.5 15 1 1 2-2" /></>,
    crystal: <><path d="M12 3 4 10l8 11 8-11-8-7Z" /><path d="M4 10h16" /><path d="m9 10 3 11 3-11" /><path d="m8 3 1 7" /><path d="m16 3-1 7" /></>,
    design: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 8 2 2" /></>,
    bulk: <><rect x="4" y="5" width="7" height="7" rx="1" /><rect x="13" y="5" width="7" height="7" rx="1" /><rect x="4" y="14" width="7" height="5" rx="1" /><rect x="13" y="14" width="7" height="5" rx="1" /></>,
    engrave: <><path d="M4 19h16" /><path d="M7 16l5-12 5 12" /><path d="M9 12h6" /></>,
    delivery: <><path d="M3 7h11v10H3V7Z" /><path d="M14 10h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="18" cy="18" r="1.8" /></>,
    privacy: <><path d="M12 3 5 6v5c0 4.5 2.9 7.8 7 10 4.1-2.2 7-5.5 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.4-3.7" /></>,
    returns: <><path d="M8 7H5v-3" /><path d="M5 7a8 8 0 1 1 1.6 10.6" /><path d="M12 8v5l3 2" /></>,
    shipping: <><path d="M3 8h10v8H3V8Z" /><path d="M13 10h4l4 4v2h-8" /><path d="M6 18h.1" /><path d="M17 18h.1" /></>,
  };

  return (
    <svg className="footer-link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {icons[type] || icons.trophy}
    </svg>
  );
}

function FooterLink({ icon, to, children }) {
  return (
    <li>
      <Link to={to}>
        <FooterIcon type={icon} />
        <span>{children}</span>
      </Link>
    </li>
  );
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <div className="footer-logo">
            Legacy <span>Awards</span>
          </div>
          <p className="footer-about">
            Thoughtfully crafted trophies, medals, plaques and custom awards for
            schools, corporates, institutions and milestone events across India.
          </p>
        </div>
        <div>
          <div className="footer-col-head">Explore Awards</div>
          <ul className="footer-link-list">
            <FooterLink icon="trophy" to="/products">Signature Trophies</FooterLink>
            <FooterLink icon="plaque" to="/products">Premium Plaques</FooterLink>
            <FooterLink icon="medal" to="/products">Medals & Badges</FooterLink>
            <FooterLink icon="crystal" to="/products">Crystal Recognition</FooterLink>
          </ul>
        </div>
        <div>
          <div className="footer-col-head">Make It Yours</div>
          <ul className="footer-link-list">
            <FooterLink icon="design" to="/custom">Design a Custom Award</FooterLink>
            <FooterLink icon="bulk" to="/contact">Plan a Bulk Order</FooterLink>
            <FooterLink icon="engrave" to="/custom">Add Logo & Engraving</FooterLink>
            <FooterLink icon="delivery" to="/contact">Discuss Urgent Delivery</FooterLink>
          </ul>
        </div>
        <div>
          <div className="footer-col-head">Order Confidence</div>
          <ul className="footer-link-list">
            {policyLinks.map((item) => {
              const icon = item.path.includes("privacy") ? "privacy" : item.path.includes("returns") ? "returns" : "shipping";
              return <FooterLink icon={icon} key={item.path} to={item.path}>{item.label}</FooterLink>;
            })}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">&copy; 2026 {BUSINESS_NAME}. Crafted for meaningful recognition.</div>
        <div className="footer-tagline">Awards that feel earned, kept and remembered.</div>
      </div>
    </footer>
  );
}
