import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/pages/admin.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Admin Login - Legacy Awards";
  }, []);

  if (!loading && user?.role === "admin") {
    return <Navigate to={location.state?.from || "/admin/dashboard"} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form, { scope: "admin" });
      navigate(location.state?.from || "/admin/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Admin login failed. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-labelledby="admin-login-title">
        <div className="admin-login-media">
          <Link to="/" className="admin-login-brand">Legacy Awards</Link>
          <img src="/images/hero.png" alt="Premium award display" />
        </div>
        <div className="admin-login-form-wrap">
          <p className="admin-eyebrow">Secure admin area</p>
          <h1 id="admin-login-title">Admin Login</h1>
          <p className="admin-login-copy">Use your administrator account to manage products, categories, inquiries, orders and store settings.</p>
          <form className="admin-login-form" onSubmit={submit}>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={form.email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                minLength="8"
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
                type="password"
                value={form.password}
              />
            </label>
            {error ? <p className="admin-alert admin-alert-error" role="alert">{error}</p> : null}
            <button className="admin-primary-button" disabled={submitting || loading} type="submit">
              {submitting ? "Checking..." : "Log in to admin"}
            </button>
          </form>
          <Link className="admin-back-link" to="/">Back to website</Link>
        </div>
      </section>
    </main>
  );
}
