import { useLayoutEffect, useRef, type ReactNode } from 'react';
import '../styles/dialog.css';

export interface DialogProps {
  children: ReactNode;
  onClose: () => void;
  variant?: 'gallery' | 'feature' | 'form' | 'content' | 'menu';
  label: string;
}

const activeDialogs: HTMLElement[] = [];
const inertElements = new Map<HTMLElement, { count: number; previous: boolean }>();
let restorePageScroll: (() => void) | undefined;

function preserveStyles(element: HTMLElement, properties: string[]) {
  const values = properties.map((property) => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
  return () => {
    values.forEach(([property, value, priority]) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    });
  };
}

function lockPageScroll() {
  const { body, documentElement } = document;
  const x = window.scrollX;
  const y = window.scrollY;
  const scrollbar = window.innerWidth - documentElement.clientWidth;
  const restoreBody = preserveStyles(body, ['position', 'top', 'left', 'width', 'overflow', 'padding-right', 'box-sizing']);
  const restoreHtml = preserveStyles(documentElement, ['overflow', 'scroll-behavior']);
  const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
  body.style.position = 'fixed';
  body.style.top = `${-y}px`;
  body.style.left = `${-x}px`;
  body.style.width = '100%';
  body.style.boxSizing = 'border-box';
  body.style.overflow = 'hidden';
  body.style.paddingRight = `${padding + scrollbar}px`;
  documentElement.style.overflow = 'hidden';
  return () => {
    restoreBody();
    documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(x, y);
    restoreHtml();
  };
}

function isolateDialog(dialog: HTMLElement, variant: DialogProps['variant']) {
  const isolated: HTMLElement[] = [];
  let branch: HTMLElement = dialog;
  while (branch.parentElement) {
    const parent = branch.parentElement;
    Array.from(parent.children).forEach((sibling) => {
      if (!(sibling instanceof HTMLElement) || sibling === branch || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) return;
      if (variant === 'menu' && sibling.id === 'compact-navigation-root') return;
      const existing = inertElements.get(sibling);
      if (existing) existing.count += 1;
      else inertElements.set(sibling, { count: 1, previous: sibling.inert });
      sibling.inert = true;
      isolated.push(sibling);
    });
    if (parent === document.body) break;
    branch = parent;
  }
  return () => isolated.forEach((element) => {
    const state = inertElements.get(element);
    if (state && --state.count === 0) {
      element.inert = state.previous;
      inertElements.delete(element);
    }
  });
}

const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

export function Dialog({ children, onClose, variant = 'content', label }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const backdropPointer = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const externalMenuToggle = variant === 'menu'
      ? document.querySelector<HTMLElement>('.pp-compact-navigation__toggle')
      : null;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ownsPageScrollLock = variant !== 'menu' && !restorePageScroll;
    if (ownsPageScrollLock) restorePageScroll = lockPageScroll();
    activeDialogs.push(dialog);
    const restoreInert = isolateDialog(dialog, variant);
    const isTopDialog = () => activeDialogs.at(-1) === dialog;
    const available = () => {
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (externalMenuToggle) targets.push(externalMenuToggle);
      return targets.filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]') && getComputedStyle(element).visibility !== 'hidden');
    };
    const focusInitial = () => (externalMenuToggle || dialog.querySelector<HTMLElement>('[data-autofocus]') || (variant === 'gallery' ? dialog : closeRef.current) || dialog).focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        const targets = available();
        const first = targets[0];
        const last = targets.at(-1);
        const currentIndex = targets.indexOf(document.activeElement as HTMLElement);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
        } else if (currentIndex === -1 || (event.shiftKey ? currentIndex === 0 : currentIndex === targets.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (isTopDialog() && !dialog.contains(event.target as Node) && event.target !== externalMenuToggle) focusInitial();
    };
    const handleMenuClose = () => {
      if (variant === 'menu' && isTopDialog()) onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('pp:close-menu', handleMenuClose);
    focusInitial();
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('pp:close-menu', handleMenuClose);
      const index = activeDialogs.indexOf(dialog);
      if (index !== -1) activeDialogs.splice(index, 1);
      restoreInert();
      if (ownsPageScrollLock || activeDialogs.length === 0) {
        restorePageScroll?.();
        restorePageScroll = undefined;
      }
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
      else activeDialogs.at(-1)?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      className={`pp-dialog pp-dialog--${variant}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onPointerDown={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        backdropPointer.current = event.target === event.currentTarget
          || Boolean(variant === 'feature' && target?.classList.contains('office-setup-feature'));
      }}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        const clickedOutsidePhoto = variant === 'gallery'
          && target !== null
          && !target.closest('.pp-gallery__image, button, a, input, textarea, select, label');
        const clickedFeatureGap = variant === 'feature'
          && target?.classList.contains('office-setup-feature');
        if (clickedOutsidePhoto || ((event.target === event.currentTarget || clickedFeatureGap) && backdropPointer.current)) onCloseRef.current();
        backdropPointer.current = false;
      }}
    >
      {variant !== 'menu' && <button ref={closeRef} className="pp-dialog__close" type="button" onClick={onClose} aria-label="Закрыть окно">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m3 3 18 18M21 3 3 21" /></svg>
      </button>}
      <div className="pp-dialog__panel">{children}</div>
    </div>
  );
}
