import { useState } from 'react';
import { ContactIcon } from './ContactIcon';
import { CameraNavigationIcon } from './NavigationIcons';
import { contactLinks } from '../data/contactLinks';
import { contactMessage } from '../data/contactMessage';

const quickLinks = [...contactLinks.filter(link => link.type === 'phone'), ...contactLinks.filter(link => link.type !== 'phone')];

export function QuickContacts({ onBook }: { onBook: () => void }) {
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

  return (
    <section id="pp-quick-contacts" className="pp-quick-contacts" aria-labelledby="pp-quick-contacts-title">
      <h2 id="pp-quick-contacts-title">Связаться со мной</h2>
      <div className="pp-quick-contacts__links">
        {quickLinks.map(link => (
          <a key={link.type} href={link.href}
            target={link.type === 'phone' ? undefined : '_blank'}
            rel={link.type === 'phone' ? undefined : 'noopener noreferrer'}
            onClick={link.type === 'max_messenger' ? copyMaxMessage : undefined}>
            <ContactIcon type={link.type} />
            <span>{link.title}</span>
          </a>
        ))}
      </div>
      <a className="pp-quick-contacts__book" href="#popup:myorder" onClick={onBook}>
        <CameraNavigationIcon /><span>Заказать съёмку</span>
      </a>
      <p className="pp-quick-contacts__status" role="status">{copyStatus}</p>
    </section>
  );
}
