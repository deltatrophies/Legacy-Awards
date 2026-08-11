import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { inquiryApi } from "../services/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { readStorage, writeStorage } from "../utils/storage.js";
import "../styles/pages/account.css";

const statusCopy = {
  new: "Submitted",
  contacted: "Contacted",
  qualified: "In review",
  closed: "Closed",
  spam: "Closed",
};

const statusNotes = {
  new: "We have received your enquiry. Our team will review it and contact you soon.",
  contacted: "Our team has contacted you or started the conversation.",
  qualified: "Your requirement is being checked for product fit, pricing and timeline.",
  closed: "This enquiry has been closed. You can send a new enquiry if you need more help.",
  spam: "This enquiry has been closed.",
};

function formatDate(value) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeInquiry(item) {
  return {
    ...item,
    id: item._id || item.reference,
    statusLabel: statusCopy[item.status] || item.status || "Submitted",
    statusNote: statusNotes[item.status] || "We are checking this enquiry.",
  };
}

export default function EnquiriesPage() {
  const { user } = useAuth();
  const [localEntries, setLocalEntries] = useState(() => readStorage("enquiries", []));
  const [remoteEntries, setRemoteEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    const saved = readStorage("enquiries", []);
    setLocalEntries(saved);
    const trackableSaved = saved.filter((item) => item?.reference && item?.accessToken);

    try {
      const requests = [];
      if (trackableSaved.length) {
        requests.push(inquiryApi.publicList(trackableSaved.map(({ reference, accessToken }) => ({ reference, accessToken }))));
      } else {
        requests.push(Promise.resolve([]));
      }
      if (user) requests.push(inquiryApi.mine());

      const [publicItems, mineItems = []] = await Promise.all(requests);
      const freshLocal = publicItems.map((item) => {
        const stored = trackableSaved.find((entry) => entry.reference === item.reference);
        return { ...item, accessToken: stored?.accessToken };
      });
      if (freshLocal.length) {
        if (JSON.stringify(freshLocal) !== JSON.stringify(saved)) writeStorage("enquiries", freshLocal);
        setLocalEntries(freshLocal);
      }
      setRemoteEntries(mineItems);
    } catch (err) {
      if (!silent) setError(err?.message || "We could not refresh your enquiries right now.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refresh({ silent: true });
    }, 30000);
    const onFocus = () => refresh({ silent: true });
    const onStorage = (event) => {
      if (event.detail?.key === "enquiries") refresh({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("legacy-storage", onStorage);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("legacy-storage", onStorage);
    };
  }, [refresh]);

  const enquiries = useMemo(() => {
    const merged = new Map();
    [...remoteEntries, ...localEntries].forEach((item) => {
      if (item?.reference) merged.set(item.reference, normalizeInquiry(item));
    });
    return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [localEntries, remoteEntries]);

  return (
    <main className="account-page enquiries-page">
      <section className="account-hero">
        <p>My enquiries</p>
        <h1>Enquiry status</h1>
        <span>Track the enquiries you have sent from this browser. Logged-in enquiries also stay linked with your account.</span>
      </section>

      <section className="account-card enquiry-card">
        <div className="order-section-head">
          <div>
            <h2>Your enquiry history</h2>
            <p>{enquiries.length ? `${enquiries.length} enquiry ${enquiries.length === 1 ? "request" : "requests"} found.` : "No enquiry requests found yet."}</p>
          </div>
          <button type="button" onClick={() => refresh()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>

        {error ? <p className="order-status-note">{error}</p> : null}

        {enquiries.length ? (
          <div className="enquiry-list">
            {enquiries.map((inquiry) => (
              <article className="enquiry-history-card" key={inquiry.reference}>
                <div className="order-head">
                  <div>
                    <span className="account-label">{inquiry.type || "General"} enquiry</span>
                    <h2>{inquiry.reference}</h2>
                    <small>{formatDate(inquiry.createdAt)}</small>
                  </div>
                  <div className="order-status-wrap">
                    <span>Status</span>
                    <strong className="order-status">{inquiry.statusLabel}</strong>
                  </div>
                </div>

                <p className="order-status-note">{inquiry.statusNote}</p>

                <div className="enquiry-details">
                  <div><span>Name</span><strong>{inquiry.name || "Not available"}</strong></div>
                  <div><span>Email</span><strong>{inquiry.email || "Not available"}</strong></div>
                  <div><span>Organization</span><strong>{inquiry.organization || "Not available"}</strong></div>
                  <div><span>Quantity</span><strong>{inquiry.quantity || "Not shared"}</strong></div>
                </div>

                {inquiry.message ? <p className="enquiry-message">{inquiry.message}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="order-tab-empty">
            <div>
              <h3>No enquiries yet</h3>
              <p>Send an enquiry from the contact form and it will appear here with its latest status.</p>
              <Link to="/contact#enquiry-form">Send enquiry</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
