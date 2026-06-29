import { useEffect, useMemo, useState } from "react";

export function useExternalAssets({ styles = [], scripts = [] } = {}) {
  const styleKey = useMemo(() => styles.join("|"), [styles]);
  const scriptKey = useMemo(() => scripts.join("|"), [scripts]);
  const [ready, setReady] = useState(scripts.length === 0);

  useEffect(() => {
    let cancelled = false;
    setReady(scripts.length === 0);

    styles.forEach((href) => {
      if (document.querySelector(`link[data-delta-asset="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.deltaAsset = href;
      document.head.appendChild(link);
    });

    async function loadScripts() {
      for (const src of scripts) {
        if (document.querySelector(`script[data-delta-asset="${src}"]`)) continue;
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.dataset.deltaAsset = src;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      if (!cancelled) setReady(true);
    }

    loadScripts().catch(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [scriptKey, styleKey, scripts, styles]);

  return ready;
}
