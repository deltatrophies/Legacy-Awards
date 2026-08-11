import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_NAME,
  BUSINESS_WHATSAPP,
  createWhatsAppUrl,
} from "../config/business.js";
import { ApiError, settingsApi, submitInquiry } from "../services/apiClient.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/contact.css";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  type: "general",
  quantity: "",
  event: "",
  message: "",
  website: "",
};

const inquiryTypes = [
  { value: "general", label: "General enquiry" },
  { value: "pricing", label: "Pricing & catalogue" },
  { value: "custom", label: "Custom trophy design" },
  { value: "bulk", label: "Bulk / corporate order" },
];

function formatWhatsAppNumber(number) {
  if (!number || number.includes("X")) return "Available on request";
  return `+${number.replace(/^\+/, "")}`;
}

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [attachment, setAttachment] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attachmentInputRef = useRef(null);
  const [business, setBusiness] = useState({
    businessName: BUSINESS_NAME,
    email: BUSINESS_EMAIL,
    whatsapp: BUSINESS_WHATSAPP,
    address: BUSINESS_ADDRESS,
    timings: "",
    mapUrl: "",
  });

  useEffect(() => {
    document.title = `Contact Us - ${business.businessName}`;
  }, [business.businessName]);

  useEffect(() => {
    let active = true;
    settingsApi.get()
      .then((settings) => {
        if (active && settings) setBusiness((current) => ({ ...current, ...settings }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!status.message) return undefined;
    const timeoutId = window.setTimeout(() => {
      setStatus({ type: "", message: "" });
    }, status.type === "success" ? 5200 : 6800);

    return () => window.clearTimeout(timeoutId);
  }, [status.message, status.type]);

  const whatsappLink = useMemo(
    () => createWhatsAppUrl(`Hi ${business.businessName}, I want to discuss an awards/trophies requirement.`, business.whatsapp),
    [business.businessName, business.whatsapp],
  );

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    const name = form.name.trim();
    const email = form.email.trim();
    const rawPhoneDigits = form.phone.replace(/\D/g, "");
    const phoneDigits = rawPhoneDigits.length === 12 && rawPhoneDigits.startsWith("91")
      ? rawPhoneDigits.slice(2)
      : rawPhoneDigits;
    const organization = form.organization.trim();
    const quantity = Number(form.quantity);

    if (!name) nextErrors.name = "Please enter your name.";
    else if (name.length < 2) nextErrors.name = "Name must be at least 2 characters.";

    if (!email) nextErrors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Please enter a valid email address.";

    if (!form.phone.trim()) nextErrors.phone = "Please enter your phone number.";
    else if (phoneDigits.length !== 10) nextErrors.phone = "Please enter a valid 10-digit phone number.";

    if (!organization) nextErrors.organization = "Please enter your organization name.";
    else if (organization.length < 2) nextErrors.organization = "Organization must be at least 2 characters.";

    if (!form.type) nextErrors.type = "Please select a requirement type.";

    if (["bulk", "custom"].includes(form.type) && !form.quantity) {
      nextErrors.quantity = "Quantity is required for bulk or custom enquiries.";
    } else if (form.quantity && (!Number.isInteger(quantity) || quantity < 1)) {
      nextErrors.quantity = "Quantity must be a whole number greater than 0.";
    }

    if (form.event.length > 160) nextErrors.event = "Event name must be under 160 characters.";
    if (form.message.length > 5000) nextErrors.message = "Message must be under 5000 characters.";

    return nextErrors;
  };

  const getFieldClass = (field) => (errors[field] ? "contact-field contact-field--error" : "contact-field");

  const renderError = (field) => (
    errors[field] ? <small className="contact-field-error" id={`${field}-error`}>{errors[field]}</small> : null
  );

  const scrollToField = (formElement, field) => {
    const input = formElement.querySelector(`[name="${field}"]`);
    const wrapper = input?.closest(".contact-field") || input;
    if (!input || !wrapper) return;

    const navHeight = document.querySelector(".site-nav")?.offsetHeight || 0;
    const targetTop = wrapper.getBoundingClientRect().top + window.scrollY - navHeight - 28;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });

    window.setTimeout(() => {
      input.focus({ preventScroll: true });
    }, 320);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus({ type: "", message: "" });
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      const firstField = Object.keys(validationErrors)[0];
      window.requestAnimationFrame(() => {
        scrollToField(formElement, firstField);
      });
      return;
    }

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "quantity" && !value) return;
      payload.append(key, value);
    });
    if (attachment) payload.append("attachment", attachment);

    try {
      setIsSubmitting(true);
      const response = await submitInquiry(payload);
      setStatus({
        type: "success",
        message: `Thank you. Your enquiry ${response?.reference ? `(${response.reference}) ` : ""}has been received. Our team will contact you shortly.`,
      });
      if (response?.reference && response?.accessToken) {
        const stored = readStorage("enquiries", []);
        const next = [
          {
            reference: response.reference,
            accessToken: response.accessToken,
            status: response.status,
            createdAt: response.createdAt,
            name: form.name,
            email: form.email,
            type: form.type,
          },
          ...stored.filter((item) => item.reference !== response.reference),
        ].slice(0, 25);
        writeStorage("enquiries", next);
      }
      setForm(initialForm);
      setErrors({});
      setAttachment(null);
      formElement.reset();
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : error?.message || "We could not submit your enquiry right now. Please try again or contact us on WhatsApp.";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toast = status.message ? (
    <div className={`contact-toast contact-toast--${status.type}`} role="status" aria-live="polite">
      <span className="contact-toast__icon" aria-hidden="true">
        {status.type === "success" ? "✓" : "!"}
      </span>
      <div className="contact-toast__copy">
        <strong>{status.type === "success" ? "Enquiry sent" : "Could not send enquiry"}</strong>
        <p>{status.message}</p>
      </div>
      <button type="button" aria-label="Dismiss message" onClick={() => setStatus({ type: "", message: "" })}>
        x
      </button>
      <span className="contact-toast__timer" aria-hidden="true" />
    </div>
  ) : null;

  return (
    <>
    <main className="contact-page">
      <section className="contact-hero" aria-labelledby="contact-title">
        <div className="contact-hero__content">
          <span className="contact-eyebrow">Contact {business.businessName}</span>
          <h1 id="contact-title">Let’s create awards that feel worthy of the moment.</h1>
          <p>
            Share your requirement once and our team will help with trophy options, customisation,
            pricing, artwork and production timelines — without making the page feel like a puzzle.
          </p>
          <div className="contact-hero__actions">
            <a className="contact-primary-btn" href={whatsappLink}>Start on WhatsApp</a>
            <a className="contact-secondary-btn" href={`mailto:${business.email}`}>Email us</a>
          </div>
        </div>

        <aside className="contact-hero__card" aria-label="Contact response promise">
          <span>Response time</span>
          <strong>Within 1 business day</strong>
          <p>For urgent event timelines, mention your date and quantity in the form.</p>
        </aside>
      </section>

      <section className="contact-quick-grid" aria-label="Quick contact options">
        <article className="contact-info-card">
          <span className="contact-info-card__icon" aria-hidden="true">☎</span>
          <div>
            <h2>Call / WhatsApp</h2>
            <p>{formatWhatsAppNumber(business.whatsapp)}</p>
            <a href={whatsappLink}>Open WhatsApp</a>
          </div>
        </article>
        <article className="contact-info-card">
          <span className="contact-info-card__icon" aria-hidden="true">✉</span>
          <div>
            <h2>Email</h2>
            <p>{business.email}</p>
            <a href={`mailto:${business.email}`}>Send an email</a>
          </div>
        </article>
        <article className="contact-info-card">
          <span className="contact-info-card__icon" aria-hidden="true">⌖</span>
          <div>
            <h2>Visit</h2>
            <p>{business.address}</p>
            <a href={business.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`} target="_blank" rel="noreferrer">
              Open map
            </a>
          </div>
        </article>
      </section>

      <section className="contact-workspace" id="enquiry-form" aria-label="Contact form and guidance">
        <div className="contact-form-card">
          <div className="contact-section-heading">
            <span>Send enquiry</span>
            <h2>Tell us what you need</h2>
            <p>Keep it simple. We’ll come back with the right product options and next steps.</p>
          </div>

          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            <input
              aria-label="Leave this field empty"
              autoComplete="off"
              className="contact-honeypot"
              name="website"
              onChange={updateField}
              tabIndex="-1"
              value={form.website}
            />

            <div className="contact-form__grid">
              <label className={getFieldClass("name")}>
                <span>Your name</span>
                <input aria-describedby={errors.name ? "name-error" : undefined} aria-invalid={Boolean(errors.name)} name="name" onChange={updateField} placeholder="Enter full name" type="text" value={form.name} />
                {renderError("name")}
              </label>
              <label className={getFieldClass("email")}>
                <span>Email address</span>
                <input aria-describedby={errors.email ? "email-error" : undefined} aria-invalid={Boolean(errors.email)} name="email" onChange={updateField} placeholder="you@company.com" type="email" value={form.email} />
                {renderError("email")}
              </label>
              <label className={getFieldClass("phone")}>
                <span>Phone number</span>
                <input aria-describedby={errors.phone ? "phone-error" : undefined} aria-invalid={Boolean(errors.phone)} name="phone" onChange={updateField} placeholder="+91 98765 43210" type="tel" value={form.phone} />
                {renderError("phone")}
              </label>
              <label className={getFieldClass("organization")}>
                <span>Organization</span>
                <input aria-describedby={errors.organization ? "organization-error" : undefined} aria-invalid={Boolean(errors.organization)} name="organization" onChange={updateField} placeholder="Company / school / event" type="text" value={form.organization} />
                {renderError("organization")}
              </label>
              <label className={getFieldClass("type")}>
                <span>Requirement type</span>
                <select aria-describedby={errors.type ? "type-error" : undefined} aria-invalid={Boolean(errors.type)} name="type" onChange={updateField} value={form.type}>
                  {inquiryTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {renderError("type")}
              </label>
              <label className={getFieldClass("quantity")}>
                <span>Quantity</span>
                <input
                  aria-describedby={errors.quantity ? "quantity-error" : undefined}
                  aria-invalid={Boolean(errors.quantity)}
                  min="1"
                  name="quantity"
                  onChange={updateField}
                  placeholder={["bulk", "custom"].includes(form.type) ? "Required" : "Optional"}
                  type="number"
                  value={form.quantity}
                />
                {renderError("quantity")}
              </label>
            </div>

            <label className={getFieldClass("event")}>
              <span>Event / occasion</span>
              <input aria-describedby={errors.event ? "event-error" : undefined} aria-invalid={Boolean(errors.event)} name="event" onChange={updateField} placeholder="Annual day, corporate awards, sports meet..." type="text" value={form.event} />
              {renderError("event")}
            </label>

            <label className={getFieldClass("message")}>
              <span>Message</span>
              <textarea
                aria-describedby={errors.message ? "message-error" : undefined}
                aria-invalid={Boolean(errors.message)}
                name="message"
                onChange={updateField}
                placeholder="Mention product style, budget range, deadline, logo engraving, or any reference you have."
                rows="5"
                value={form.message}
              />
              {renderError("message")}
            </label>

            <label className="contact-upload">
              <span>Attach reference or logo</span>
              <input
                accept=".jpg,.jpeg,.png,.webp,.pdf,.svg"
                ref={attachmentInputRef}
                onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                type="file"
              />
              <small>{attachment ? attachment.name : "Optional - JPG, PNG, WebP, PDF or SVG"}</small>
            </label>

            <button className="contact-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending enquiry..." : "Submit enquiry"}
            </button>
          </form>
        </div>

        <aside className="contact-support-panel">
          <div className="contact-section-heading">
            <span>How we help</span>
            <h2>Clear next steps, no confusion</h2>
          </div>
          <ol className="contact-steps">
            <li>
              <strong>Requirement review</strong>
              <p>We understand product type, quantity, branding and deadline.</p>
            </li>
            <li>
              <strong>Options & estimate</strong>
              <p>You receive suitable trophy choices with pricing and production feasibility.</p>
            </li>
            <li>
              <strong>Artwork approval</strong>
              <p>Logo placement, engraving text and final design are checked before production.</p>
            </li>
          </ol>

          <div className="contact-note">
            <span>Good to include</span>
            <p>Quantity, event date, logo file, preferred material and budget range help us reply faster.</p>
          </div>
        </aside>
      </section>
    </main>
    {toast ? createPortal(toast, document.body) : null}
    </>
  );
}
