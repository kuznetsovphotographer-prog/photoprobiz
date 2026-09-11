import { ConsentDocument } from '../components/ConsentDocument';
import { PrivacyPolicy } from '../components/PrivacyPolicy';

export function LegalPage({ kind, basePath = '../' }: { kind: 'privacy' | 'consent'; basePath?: string }) {
  return <>
    <a className="skip-link" href="#legal-content">Перейти к документу</a>
    <header className="legal-page-header">
      <a className="legal-page-logo" href={basePath} aria-label="Александр Кузнецов — главная">
        <span>АЛЕКСАНДР</span><span>КУЗНЕЦОВ</span>
      </a>
      <a href={basePath}>Вернуться на сайт</a>
    </header>
    <main className="legal-page" id="legal-content">
      {kind === 'privacy'
        ? <PrivacyPolicy basePath={basePath} standalone />
        : <ConsentDocument basePath={basePath} standalone />}
    </main>
    <footer className="legal-page-footer">
      <span>© 2026 Александр Кузнецов</span>
      <nav aria-label="Юридические документы">
        <a href={`${basePath}privacy/`}>Политика обработки данных</a>
        <a href={`${basePath}consent/`}>Согласие на обработку данных</a>
      </nav>
    </footer>
    <div id="ui-root" />
  </>;
}
