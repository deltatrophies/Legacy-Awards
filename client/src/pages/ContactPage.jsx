import { useEffect, useMemo, useState } from "react";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_NAME,
  BUSINESS_WHATSAPP,
  createWhatsAppUrl,
} from "../config/business.js";
import { ApiError, settingsApi, submitInquiry } from "../services/apiClient.js";
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
  const [attachment, setAttachment] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const whatsappLink = useMemo(
    () => createWhatsAppUrl(`Hi ${business.businessName}, I want to discuss an awards/trophies requirement.`, business.whatsapp),
    [business.businessName, business.whatsapp],
  );

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });

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
      setForm(initialForm);
      setAttachment(null);
      event.currentTarget.reset();
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : "We could not submit your enquiry right now. Please try again or contact us on WhatsApp.";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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

      <section className="contact-workspace" aria-label="Contact form and guidance">
        <div className="contact-form-card">
          <div className="contact-section-heading">
            <span>Send enquiry</span>
            <h2>Tell us what you need</h2>
            <p>Keep it simple. We’ll come back with the right product options and next steps.</p>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
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
              <label>
                <span>Your name</span>
                <input name="name" onChange={updateField} placeholder="Enter full name" required type="text" value={form.name} />
              </label>
              <label>
                <span>Email address</span>
                <input name="email" onChange={updateField} placeholder="you@company.com" required type="email" value={form.email} />
              </label>
              <label>
                <span>Phone number</span>
                <input name="phone" onChange={updateField} placeholder="+91 98765 43210" type="tel" value={form.phone} />
              </label>
              <label>
                <span>Organization</span>
                <input name="organization" onChange={updateField} placeholder="Company / school / event" required type="text" value={form.organization} />
              </label>
              <label>
                <span>Requirement type</span>
                <select name="type" onChange={updateField} required value={form.type}>
                  {inquiryTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Quantity</span>
                <input
                  min="1"
                  name="quantity"
                  onChange={updateField}
                  placeholder={["bulk", "custom"].includes(form.type) ? "Required" : "Optional"}
                  required={["bulk", "custom"].includes(form.type)}
                  type="number"
                  value={form.quantity}
                />
              </label>
            </div>

            <label>
              <span>Event / occasion</span>
              <input name="event" onChange={updateField} placeholder="Annual day, corporate awards, sports meet..." type="text" value={form.event} />
            </label>

            <label>
              <span>Message</span>
              <textarea
                name="message"
                onChange={updateField}
                placeholder="Mention product style, budget range, deadline, logo engraving, or any reference you have."
                rows="5"
                value={form.message}
              />
            </label>

            <label className="contact-upload">
              <span>Attach reference or logo</span>
              <input
                accept=".jpg,.jpeg,.png,.webp,.pdf,.ai,.cdr,.svg"
                onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                type="file"
              />
              <small>{attachment ? attachment.name : "Optional — JPG, PNG, PDF, AI, CDR or SVG"}</small>
            </label>

            {status.message ? (
              <p className={`contact-alert contact-alert--${status.type}`} role="status">{status.message}</p>
            ) : null}

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
  );
}
