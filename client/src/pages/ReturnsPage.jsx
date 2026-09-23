import ContentPage from "../components/content/ContentPage.jsx";
import html from "../content/pages/returns.html?raw";
import script from "../content/scripts/returns.js?raw";
import css from "../styles/pages/returns.css?raw";

export default function ReturnsPage() {
  return (
    <ContentPage
      css={css}
      externalScripts={[]}
      externalStyles={[]}
      html={html}
      pageKey="returns"
      script={script}
      title="Returns Policy - Awards Arts"
    />
  );
}
