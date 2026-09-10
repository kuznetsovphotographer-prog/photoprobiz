import type { MouseEvent } from 'react';
import { PhoneNavigationIcon } from './NavigationIcons';
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
  const navigateToSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    history.pushState(null, '', `#${id}`);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };

  return (
    <div className="pp-mobile-navigation">
      <div className="pp-mobile-navigation__surface">
        <div className="pp-mobile-navigation__utilities" aria-label="Быстрые действия">
          <a className="pp-mobile-navigation__book" href="#popup:myorder">
            <span className="pp-mobile-navigation__book-label">
              <span>ЗАКАЗАТЬ</span>{' '}<span>ФОТОСЕССИЮ</span>
            </span>
          </a>
          <a className="pp-navigation-control pp-mobile-navigation__contact" href="#popup:contacts" aria-label="Открыть контакты">
            <PhoneNavigationIcon />
          </a>
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
          </div>
        </nav>
      </div>
    </div>
  );
}
