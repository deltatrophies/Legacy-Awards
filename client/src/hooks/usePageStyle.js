import { useInsertionEffect, useLayoutEffect } from "react";

const useStyleEffect = useInsertionEffect || useLayoutEffect;

export function usePageStyle(id, cssText) {
  useStyleEffect(() => {
    if (!cssText) return undefined;

    const styleId = `page-style-${id}`;
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = cssText;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [cssText, id]);
}
