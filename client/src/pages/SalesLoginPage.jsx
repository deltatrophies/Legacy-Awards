import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/pages/admin.css";

const allowedRoles = ["sales", "sales_manager", "staff", "admin"];

export default function SalesLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const devCredentials = import.meta.env.DEV ? {
    email: import.meta.env.VITE_DEV_SALES_EMAIL || "",
    password: import.meta.env.VITE_DEV_SALES_PASSWORD || "",
  } : null;
  const canFillDevLogin = Boolean(devCredentials?.email && devCredentials?.password);

  useEffect(() => { document.title = "Sales Login - Legacy Awards"; }, []);

  if (!loading && user && allowedRoles.includes(user.role)) {
    return <Navigate to={location.state?.from || "/sales/dashboard"} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form, { scope: "sales" });
      navigate(location.state?.from || "/sales/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Sales login failed. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-login-page sales-login-page">
      <section className="admin-login-panel" aria-labelledby="sales-login-title">
        <div className="admin-login-media">
          <Link to="/" className="admin-login-brand">Legacy Awards</Link>
          <img src="/images/hero.png" alt="Premium award display" />
        </div>
        <div className="admin-login-form-wrap">
          <p className="admin-eyebrow">Private sales workspace</p>
          <h1 id="sales-login-title">Sales Team Login</h1>
          <p className="admin-login-copy">Use your individual team account. Every assignment, quotation and payment action is recorded securely.</p>
          <form className="admin-login-form" onSubmit={submit}>
            <label><span>Email</span><input autoComplete="email" required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label><span>Password</span><input autoComplete="current-password" minLength="8" required type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
            {error ? <p className="admin-alert admin-alert-error" role="alert">{error}</p> : null}
            {import.meta.env.DEV && canFillDevLogin ? <button className="admin-dev-login-button" type="button" onClick={() => { setForm(devCredentials); setError(""); }}>Fill dev sales login</button> : null}
            <button className="admin-primary-button" disabled={submitting || loading} type="submit">{submitting ? "Checking..." : "Open sales workspace"}</button>
          </form>
          <Link className="admin-back-link" to="/">Back to website</Link>
        </div>
      </section>
    </main>
  );
}
