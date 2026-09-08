import { useEffect, useState } from 'react';
import { MenuToggleIcon } from './MenuToggleIcon';
import '../styles/compact-navigation.css';

const compactThreshold = 80;

/**
 * Replaces the fixed header with a compact utility rail after the visitor has
 * moved down the page. Its colour follows the actual hero boundary.
 */
export function CompactNavigation() {
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuActive, setMenuActive] = useState(false);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.section-header');
    const hero = document.querySelector<HTMLElement>('.section-hero');
    if (!header) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const lockedPageOffset = document.body.style.position === 'fixed'
        ? Math.abs(Number.parseFloat(document.body.style.top) || 0)
        : window.scrollY;
      const nextVisible = lockedPageOffset >= compactThreshold;
      const buttonCenter = window.innerWidth < 480 ? 30 : 35;
      const nextTheme = hero && hero.getBoundingClientRect().bottom > buttonCenter ? 'light' : 'dark';
      header.classList.toggle('is-scrolled-away', nextVisible);
      header.inert = nextVisible;
      if (nextVisible) header.setAttribute('aria-hidden', 'true');
      else header.removeAttribute('aria-hidden');
      document.documentElement.dataset.floatingMenuTheme = nextTheme;
      setVisible((current) => current === nextVisible ? current : nextVisible);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      header.classList.remove('is-scrolled-away');
      header.inert = false;
      header.removeAttribute('aria-hidden');
      delete document.documentElement.dataset.floatingMenuTheme;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    const updateMenuState = (event: Event) => {
      const detail = (event as CustomEvent<{ open: boolean; active: boolean }>).detail;
      setMenuOpen(Boolean(detail?.open));
      setMenuActive(Boolean(detail?.active));
    };
    document.addEventListener('pp:menu-state', updateMenuState);
    return () => document.removeEventListener('pp:menu-state', updateMenuState);
  }, []);

  const toggleMenu = () => {
    const nextOpen = !menuActive;
    setMenuOpen(nextOpen);
    setMenuActive(nextOpen);
    document.dispatchEvent(new Event(nextOpen ? 'pp:open-menu' : 'pp:close-menu'));
  };

  const controlVisible = visible || menuOpen;

  return (
    <div className={`pp-compact-navigation${controlVisible ? ' is-visible' : ''}${menuOpen ? ' is-menu-open' : ''}${menuActive ? ' is-menu-active' : ''}`} aria-hidden={!controlVisible}>
      <button
        className="pp-navigation-control pp-compact-navigation__toggle"
        type="button"
        aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={menuOpen}
        tabIndex={controlVisible ? 0 : -1}
        onClick={toggleMenu}
      >
        <svg className="pp-compact-navigation__hover-ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <circle cx="24" cy="24" r="22" pathLength="1" />
        </svg>
        <MenuToggleIcon open={menuOpen} />
      </button>
    </div>
  );
}
