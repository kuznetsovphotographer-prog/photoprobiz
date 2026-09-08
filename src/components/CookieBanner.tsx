import { useEffect, useState } from 'react';

export const COOKIE_CONSENT_STORAGE_KEY = 'photoprobiz:cookie-consent';
export const COOKIE_NOTICE_STORAGE_KEY = 'photoprobiz:cookie-notice-seen';

export function CookieBanner({ onPrivacy }: { onPrivacy?: () => void }) {
  // Keep the banner out of prerendered markup until the browser has checked
  // persistent consent. Returning visitors therefore never see a brief flash.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const alreadySeen = localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY)
        || localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (alreadySeen) return;

      // A first display is enough to suppress the notice on every later visit,
      // even when the visitor leaves without pressing the confirmation button.
      localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, String(Date.now()));
      setVisible(true);
    } catch {
      // If persistent storage is unavailable, the notice still has to be shown.
      setVisible(true);
    }
  }, []);

  function accept() {
    try { localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, String(Date.now())); } catch { /* Acceptance still applies for this page. */ }
    setVisible(false);
  }

  if (!visible) return null;
  return <aside className="cookie-banner" aria-label="Использование файлов cookie">
    <p>Мы используем cookie, чтобы сайт работал лучше. Оставаясь на сайте, вы соглашаетесь с <a href="#popup:privacy" aria-haspopup="dialog" onClick={onPrivacy ? (event) => { event.preventDefault(); onPrivacy(); } : undefined}>Политикой конфиденциальности.</a></p>
    <button type="button" onClick={accept}>OK</button>
  </aside>;
}
