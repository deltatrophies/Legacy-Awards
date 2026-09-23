import ContentPage from "../components/content/ContentPage.jsx";
import html from "../content/pages/privacy.html?raw";
import script from "../content/scripts/privacy.js?raw";
import css from "../styles/pages/privacy.css?raw";

export default function PrivacyPage() {
  return (
    <ContentPage
      css={css}
      externalScripts={[]}
      externalStyles={[]}
      html={html}
      pageKey="privacy"
      script={script}
      title="Privacy Policy - Award Arts"
      description="Read how Award Arts collects, uses, protects and manages personal information submitted through our website."
      canonicalPath="/privacy"
    />
  );
}
