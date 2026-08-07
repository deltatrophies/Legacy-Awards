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
          <svg className="first-load-loader__trophy" viewBox="0 0 64 64" focusable="false">
            <path d="M22 12h20v8c0 10.5-3.8 17-10 19-6.2-2-10-8.5-10-19v-8Z" />
            <path d="M22 17H12v4c0 7.5 4.7 12 11.5 12" />
            <path d="M42 17h10v4c0 7.5-4.7 12-11.5 12" />
            <path d="M32 39v8" />
            <path d="M24 52h16" />
            <path d="M20 58h24" />
            <path d="M27 21h10" />
          </svg>
        </div>
        <p className="first-load-loader__eyebrow">Legacy Awards</p>
        <div className="first-load-loader__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
