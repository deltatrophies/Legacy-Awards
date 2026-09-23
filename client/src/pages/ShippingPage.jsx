import ContentPage from "../components/content/ContentPage.jsx";
import html from "../content/pages/shipping.html?raw";
import script from "../content/scripts/shipping.js?raw";
import css from "../styles/pages/shipping.css?raw";

export default function ShippingPage() {
  return (
    <ContentPage
      css={css}
      externalScripts={[]}
      externalStyles={[]}
      html={html}
      pageKey="shipping"
      script={script}
      title="Shipping Policy - Award Arts"
      description="Learn about Award Arts production timelines, dispatch, delivery and shipping for trophies and custom awards across India."
      canonicalPath="/shipping"
    />
  );
}
