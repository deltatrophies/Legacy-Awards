import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PageSkeleton from "../components/common/PageSkeleton.jsx";
import SiteLayout from "../layouts/SiteLayout.jsx";

const HomePage = lazy(() => import("../pages/HomePage.jsx"));
const AboutPage = lazy(() => import("../pages/AboutPage.jsx"));
const ProductsPage = lazy(() => import("../pages/ProductsPage.jsx"));
const ProductDetailPage = lazy(() => import("../pages/ProductDetailPage.jsx"));
const CustomPage = lazy(() => import("../pages/CustomPage.jsx"));
const BlogsPage = lazy(() => import("../pages/BlogsPage.jsx"));
const ContactPage = lazy(() => import("../pages/ContactPage.jsx"));
const CartPage = lazy(() => import("../pages/CartPage.jsx"));
const PrivacyPage = lazy(() => import("../pages/PrivacyPage.jsx"));
const ReturnsPage = lazy(() => import("../pages/ReturnsPage.jsx"));
const ShippingPage = lazy(() => import("../pages/ShippingPage.jsx"));
const LoginPage = lazy(() => import("../pages/LoginPage.jsx"));
const QuoteSuccessPage = lazy(() => import("../pages/QuoteSuccessPage.jsx"));
const ProfilePage = lazy(() => import("../pages/ProfilePage.jsx"));
const OrdersPage = lazy(() => import("../pages/OrdersPage.jsx"));
const WishlistPage = lazy(() => import("../pages/WishlistPage.jsx"));
const AdminLoginPage = lazy(() => import("../pages/AdminLoginPage.jsx"));
const AdminPanelPage = lazy(() => import("../pages/AdminPanelPage.jsx"));

function SitePage({ children }) {
  return <SiteLayout>{children}</SiteLayout>;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<SiteLayout><PageSkeleton /></SiteLayout>}>
      <Routes>
        <Route path="/" element={<SitePage><HomePage /></SitePage>} />
        <Route path="/about" element={<SitePage><AboutPage /></SitePage>} />
        <Route path="/products" element={<SitePage><ProductsPage /></SitePage>} />
        <Route path="/products/:slug" element={<SitePage><ProductDetailPage /></SitePage>} />
        <Route path="/product-detail" element={<Navigate to="/products/gold-prestige-trophy" replace />} />
        <Route path="/custom" element={<SitePage><CustomPage /></SitePage>} />
        <Route path="/blogs" element={<SitePage><BlogsPage /></SitePage>} />
        <Route path="/contact" element={<SitePage><ContactPage /></SitePage>} />
        <Route path="/cart" element={<SitePage><CartPage /></SitePage>} />
        <Route path="/quote-success" element={<SitePage><QuoteSuccessPage /></SitePage>} />
        <Route path="/privacy" element={<SitePage><PrivacyPage /></SitePage>} />
        <Route path="/returns" element={<SitePage><ReturnsPage /></SitePage>} />
        <Route path="/shipping" element={<SitePage><ShippingPage /></SitePage>} />
        <Route path="/login" element={<SitePage><LoginPage /></SitePage>} />
        <Route path="/account/profile" element={<SitePage><ProfilePage /></SitePage>} />
        <Route path="/account/orders" element={<SitePage><OrdersPage /></SitePage>} />
        <Route path="/account/wishlist" element={<SitePage><WishlistPage /></SitePage>} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/:section/:detailType/:detailId" element={<AdminPanelPage />} />
        <Route path="/admin/:section" element={<AdminPanelPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
