import LegacyPage from "../components/legacy/LegacyPage.jsx";
import html from "../content/pages/privacy.html?raw";
import script from "../content/scripts/privacy.js?raw";
import css from "../styles/pages/privacy.css?raw";

export default function PrivacyPage() {
  return (
    <LegacyPage
      css={css}
      externalScripts={[]}
      externalStyles={[]}
      html={html}
      pageKey="privacy"
      script={script}
      title="Privacy Policy - Legacy Awards"
    />
  );
}
