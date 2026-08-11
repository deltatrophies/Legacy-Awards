import { useEffect, useState } from "react";

const MINIMUM_LOAD_TIME = 1250;

export default function FirstLoadLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const startedAt = window.performance?.now?.() || Date.now();
    let finishTimer;
    let exitTimer;

    const finish = () => {
      const now = window.performance?.now?.() || Date.now();
      const remaining = Math.max(0, MINIMUM_LOAD_TIME - (now - startedAt));

      finishTimer = window.setTimeout(() => {
        setLeaving(true);
        exitTimer = window.setTimeout(() => setVisible(false), 520);
      }, remaining);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }

    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(finishTimer);
      window.clearTimeout(exitTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`first-load-loader${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite" aria-label="Loading Legacy Awards">
      <div className="first-load-loader__panel">
        <div className="first-load-loader__mark" aria-hidden="true">
          <img className="first-load-loader__logo" src="/images/brand-logo.png" alt="" />
        </div>
        <p className="first-load-loader__eyebrow">Legacy Awards</p>
        <div className="first-load-loader__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
