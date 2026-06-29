import "../../styles/components/page-skeleton.css";

export default function PageSkeleton() {
  return (
    <main className="page-skeleton" aria-label="Loading page">
      <div className="skeleton-hero">
        <span />
        <strong />
        <p />
      </div>
      <div className="skeleton-grid">
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
