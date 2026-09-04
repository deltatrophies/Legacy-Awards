import { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import PageSkeleton from "../components/common/PageSkeleton.jsx";
import SiteLayout from "../layouts/SiteLayout.jsx";

const HomePage = lazy(() => import("../pages/HomePage.jsx"));
const AboutPage = lazy(() => import("../pages/AboutPage.jsx"));
const ProductsPage = lazy(() => import("../pages/ProductsPage.jsx"));
const ComparePage = lazy(() => import("../pages/ComparePage.jsx"));
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
const EnquiriesPage = lazy(() => import("../pages/EnquiriesPage.jsx"));
const WishlistPage = lazy(() => import("../pages/WishlistPage.jsx"));
const AdminLoginPage = lazy(() => import("../pages/AdminLoginPage.jsx"));
const AdminPanelPage = lazy(() => import("../pages/AdminPanelPage.jsx"));

const pageTransition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

function PageMotion({ children }) {
  return (
    <motion.div
      className="page-motion-shell"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 1, y: 0 }}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

function AdminPage({ children }) {
  return <PageMotion>{children}</PageMotion>;
}

function PublicRoutes({ location }) {
  return (
    <SiteLayout>
      <Suspense fallback={<PageSkeleton />}>
        <AnimatePresence initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageMotion><HomePage /></PageMotion>} />
            <Route path="/about" element={<PageMotion><AboutPage /></PageMotion>} />
            <Route path="/products" element={<PageMotion><ProductsPage /></PageMotion>} />
            <Route path="/compare" element={<PageMotion><ComparePage /></PageMotion>} />
            <Route path="/products/:slug" element={<PageMotion><ProductDetailPage /></PageMotion>} />
            <Route path="/product-detail" element={<Navigate to="/products/gold-prestige-trophy" replace />} />
            <Route path="/custom" element={<PageMotion><CustomPage /></PageMotion>} />
            <Route path="/blogs" element={<PageMotion><BlogsPage /></PageMotion>} />
            <Route path="/contact" element={<PageMotion><ContactPage /></PageMotion>} />
            <Route path="/cart" element={<PageMotion><CartPage /></PageMotion>} />
            <Route path="/quote-success" element={<PageMotion><QuoteSuccessPage /></PageMotion>} />
            <Route path="/privacy" element={<PageMotion><PrivacyPage /></PageMotion>} />
            <Route path="/returns" element={<PageMotion><ReturnsPage /></PageMotion>} />
            <Route path="/shipping" element={<PageMotion><ShippingPage /></PageMotion>} />
            <Route path="/login" element={<PageMotion><LoginPage /></PageMotion>} />
            <Route path="/account/profile" element={<PageMotion><ProfilePage /></PageMotion>} />
            <Route path="/account/orders" element={<PageMotion><OrdersPage /></PageMotion>} />
            <Route path="/account/enquiries" element={<PageMotion><EnquiriesPage /></PageMotion>} />
            <Route path="/account/wishlist" element={<PageMotion><WishlistPage /></PageMotion>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </SiteLayout>
  );
}

function AdminRoutes({ location }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnimatePresence initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/login" element={<AdminPage><AdminLoginPage /></AdminPage>} />
          <Route path="/admin/:section/:detailType/:detailId" element={<AdminPage><AdminPanelPage /></AdminPage>} />
          <Route path="/admin/:section" element={<AdminPage><AdminPanelPage /></AdminPage>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

export default function AppRoutes() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");            
  return isAdminRoute ? <AdminRoutes location={location} /> : <PublicRoutes location={location} />;
}


