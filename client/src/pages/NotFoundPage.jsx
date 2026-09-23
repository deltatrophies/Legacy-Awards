import { Link } from "react-router-dom";
import Seo from "../components/common/Seo.jsx";
import "../styles/pages/commerce.css";

export default function NotFoundPage() {
  return (
    <main className="commerce-page catalog-empty">
      <Seo
        title="Page Not Found - Award Arts"
        description="The page you requested could not be found."
        path={window.location.pathname}
        robots="noindex,nofollow,noarchive"
      />
      <h1>Page not found</h1>
      <p>The link may be outdated, or the page may have moved.</p>
      <Link className="primary-command" to="/products">Browse awards</Link>
    </main>
  );
}
