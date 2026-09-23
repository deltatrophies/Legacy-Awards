import ContentPage from "../components/content/ContentPage.jsx";
import html from "../content/pages/about.html?raw";
import script from "../content/scripts/about.js?raw";
import css from "../styles/pages/about.css?raw";

export default function AboutPage() {
  return (
    <ContentPage
      css={css}
      externalScripts={[]}
      externalStyles={[]}
      html={html}
      pageKey="about"
      script={script}
      title="About Us - Award Arts"
      description="Meet Award Arts, a New Delhi awards specialist creating trophies, medals, plaques and personalized recognition products for organizations across India."
      canonicalPath="/about"
    />
  );
}
