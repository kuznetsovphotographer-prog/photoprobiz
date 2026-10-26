import { useState, type MouseEvent } from 'react';
import { BackToTopIcon, NavigationHoverRing } from './NavigationIcons';
import { ContactIcon } from './ContactIcon';
import { primaryContactLinks } from '../data/contactLinks';
import { contactMessage } from '../data/contactMessage';
import '../styles/mobile-navigation.css';

const sections = [
  ['services', 'Услуги'],
  ['office', 'Офис'],
  ['studio', 'Студия'],
  ['benefits', 'Преимущества'],
  ['pricing', 'Цены'],
  ['portfolio', 'Портфолио'],
] as const;

/** Render inside Dialog variant="menu"; popup links use the page's popup handler. */
export function MobileNavigation() {
  const [copyStatus, setCopyStatus] = useState('');

  function copyMaxMessage() {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus(contactMessage);
      return;
    }
    void navigator.clipboard.writeText(contactMessage).then(
      () => setCopyStatus('Текст скопирован. Вставьте его в чат MAX.'),
      () => setCopyStatus(contactMessage),
    );
  }

  const navigateToSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    history.pushState(null, '', `#${id}`);
    document.dispatchEvent(new Event('pp:close-menu'));
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };

  return (
    <div className="pp-mobile-navigation">
      <div className="pp-mobile-navigation__surface">
        <div className="pp-mobile-navigation__utilities" role="group" aria-label="Быстрые действия">
          <button className="pp-navigation-control pp-mobile-navigation__top" type="button" aria-label="Вернуться к началу страницы"
            onClick={() => {
              document.dispatchEvent(new Event('pp:close-menu'));
              requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
            }}>
            <NavigationHoverRing /><BackToTopIcon />
          </button>
        </div>
        <nav className="pp-mobile-navigation__grid" aria-label="Основная навигация">
          <p className="pp-mobile-navigation__caption">Разделы</p>
          <div className="pp-mobile-navigation__sections">
            {sections.map(([id, title], index) => (
              <a key={id} href={`#${id}`} onClick={(event) => navigateToSection(event, id)}>
                <span className="pp-mobile-navigation__number">{String(index + 1).padStart(2, '0')}</span>
                <span>{title}</span>
                <span className="pp-mobile-navigation__arrow" aria-hidden="true">↗</span>
              </a>
            ))}
            <a className="pp-mobile-navigation__order" href="#popup:myorder">
              <span className="pp-mobile-navigation__number">{String(sections.length + 1).padStart(2, '0')}</span>
              <span>Заказать съёмку</span>
            </a>
          </div>
          <div className="pp-mobile-navigation__messengers" role="group" aria-label="Телефон и мессенджеры">
            {primaryContactLinks.map(link => (
              <a key={link.type} href={link.href} aria-label={link.label} title={link.title}
                target={link.type === 'phone' ? undefined : '_blank'}
                rel={link.type === 'phone' ? undefined : 'noopener noreferrer'}
                onClick={link.type === 'max_messenger' ? copyMaxMessage : undefined}>
                <ContactIcon type={link.type} />
              </a>
            ))}
          </div>
          <p className="pp-mobile-navigation__copy-status" role="status">{copyStatus}</p>
        </nav>
      </div>
    </div>
  );
}
