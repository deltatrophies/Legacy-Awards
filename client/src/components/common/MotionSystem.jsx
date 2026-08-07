import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const revealSelectors = [
  ".page-motion-shell main > section",
  ".legacy-page section",
  ".legacy-page .hero-pill",
  ".legacy-page .hero h1",
  ".legacy-page .hero-tagline",
  ".legacy-page .hero-body",
  ".legacy-page .hero-actions",
  ".legacy-page .hero-counter-row",
  ".legacy-page .pillar-cell",
  ".legacy-page .process-card",
  ".legacy-page .testimonial-card",
  ".legacy-page .split-feature",
  ".legacy-page .ts-grid > *",
  ".commerce-page > section",
  ".products-hero > *",
  ".products-toolbar",
  ".category-tabs",
  ".catalog-grid > *",
  ".catalog-card",
  ".catalog-compare-bar",
  ".compare-tray",
  ".detail-media",
  ".detail-copy",
  ".detail-price-card",
  ".detail-purchase-panel",
  ".detail-spec-grid > *",
  ".detail-card",
  ".success-page section > *",
  ".success-summary > *",
  ".account-hero > *",
  ".account-page main > section",
  ".account-card",
  ".order-history-card",
  ".order-card",
  ".wishlist-hero > *",
  ".wishlist-summary > *",
  ".wishlist-toolbar",
  ".wishlist-grid > *",
  ".wishlist-card",
  ".compare-page section",
  ".compare-page .compare-product-card",
  ".compare-page .compare-row",
  ".contact-hero",
  ".contact-hero > *",
  ".contact-workspace",
  ".contact-workspace > *",
  ".contact-card",
  ".contact-info-card",
  ".blogs-page section",
  ".blogs-hero > *",
  ".featured-blog",
  ".modern-blog-card",
  ".blogs-newsletter > *",
  ".cart-page main > *",
  ".quote-page main > *",
  ".quote-item",
  ".quote-summary",
  ".site-footer .footer-top > div",
].join(",");

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

async function loadGsap() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
  ]);

  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

export default function MotionSystem() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let canceled = false;
    let lenis;
    let gsapInstance;
    let raf;

    Promise.all([import("lenis"), loadGsap()]).then(([lenisModule, motion]) => {
      if (canceled) return;

      const Lenis = lenisModule.default;
      const { gsap, ScrollTrigger } = motion;

      lenis = new Lenis({
        duration: 1.05,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.15,
      });

      gsapInstance = gsap;
      raf = (time) => {
        lenis.raf(time * 1000);
      };

      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      document.documentElement.classList.add("has-smooth-scroll");
    });

    return () => {
      canceled = true;
      document.documentElement.classList.remove("has-smooth-scroll");
      if (gsapInstance && raf) gsapInstance.ticker.remove(raf);
      if (lenis) lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let canceled = false;
    let ctx;

    loadGsap().then(({ gsap }) => {
      if (canceled) return;

      ctx = gsap.context(() => {
        const navTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        navTimeline
          .fromTo(
            ".site-nav",
            { y: -18, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.44 },
          )
          .fromTo(
            ".site-nav .logo",
            { x: -10, autoAlpha: 0 },
            { x: 0, autoAlpha: 1, duration: 0.32 },
            "-=0.25",
          )
          .fromTo(
            ".site-nav .nav-links li",
            { y: -6, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.28, stagger: 0.03 },
            "-=0.2",
          )
          .fromTo(
            ".site-nav .nav-actions > *",
            { x: 8, autoAlpha: 0 },
            { x: 0, autoAlpha: 1, duration: 0.28, stagger: 0.03 },
            "-=0.2",
          );

        gsap.utils.toArray(".site-nav .nav-links a, .site-nav .nav-btn, .site-nav .nav-icon-link").forEach((item) => {
          const enter = () => gsap.to(item, { y: -2, scale: 1.035, duration: 0.22, ease: "power2.out" });
          const leave = () => gsap.to(item, { y: 0, scale: 1, duration: 0.22, ease: "power2.out" });

          item.addEventListener("mouseenter", enter);
          item.addEventListener("mouseleave", leave);
          item._legacyMotionCleanup = () => {
            item.removeEventListener("mouseenter", enter);
            item.removeEventListener("mouseleave", leave);
          };
        });
      });
    });

    return () => {
      canceled = true;
      document.querySelectorAll(".site-nav .nav-links a, .site-nav .nav-btn, .site-nav .nav-icon-link").forEach((element) => {
        element._legacyMotionCleanup?.();
      });
      if (ctx) ctx.revert();
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let canceled = false;
    let ctx;

    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (canceled) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          ".legacy-page-home .hero-left > *",
          { y: 34, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.82, stagger: 0.08, ease: "power3.out", delay: 0.08 },
        );

        gsap.fromTo(
          ".legacy-page-home .hero-right, .legacy-page-home .showcase-frame",
          { x: 36, autoAlpha: 0, scale: 0.97 },
          { x: 0, autoAlpha: 1, scale: 1, duration: 0.95, ease: "power3.out", delay: 0.16 },
        );

        const elements = gsap.utils
          .toArray(revealSelectors)
          .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);

        elements.forEach((element, index) => {
          gsap.fromTo(
            element,
            { autoAlpha: 0, y: 34, scale: 0.985 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.82,
              delay: Math.min(index % 6, 5) * 0.055,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 90%",
                once: true,
              },
            },
          );
        });

        ScrollTrigger.refresh();
      });
    });

    return () => {
      canceled = true;
      if (ctx) ctx.revert();
    };
  }, [pathname]);

  return null;
}
