import Footer from "../components/layout/Footer.jsx";
import Navbar from "../components/layout/Navbar.jsx";
import WhatsAppCTA from "../components/common/WhatsAppCTA.jsx";

export default function SiteLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <WhatsAppCTA />
      <Footer />
    </>
  );
}
