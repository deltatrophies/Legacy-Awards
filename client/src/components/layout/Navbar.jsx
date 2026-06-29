import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { navigationLinks } from "../../data/navigation.js";
import { BUSINESS_NAME } from "../../config/business.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { readStorage } from "../../utils/storage.js";
import "../../styles/layout/navbar.css";

function AccountIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" /></svg>;
}

function CartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>;
}

function MenuIcon({ type }) {
  if (type === "orders") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l2 4v14H5V7l2-4Z" /><path d="M5 7h14" /><path d="M9 11h6" /></svg>;
  if (type === "wishlist") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.8c-1.6-1.9-4.4-1.6-5.8.1L12 9.2 9 5.9C7.6 4.2 4.8 3.9 3.2 5.8c-1.7 2-1.4 5 .4 6.8L12 21l8.4-8.4c1.8-1.8 2.1-4.8.4-6.8Z" /></svg>;
  if (type === "logout") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7V5a2 2 0 0 0-2-2H5v18h8a2 2 0 0 0 2-2v-2" /><path d="M10 12h11" /><path d="m18 9 3 3-3 3" /></svg>;
  return <AccountIcon />;
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuId = useId();
  const accountMenuId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const accountRef = useRef(null);
  const { user, logout } = useAuth();
  const [cartQuantity, setCartQuantity] = useState(0);

  useEffect(() => {
    const updateCartQuantity = () => {
      const quantity = readStorage("cart", []).reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
      setCartQuantity(quantity);
    };
    updateCartQuantity();
    window.addEventListener("legacy-storage", updateCartQuantity);
    window.addEventListener("storage", updateCartQuantity);
    return () => {
      window.removeEventListener("legacy-storage", updateCartQuantity);
      window.removeEventListener("storage", updateCartQuantity);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return undefined;

    const onPointerDown = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <nav className="site-nav" data-menu-open={menuOpen ? "true" : "false"}>
      <NavLink to="/" className="logo" aria-label={`${BUSINESS_NAME} home`}>
        Legacy <span>Awards</span>
      </NavLink>

      <ul className="nav-links">
        {navigationLinks.map((item) => (
          <li key={item.path}>
            <NavLink to={item.path} end={item.path === "/"}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="nav-actions">
        <NavLink to="/contact" className="nav-btn">Get a Quote</NavLink>
        <NavLink className="nav-icon-link cart-link" to="/cart" aria-label={`Cart with ${cartQuantity} items`} title="Cart">
          <CartIcon />
          {cartQuantity > 0 && <span className="cart-count">{cartQuantity > 99 ? "99+" : cartQuantity}</span>}
        </NavLink>
        <div className="account-menu-wrap" ref={accountRef}>
          {user ? (
            <>
              <button className="nav-icon-link account-link" type="button" aria-label={`Open account menu for ${user.firstName}`} aria-controls={accountMenuId} aria-expanded={accountOpen} title={`Signed in as ${user.firstName}`} onClick={() => setAccountOpen((open) => !open)}>
                {user.avatarUrl ? <img className="nav-profile-photo" src={user.avatarUrl} alt="" /> : <AccountIcon />}
                <span className="account-status" />
              </button>
              <div className="account-dropdown" id={accountMenuId} data-open={accountOpen ? "true" : "false"}>
                <div className="account-card-head">
                  <div className="account-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.firstName?.[0] || "U")}</div>
                  <div><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div>
                </div>
                <div className="account-divider" />
                <NavLink to="/account/profile"><MenuIcon />My Profile</NavLink>
                <NavLink to="/account/orders"><MenuIcon type="orders" />My Orders</NavLink>
                <NavLink to="/account/wishlist"><MenuIcon type="wishlist" />Wishlist</NavLink>
                <div className="account-divider" />
                <button type="button" className="account-logout" onClick={handleLogout}><MenuIcon type="logout" />Logout</button>
              </div>
            </>
          ) : (
            <NavLink className="nav-icon-link account-link" to="/login" aria-label="Log in or create account" title="Login">
              <AccountIcon />
            </NavLink>
          )}
        </div>
      </div>

      <button
        type="button"
        className="menu-toggle"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls={menuId}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <button
        type="button"
        className="mobile-menu-backdrop"
        aria-label="Close navigation menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />

      <div className="mobile-menu" id={menuId}>
        <div className="mobile-menu-head">
          <span>Menu</span>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu">
            Close
          </button>
        </div>

        <ul>
          {navigationLinks.map((item) => (
            <li key={item.path}>
              <NavLink to={item.path} end={item.path === "/"}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mobile-menu-actions">
          <NavLink to={user ? "/account/profile" : "/login"}>{user?.avatarUrl ? <img className="mobile-profile-photo" src={user.avatarUrl} alt="" /> : <AccountIcon />}{user ? "My Profile" : "Login / Sign up"}</NavLink>
          {user && <NavLink to="/account/orders"><MenuIcon type="orders" />My Orders</NavLink>}
          {user && <NavLink to="/account/wishlist"><MenuIcon type="wishlist" />Wishlist</NavLink>}
          <NavLink to="/cart"><CartIcon />My Cart {cartQuantity > 0 && `(${cartQuantity})`}</NavLink>
          <NavLink to="/contact" className="mobile-quote-btn">Get a Quote</NavLink>
          {user && <button type="button" className="mobile-logout-btn" onClick={handleLogout}><MenuIcon type="logout" />Logout</button>}
        </div>
      </div>
    </nav>
  );
}

