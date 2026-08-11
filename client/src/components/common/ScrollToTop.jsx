import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { hash, pathname } = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (hash) {
      const scrollToHashTarget = () => {
        const target = document.getElementById(hash.slice(1));
        if (!target) return;
        const navHeight = document.querySelector(".site-nav")?.offsetHeight || 0;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 18;
        window.scrollTo({ top: Math.max(targetTop, 0), left: 0, behavior: "smooth" });
      };

      scrollToHashTarget();
      const frameId = window.requestAnimationFrame(scrollToHashTarget);
      const timeoutIds = [80, 220, 500].map((delay) =>
        window.setTimeout(scrollToHashTarget, delay),
      );

      return () => {
        window.cancelAnimationFrame(frameId);
        timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      };
    }

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frameId = window.requestAnimationFrame(resetScroll);
    const timeoutIds = [50, 150, 300, 600].map((delay) =>
      window.setTimeout(resetScroll, delay),
    );

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [hash, pathname]);

  return null;
}
