import { Link, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/pages/account.css";

function AccountShell({ eyebrow, title, subtitle, children }) {
  return (
    <main className="account-page">
      <section className="account-hero">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </section>
      {children}
    </main>
  );
}

export default function ProfilePage() {
  const { user, loading, updateProfile, updateAvatar } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName || "", lastName: user.lastName || "" });
  }, [user]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  if (loading) return <AccountShell eyebrow="Account" title="Loading profile" subtitle="Fetching your account details..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const set = (key, value) => {
    setStatus("");
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ firstName: form.firstName, lastName: form.lastName });
      setStatus("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError.message || "Profile could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    setStatus("");
    setError("");
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP profile photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photo must be under 5 MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async () => {
    if (!photoFile) {
      setError("Choose a profile photo first.");
      return;
    }
    setUploadingPhoto(true);
    setStatus("");
    setError("");
    try {
      await updateAvatar(photoFile);
      setStatus("Profile photo updated successfully.");
      setPhotoFile(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview("");
    } catch (requestError) {
      setError(requestError.message || "Profile photo could not be uploaded.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <AccountShell eyebrow="My Profile" title="Account details" subtitle="Manage your Legacy Awards account information.">
      <section className="account-grid">
        <article className="profile-card account-card">
          <div className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.firstName?.[0] || "U")}</div>
          <div>
            <span className="account-label">Signed in as</span>
            <h2>{fullName || "Legacy Customer"}</h2>
            <p>{user.email}</p>
          </div>
        </article>

        <article className="account-card details-card">
          <h2>Personal information</h2>
          <div className="detail-list">
            <div><span>First name</span><strong>{user.firstName || "Not added"}</strong></div>
            <div><span>Last name</span><strong>{user.lastName || "Not added"}</strong></div>
            <div><span>Email address</span><strong>{user.email}</strong></div>
            <div><span>Account type</span><strong>{user.role || "Customer"}</strong></div>
          </div>
        </article>

        <article className="account-card update-profile-card">
          <h2>Update profile</h2>
          <p>Keep your account details accurate for quote requests and order communication.</p>
          <form className="profile-update-form" onSubmit={submit}>
            <div className="profile-photo-field">
              <div className="profile-photo-preview">{photoPreview || user.avatarUrl ? <img src={photoPreview || user.avatarUrl} alt="Profile preview" /> : (user.firstName?.[0] || "U")}</div>
              <div className="profile-photo-copy">
                <label htmlFor="profilePhoto">Profile photo
                  <input type="file" id="profilePhoto" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
                </label>
                <small>JPG, PNG, or WebP. Max size 5 MB. If you do not upload a photo, your initials will continue to show.</small>
              </div>
              <div className="profile-photo-action">
                <button type="button" className="photo-upload-btn" data-uploading={uploadingPhoto ? "true" : "false"} onClick={uploadPhoto} disabled={!photoFile || uploadingPhoto}>{uploadingPhoto ? "Uploading..." : "Upload photo"}</button>
              </div>
            </div>
            <label>First name
              <input type="text" value={form.firstName} onChange={(event) => set("firstName", event.target.value)} maxLength="60" required />
            </label>
            <label>Last name
              <input type="text" value={form.lastName} onChange={(event) => set("lastName", event.target.value)} maxLength="60" required />
            </label>
            <label>Email address
              <input type="email" value={user.email} disabled />
              <small>Email changes need verification, so this stays locked for now.</small>
            </label>
            {error && <p className="account-form-error">{error}</p>}
            {status && <p className="account-form-success">{status}</p>}
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
          </form>
        </article>

        <article className="account-card quick-card">
          <h2>Quick actions</h2>
          <p>Continue from your saved items or request a quote for selected awards.</p>
          <div className="account-actions">
            <Link to="/account/wishlist">View Wishlist</Link>
            <Link to="/cart">Open Cart</Link>
            <Link to="/products">Explore Products</Link>
          </div>
        </article>
      </section>
    </AccountShell>
  );
}
