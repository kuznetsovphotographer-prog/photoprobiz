import { ContactIcon } from './ContactIcon';

const links = [
  { type: 'whatsapp', label: 'НАПИСАТЬ В WHATSAPP', href: 'https://wa.me/79658502552' },
  { type: 'max_messenger', label: 'НАПИСАТЬ В MAX', href: 'https://max.ru/u/f9LHodD0cOKoyN6PJvJLjSy2zglOE6WkcZGM89SzNGKQwxVPvpT2o9Dzs64' },
  { type: 'telegram', label: 'НАПИСАТЬ В TELEGRAM', href: 'https://t.me/alkruze' },
  { type: 'vk', label: 'НАПИСАТЬ ВКОНТАКТЕ', href: 'https://vk.com/write81429236' },
  { type: 'phone', label: 'ПОЗВОНИТЬ', href: 'tel:+79658502552' },
] as const;

export function ContactCard() {
  return <section className="contact-card" aria-labelledby="contact-card-title">
    <h2 id="contact-card-title">Связаться со мной можно любым удобным способом!</h2>
    <p>Снимаю в Москве, Московской области и в любой точке России по вашему запросу!</p>
    <div className="contact-card-links">{links.map((link) => <a key={link.type} href={link.href} target={link.type === 'phone' ? undefined : '_blank'} rel={link.type === 'phone' ? undefined : 'noopener noreferrer'}>
      <ContactIcon type={link.type} /><span>{link.label}</span>
    </a>)}</div>
  </section>;
}
