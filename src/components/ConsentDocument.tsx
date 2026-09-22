import { consentHtml } from '../data/privacy';

export function legalHtml(html: string, basePath: string, popupLinks = false) {
  const safeBasePath = basePath.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return html
    .replaceAll('__HOME__', safeBasePath)
    .replaceAll('__PRIVACY__', popupLinks ? '#popup:privacy' : `${safeBasePath}privacy/`)
    .replaceAll('__CONSENT__', popupLinks ? '#popup:consent' : `${safeBasePath}consent/`);
}

export function ConsentDocument({ basePath = './', standalone = false, popupLinks = false }: { basePath?: string; standalone?: boolean; popupLinks?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2';
  return <article className="privacy-policy" aria-labelledby="personal-data-consent-title">
    <Heading id="personal-data-consent-title">Согласие на обработку персональных данных</Heading>
    <div className="privacy-policy-content" dangerouslySetInnerHTML={{ __html: legalHtml(consentHtml, basePath, popupLinks) }} />
  </article>;
}
