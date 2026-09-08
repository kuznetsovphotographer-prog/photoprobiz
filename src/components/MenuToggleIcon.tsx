export function MenuToggleIcon({ open = false }: { open?: boolean }) {
  return (
    <span className={`pp-menu-toggle-icon${open ? ' is-open' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
