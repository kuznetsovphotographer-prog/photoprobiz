import { useEffect, useState } from 'react';
import { LEAD_SUCCESS_STORAGE_KEY } from '../services/lead';

export function ThankYouPage({ basePath = './' }: { basePath?: string }) {
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    try { setIsDemo(JSON.parse(sessionStorage.getItem(LEAD_SUCCESS_STORAGE_KEY) ?? 'null')?.mode === 'mock'); } catch { /* Direct access to the page remains available. */ }
  }, []);

  return <main className="thankyou-page" id="main-content">
    <section className="thankyou-card" aria-labelledby="thankyou-title">
      <div className="thankyou-icon-circle" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      <h1 id="thankyou-title">Отлично, заявка успешно отправлена!</h1>
      <p className="thankyou-text">Спасибо за обращение. Я свяжусь с вами в ближайшее время для обсуждения деталей. А в качестве благодарности за доверие я подготовил для вас полезный материал:</p>
      {isDemo && <p className="secondary-sr-only" role="status">Демонстрация локальной формы: заявка обработана без отправки фотографу. Контактные данные не сохранены.</p>}
      <div className="thankyou-bonus">
        <div className="thankyou-bonus-left">
          <div className="thankyou-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 2v6h6M12 11v7m-3-3 3 3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div><h2>Идеальный бизнес-портрет</h2><p>Чек-лист по подготовке к съемке (PDF)</p></div>
        </div>
        <a className="thankyou-download" href={`${basePath}downloads/business-portrait-checklist.pdf`} download="Идеальный бизнес-портрет.pdf">Скачать</a>
      </div>
      <a className="thankyou-back" href={basePath}>Понятно, вернуться на сайт</a>
    </section>
  </main>;
}
