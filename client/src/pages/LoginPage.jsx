import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthBackgroundArt from "../components/auth/AuthBackgroundArt.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import css from "../styles/pages/login.css?raw";
import { usePageStyle } from "../hooks/usePageStyle.js";

export default function LoginPage() {
  usePageStyle("login", css);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", acceptedTerms: false });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const passwordMeetsPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(form.password);

  const getErrorMessage = (requestError) => {
    if (Array.isArray(requestError.details) && requestError.details.length > 0) {
      return requestError.details.map((detail) => detail.message).join(" ");
    }
    return requestError.message || "Authentication failed. Please try again.";
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      if (isLogin) await login({ email: form.email, password: form.password }, { scope: "customer" });
      else {
        if (!passwordMeetsPolicy) {
          setError("Password must be 8+ characters and include uppercase, lowercase, and a number.");
          return;
        }
        await register(form);
      }
      navigate(location.state?.from || "/products", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally { setSubmitting(false); }
  };

  return (
    <main className="legacy-page legacy-page-login">
      <AuthBackgroundArt />
      <div className="backdrop-blur-overlay" />
      <div className="card">
        <div className="left-panel">
          <Link className="auth-brand" to="/">Legacy Awards</Link>
          <div className="award-photo"><img src="/images/hero.png" alt="Gold trophy and crystal awards" /></div>
          <div className="auth-proof"><span>Premium awards</span><strong>Since 2001</strong></div>
        </div>
        <div className="right-panel">
          <button className="back-btn" type="button" onClick={() => navigate(-1)} aria-label="Go back">←</button>
          <h1 className="form-title">{isLogin ? "Welcome Back" : "Create an Account"}</h1>
          <p className="form-subtitle">
            {isLogin ? "New to Legacy Awards? " : "Already have an account? "}
            <button type="button" className="auth-switch" onClick={() => { setIsLogin(!isLogin); setError(""); }}>{isLogin ? "Create account" : "Log in"}</button>
          </p>
          <form id="signupForm" className={isLogin ? "auth-login" : ""} onSubmit={submit}>
            {!isLogin && <div className="field-row signup-only">
              <div className="field-group"><label htmlFor="firstName">First Name</label><input type="text" id="firstName" placeholder="First name" value={form.firstName} onChange={(event) => set("firstName", event.target.value)} autoComplete="given-name" required /></div>
              <div className="field-group"><label htmlFor="lastName">Last Name</label><input type="text" id="lastName" placeholder="Last name" value={form.lastName} onChange={(event) => set("lastName", event.target.value)} autoComplete="family-name" required /></div>
            </div>}
            <div className="field-full"><label htmlFor="email">Email Address</label><input type="email" id="email" placeholder="you@example.com" value={form.email} onChange={(event) => set("email", event.target.value)} autoComplete="email" required /></div>
            <div className="field-full"><label htmlFor="password">Password</label><div className="password-wrapper"><input type={showPassword ? "text" : "password"} id="password" placeholder={isLogin ? "Enter your password" : "Uppercase, lowercase & number"} value={form.password} onChange={(event) => set("password", event.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} minLength="8" required /><button type="button" className="eye-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? "Hide" : "Show"}</button></div>{!isLogin && <p className={`password-hint ${form.password && passwordMeetsPolicy ? "valid" : ""}`}>Use 8+ characters with uppercase, lowercase, and a number.</p>}</div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="btn-create" disabled={submitting}>{submitting ? "Please wait..." : isLogin ? "Log In" : "Create Account"}</button>
            {!isLogin && <div className="terms-row signup-only"><input type="checkbox" id="terms" checked={form.acceptedTerms} onChange={(event) => set("acceptedTerms", event.target.checked)} required /><label htmlFor="terms">I agree to the <Link to="/privacy">Terms &amp; Conditions</Link></label></div>}
          </form>
        </div>
      </div>
    </main>
  );
}
