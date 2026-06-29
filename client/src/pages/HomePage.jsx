import LegacyPage from "../components/legacy/LegacyPage.jsx";
import HomeExperience from "../components/home/HomeExperience.jsx";
import html from "../content/pages/home.html?raw";
import script from "../content/scripts/home.js?raw";
import css from "../styles/pages/home.css?raw";

export default function HomePage() {
  return (
    <>
      <LegacyPage
        css={css}
        externalScripts={[]}
        externalStyles={[]}
        html={html}
        pageKey="home"
        script={script}
        title="Legacy Awards - Trophies, Medals and Custom Awards"
      />
      <HomeExperience />
    </>
  );
}
