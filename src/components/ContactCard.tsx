import { useState } from 'react';
import { ContactIcon } from './ContactIcon';
import { contactMessage, telegramContactUrl, whatsappContactUrl } from '../data/contactMessage';

const links = [
  { type: 'whatsapp', label: 'НАПИСАТЬ В WHATSAPP', href: whatsappContactUrl },
  { type: 'max_messenger', label: 'НАПИСАТЬ В MAX', href: 'https://max.ru/u/f9LHodD0cOKoyN6PJvJLjSy2zglOE6WkcZGM89SzNGKQwxVPvpT2o9Dzs64' },
  { type: 'telegram', label: 'НАПИСАТЬ В TELEGRAM', href: telegramContactUrl },
  { type: 'vk', label: 'НАПИСАТЬ ВКОНТАКТЕ', href: 'https://vk.com/write81429236' },
  { type: 'phone', label: 'ПОЗВОНИТЬ', href: 'tel:+79658502552' },
] as const;

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
    <div className="contact-card-links">{links.map((link) => <a key={link.type} href={link.href} target={link.type === 'phone' ? undefined : '_blank'} rel={link.type === 'phone' ? undefined : 'noopener noreferrer'} onClick={link.type === 'max_messenger' ? copyMaxMessage : undefined}>
      <ContactIcon type={link.type} /><span>{link.label}</span>
    </a>)}</div>
    <p className="contact-card-max-hint">В MAX текст скопируется: вставьте его в чат.</p>
    <p className="contact-card-copy-status" role="status">{maxCopyStatus}</p>
    <p className="contact-card-message">{contactMessage}</p>
  </section>;
}
