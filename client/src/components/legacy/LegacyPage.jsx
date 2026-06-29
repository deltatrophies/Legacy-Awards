import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useExternalAssets } from "../../hooks/useExternalAssets.js";
import { usePageStyle } from "../../hooks/usePageStyle.js";

export default function LegacyPage({
  css,
  externalScripts,
  externalStyles,
  html,
  pageKey,
  script,
  title,
}) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const externalReady = useExternalAssets({
    styles: externalStyles,
    scripts: externalScripts,
  });

  usePageStyle(pageKey, css);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (!externalReady || !script?.trim()) return undefined;

    try {
      window.__DELTA_CURRENT_PAGE__ = pageKey;
      new Function(script)();
    } catch (error) {
      console.error(`Legacy script failed on ${pageKey}`, error);
    }

    return undefined;
  }, [externalReady, pageKey, script]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const onClick = (event) => {
      const link = event.target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      event.preventDefault();
      navigate(href);
    };

    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [navigate]);

  return (
    <main
      ref={containerRef}
      className={`legacy-page legacy-page-${pageKey}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
