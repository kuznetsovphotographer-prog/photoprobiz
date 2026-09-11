import { privacyHtml } from '../data/privacy';
import { legalHtml } from './ConsentDocument';

export function PrivacyPolicy({ basePath = './', standalone = false }: { basePath?: string; standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2';
  return <article className="privacy-policy" aria-labelledby="privacy-policy-title">
    <Heading id="privacy-policy-title">Политика в отношении обработки персональных данных</Heading>
    <div className="privacy-policy-content" dangerouslySetInnerHTML={{ __html: legalHtml(privacyHtml, basePath) }} />
  </article>;
}
