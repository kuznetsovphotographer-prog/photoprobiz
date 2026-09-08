import { privacyHtml } from '../data/privacy';

export function PrivacyPolicy({ basePath = './' }: { basePath?: string }) {
  const safeBasePath = basePath.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return <article className="privacy-policy" aria-labelledby="privacy-policy-title">
    <h2 id="privacy-policy-title">Политика конфиденциальности</h2>
    <div className="privacy-policy-content" dangerouslySetInnerHTML={{ __html: privacyHtml.replaceAll('__HOME__', safeBasePath) }} />
  </article>;
}
