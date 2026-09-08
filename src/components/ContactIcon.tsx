import type { ContactMethod } from '../services/lead';

export function ContactIcon({ type, className = '' }: { type: ContactMethod | 'vk'; className?: string }) {
  const iconClassName = `contact-icon contact-icon--${type}${className ? ` ${className}` : ''}`;

  if (type === 'max_messenger') {
    return <svg viewBox="0 0 100 100" className={iconClassName} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="max-messenger-gradient" x1="12" y1="12" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00bfff" />
          <stop offset=".46" stopColor="#471aff" />
          <stop offset="1" stopColor="#9500ff" />
        </linearGradient>
      </defs>
      <path
        fill="url(#max-messenger-gradient)"
        fillRule="evenodd"
        d="M50.76.26c27.53 0 49.13 22.34 49.13 49.89 0 27.55-22.28 49.34-48.87 49.34-9.43 0-14.01-1.33-21.37-6.54-.51-.36-1.2-.27-1.63.19-5.66 6.04-20.17 10.29-20.83 2.04C7.19 80.79 0 71.45 0 49.88 0 21.55 23.22.26 50.76.26Zm.77 24.55C38.46 24.13 28.26 33.2 26.01 47.38c-1.86 11.75 1.44 26.07 4.27 26.8 1.2.3 4.08-1.91 6.18-3.88.39-.38.99-.44 1.45-.15 3.27 2 6.97 3.5 11.05 3.71 13.41.7 25.3-9.8 26-23.21.71-13.42-10.02-25.14-23.43-25.84Z"
      />
    </svg>;
  }

  return (
    <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true" focusable="false">
      {type === 'phone' && <path fill="currentColor" d="m20.5 15.5-3.8-1.6a1.2 1.2 0 0 0-1.4.4l-1.5 1.8a14.1 14.1 0 0 1-6-6l1.8-1.5a1.2 1.2 0 0 0 .4-1.4L8.4 3.4A1.3 1.3 0 0 0 7 2.6L3.6 3.4a1.4 1.4 0 0 0-1 1.4A17 17 0 0 0 19.2 21a1.4 1.4 0 0 0 1.4-1l.7-3.1a1.2 1.2 0 0 0-.8-1.4Z" />}
      {type === 'telegram' && <><circle cx="12" cy="12" r="11" fill="currentColor" /><path fill="var(--icon-cutout, #fff)" d="m6 11 11-4.3c.5-.2.9.1.7.7l-1.9 9.2c-.1.6-.5.8-1 .4l-2.9-2.1-1.4 1.4c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.3-.1l-6.6 4.2-2.8-.9c-.6-.2-.6-.6.2-.9Z" /></>}
      {type === 'whatsapp' && <><path fill="none" stroke="currentColor" strokeWidth="1.8" d="M20.8 11.6a8.8 8.8 0 0 1-13 7.8L3 20.8l1.4-4.6a8.8 8.8 0 1 1 16.4-4.6Z" /><path fill="currentColor" d="M8.3 6.8c-.7 0-1.5.7-1.4 2.2.2 2.5 3.4 6.2 6.7 7.2 1.5.5 2.8-.2 3.1-1.3.1-.4.1-.7-.2-.9l-2-1c-.3-.1-.5 0-.7.3l-.8.9c-1.7-.6-3-1.8-3.8-3.4l.7-.8c.2-.3.3-.5.1-.9l-.9-2c-.2-.4-.4-.4-.8-.3Z" /></>}
      {type === 'vk' && <><rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" /><path fill="var(--icon-cutout, #fff)" d="M5.5 8h2.2c.2 2.7 1.2 4.1 2.2 4.4V8h2.1v2.5c1-.1 2-1.5 2.4-2.5h2.2c-.3 1.5-1.3 2.8-2.1 3.4 1 .5 2.2 1.8 2.6 3.5h-2.4c-.4-1.2-1.3-2.1-2.7-2.3v2.3h-.3c-4.3 0-6.2-2.9-6.2-6.9Z" /></>}
    </svg>
  );
}
