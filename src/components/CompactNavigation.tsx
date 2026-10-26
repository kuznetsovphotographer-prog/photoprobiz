import { useEffect, useRef, useState } from 'react';
import { MenuToggleIcon } from './MenuToggleIcon';
import { BackToTopIcon, NavigationHoverRing, PhoneNavigationIcon } from './NavigationIcons';
import { QuickContacts } from './QuickContacts';
import '../styles/compact-navigation.css';

const compactThreshold = 80;

/**
 * Replaces the fixed header with a compact utility rail after the visitor has
 * moved down the page. Each control follows the section beneath its own icon.
 */
export function CompactNavigation() {
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuActive, setMenuActive] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);
  const contactButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.section-header');
    const darkSections = document.querySelectorAll<HTMLElement>('.section-hero, .section-about, .section-footer');
    if (!header) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const lockedPageOffset = document.body.style.position === 'fixed'
        ? Math.abs(Number.parseFloat(document.body.style.top) || 0)
        : window.scrollY;
      const nextVisible = lockedPageOffset >= compactThreshold;
      const buttonCenter = window.innerWidth < 480 ? 30 : 35;
      const onDarkSection = Array.from(darkSections).some(section => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= buttonCenter && bounds.bottom > buttonCenter;
      });
      const nextTheme = onDarkSection ? 'light' : 'dark';
      navigationRef.current?.querySelectorAll<HTMLElement>(':scope > .pp-navigation-control').forEach(control => {
        const controlBounds = control.getBoundingClientRect();
        const center = (controlBounds.top + controlBounds.bottom) / 2;
        const darkBackground = Array.from(darkSections).some(section => {
          const bounds = section.getBoundingClientRect();
          return bounds.top <= center && bounds.bottom > center;
        });
        control.dataset.theme = darkBackground ? 'light' : 'dark';
      });
      header.classList.toggle('is-scrolled-away', nextVisible);
      header.inert = nextVisible;
      if (nextVisible) header.setAttribute('aria-hidden', 'true');
      else header.removeAttribute('aria-hidden');
      document.documentElement.dataset.floatingMenuTheme = nextTheme;
      setVisible((current) => current === nextVisible ? current : nextVisible);
      if (!nextVisible) setContactsOpen(false);
      if (!nextVisible && document.activeElement?.classList.contains('pp-compact-navigation__top')) {
        header.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
      }
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
      setContactsOpen(false);
    };
    document.addEventListener('pp:menu-state', updateMenuState);
    return () => document.removeEventListener('pp:menu-state', updateMenuState);
  }, []);

  useEffect(() => {
    if (!contactsOpen) return;
    navigationRef.current?.querySelector<HTMLAnchorElement>('.pp-quick-contacts a')?.focus({ preventScroll: true });
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target)) setContactsOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setContactsOpen(false);
      contactButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [contactsOpen]);

  const toggleMenu = () => {
    const nextOpen = !menuActive;
    setMenuOpen(nextOpen);
    setMenuActive(nextOpen);
    setContactsOpen(false);
    document.dispatchEvent(new Event(nextOpen ? 'pp:open-menu' : 'pp:close-menu'));
  };

  const controlVisible = visible || menuOpen;
  const utilitiesVisible = visible && !menuOpen;

  return (
    <div ref={navigationRef} className={`pp-compact-navigation${controlVisible ? ' is-visible' : ''}${menuOpen ? ' is-menu-open' : ''}${menuActive ? ' is-menu-active' : ''}`} role="group" aria-label="Быстрая навигация" aria-hidden={!controlVisible}>
      <button
        className="pp-navigation-control pp-compact-navigation__toggle"
        type="button"
        aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={menuOpen}
        tabIndex={controlVisible ? 0 : -1}
        onClick={toggleMenu}
      >
        <NavigationHoverRing />
        <MenuToggleIcon open={menuOpen} />
      </button>
      <button ref={contactButtonRef}
        className={`pp-navigation-control pp-compact-navigation__contact${contactsOpen ? ' is-active' : ''}`}
        type="button" aria-label={contactsOpen ? 'Закрыть контакты' : 'Открыть контакты'}
        aria-expanded={contactsOpen} aria-controls={contactsOpen ? 'pp-quick-contacts' : undefined}
        aria-hidden={!utilitiesVisible} tabIndex={utilitiesVisible ? 0 : -1}
        onClick={() => setContactsOpen(current => !current)}>
        <NavigationHoverRing />
        <PhoneNavigationIcon />
        <span className="pp-navigation-tooltip" aria-hidden="true">Контакты</span>
      </button>
      <button className="pp-navigation-control pp-compact-navigation__top" type="button"
        aria-label="Вернуться к началу страницы" aria-hidden={!utilitiesVisible} tabIndex={utilitiesVisible ? 0 : -1}
        onClick={() => {
          setContactsOpen(false);
          window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }}>
        <NavigationHoverRing />
        <BackToTopIcon />
        <span className="pp-navigation-tooltip" aria-hidden="true">Наверх</span>
      </button>
      {contactsOpen && utilitiesVisible && <QuickContacts onBook={() => setContactsOpen(false)} />}
    </div>
  );
}
