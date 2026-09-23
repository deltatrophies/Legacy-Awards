import ContentPage from "../components/content/ContentPage.jsx";
import HomeExperience from "../components/home/HomeExperience.jsx";
import html from "../content/pages/home.html?raw";
import script from "../content/scripts/home.js?raw";
import css from "../styles/pages/home.css?raw";
import { SITE_URL } from "../components/common/Seo.jsx";

const homeSchemas = [{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Award Arts",
  url: SITE_URL,
  logo: `${SITE_URL}/images/brand-logo.png`,
  email: "orders@awardarts.in",
  address: {
    "@type": "PostalAddress",
    streetAddress: "B-14, Okhla Phase II",
    addressLocality: "New Delhi",
    postalCode: "110020",
    addressCountry: "IN",
  },
}, {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "Award Arts",
  url: SITE_URL,
  publisher: { "@id": `${SITE_URL}/#organization` },
}];

export default function HomePage() {
  return (
    <>
      <ContentPage
        css={css}
        externalScripts={[]}
        externalStyles={[]}
        html={html}
        pageKey="home"
        script={script}
        title="Award Arts - Trophies, Medals and Custom Awards"
        description="Shop and customize premium trophies, medals, plaques and corporate awards from Award Arts. Bulk orders, engraving and delivery across India."
        canonicalPath="/"
        schemas={homeSchemas}
      />
      <HomeExperience />
    </>
  );
}
