import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import PageSkeleton from "../components/common/PageSkeleton.jsx";
import SiteLayout from "../layouts/SiteLayout.jsx";
import { NoIndexSeo } from "../components/common/Seo.jsx";

const loadHomePage = () => import("../pages/HomePage.jsx");
const loadAboutPage = () => import("../pages/AboutPage.jsx");
const loadProductsPage = () => import("../pages/ProductsPage.jsx");
const loadCustomPage = () => import("../pages/CustomPage.jsx");
const loadBlogsPage = () => import("../pages/BlogsPage.jsx");
const loadContactPage = () => import("../pages/ContactPage.jsx");

const HomePage = lazy(loadHomePage);
const AboutPage = lazy(loadAboutPage);
const ProductsPage = lazy(loadProductsPage);
const ComparePage = lazy(() => import("../pages/ComparePage.jsx"));
const ProductDetailPage = lazy(() => import("../pages/ProductDetailPage.jsx"));
const CustomPage = lazy(loadCustomPage);
const BlogsPage = lazy(loadBlogsPage);
const ContactPage = lazy(loadContactPage);
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
const SalesLoginPage = lazy(() => import("../pages/SalesLoginPage.jsx"));
const SalesPanelPage = lazy(() => import("../pages/SalesPanelPage.jsx"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage.jsx"));

const pageTransition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1],
};

const primaryPublicPageLoaders = [
  loadAboutPage,
  loadProductsPage,
  loadCustomPage,
  loadBlogsPage,
  loadContactPage,
];

function PageMotion({ children }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="page-motion-shell"
      initial={reduceMotion ? false : { opacity: 0.995, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : pageTransition}
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
            <Route path="/products/category/:categorySlug" element={<PageMotion><ProductsPage /></PageMotion>} />
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
            <Route path="*" element={<PageMotion><NotFoundPage /></PageMotion>} />
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

function SalesRoutes({ location }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnimatePresence initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/sales" element={<Navigate to="/sales/dashboard" replace />} />
          <Route path="/sales/login" element={<AdminPage><SalesLoginPage /></AdminPage>} />
          <Route path="/sales/:section/:detailType/:detailId" element={<AdminPage><SalesPanelPage /></AdminPage>} />
          <Route path="/sales/:section/:detailId" element={<AdminPage><SalesPanelPage /></AdminPage>} />
          <Route path="/sales/:section" element={<AdminPage><SalesPanelPage /></AdminPage>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

export default function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const preloadPrimaryPages = () => {
      primaryPublicPageLoaders.forEach((loadPage) => {
        loadPage().catch(() => undefined);
      });
    };

    const timeoutId = window.setTimeout(preloadPrimaryPages, 120);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isSalesRoute = location.pathname.startsWith("/sales");
  const isPrivateRoute = isAdminRoute || isSalesRoute || ["/login", "/cart", "/compare", "/quote-success", "/account"].some((path) => location.pathname.startsWith(path));
  if (isAdminRoute) return <><NoIndexSeo title="Award Arts Admin" /><AdminRoutes location={location} /></>;
  if (isSalesRoute) return <><NoIndexSeo title="Award Arts Sales" /><SalesRoutes location={location} /></>;
  return <>{isPrivateRoute ? <NoIndexSeo /> : null}<PublicRoutes location={location} /></>;
}
