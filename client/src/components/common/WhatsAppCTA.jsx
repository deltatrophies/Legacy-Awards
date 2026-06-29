import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { BUSINESS_NAME, createWhatsAppUrl } from "../../config/business.js";
import "../../styles/components/whatsapp-cta.css";

export default function WhatsAppCTA() {
  const location = useLocation();

  const href = useMemo(() => {
    const message = [
      `Hi ${BUSINESS_NAME}, I want a quote for trophies/awards.`,
      `Page: ${location.pathname}`,
    ].join(" ");

    return createWhatsAppUrl(message);
  }, [location.pathname]);

  if (["/login", "/cart"].includes(location.pathname)) return null;

  return (
    <a
      className="whatsapp-cta"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Get a quote on WhatsApp"
    >
      <span className="whatsapp-cta-icon" aria-hidden="true">WA</span>
      <span className="whatsapp-cta-text">
        <strong>WhatsApp</strong>
        <small>Get quick quote</small>
      </span>
    </a>
  );
}
