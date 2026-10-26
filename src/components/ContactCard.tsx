import { useState } from 'react';
import { ContactIcon } from './ContactIcon';
import { CameraNavigationIcon } from './NavigationIcons';
import { contactMessage } from '../data/contactMessage';
import { contactLinks } from '../data/contactLinks';

export function ContactCard() {
  const [maxCopyStatus, setMaxCopyStatus] = useState('');

  function copyMaxMessage() {
    if (!navigator.clipboard?.writeText) {
      setMaxCopyStatus('Не удалось скопировать текст автоматически. Скопируйте его ниже.');
      return;
    }
    void navigator.clipboard.writeText(contactMessage).then(
      () => setMaxCopyStatus('Текст скопирован. Вставьте его в чат MAX.'),
      () => setMaxCopyStatus('Не удалось скопировать текст автоматически. Скопируйте его ниже.'),
    );
  }

  return <section className="contact-card" aria-labelledby="contact-card-title">
    <h2 id="contact-card-title">Связаться со мной можно любым удобным способом!</h2>
    <p>Снимаю в Москве, Московской области и в любой точке России по вашему запросу!</p>
    <div className="contact-card-links">{contactLinks.map((link) => <a key={link.type} href={link.href} target={link.type === 'phone' ? undefined : '_blank'} rel={link.type === 'phone' ? undefined : 'noopener noreferrer'} onClick={link.type === 'max_messenger' ? copyMaxMessage : undefined}>
      <ContactIcon type={link.type} /><span>{link.label}</span>
    </a>)}</div>
    <p className="contact-card-max-hint">В MAX текст скопируется: вставьте его в чат.</p>
    <p className="contact-card-copy-status" role="status">{maxCopyStatus}</p>
    <p className="contact-card-message">{contactMessage}</p>
    <a className="contact-card-book" href="#popup:myorder"><CameraNavigationIcon /><span>Заказать съёмку</span></a>
  </section>;
}
