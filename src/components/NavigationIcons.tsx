export function NavigationHoverRing() {
  return (
    <svg className="pp-compact-navigation__hover-ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22" pathLength="1" />
    </svg>
  );
}

export function PhoneNavigationIcon() {
  return (
    <svg className="pp-navigation-phone-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13.83 16.57a1 1 0 0 0 1.22-.3l.35-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39Z" />
    </svg>
  );
}

export function BackToTopIcon() {
  return (
    <svg className="pp-navigation-up-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m6 11 6-6 6 6M12 5v14" />
    </svg>
  );
}

export function CameraNavigationIcon() {
  return (
    <svg className="pp-navigation-camera-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 6.5 9.5 4h5L16 6.5h4a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V8A1.5 1.5 0 0 1 4 6.5Z" />
      <circle cx="12" cy="12.5" r="4" />
      <path d="M18 9h.5" />
    </svg>
  );
}
