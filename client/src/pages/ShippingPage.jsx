import LegacyPage from "../components/legacy/LegacyPage.jsx";
import html from "../content/pages/shipping.html?raw";
import script from "../content/scripts/shipping.js?raw";
import css from "../styles/pages/shipping.css?raw";

export default function ShippingPage() {
  return (
    <LegacyPage
      css={css}
      externalScripts={[]}
      externalStyles={[]}
      html={html}
      pageKey="shipping"
      script={script}
      title="Shipping Policy - Legacy Awards"
    />
  );
}
