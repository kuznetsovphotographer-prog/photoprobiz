import { telegramContactUrl, whatsappContactUrl } from './contactMessage';

export const contactLinks = [
  { type: 'whatsapp', title: 'WhatsApp', label: 'НАПИСАТЬ В WHATSAPP', href: whatsappContactUrl },
  { type: 'max_messenger', title: 'MAX', label: 'НАПИСАТЬ В MAX', href: 'https://max.ru/u/f9LHodD0cOKoyN6PJvJLjSy2zglOE6WkcZGM89SzNGKQwxVPvpT2o9Dzs64' },
  { type: 'telegram', title: 'Telegram', label: 'НАПИСАТЬ В TELEGRAM', href: telegramContactUrl },
  { type: 'phone', title: '+7 (965) 850-25-52', label: 'ПОЗВОНИТЬ', href: 'tel:+79658502552' },
] as const;

export const primaryContactLinks = (['phone', 'telegram', 'whatsapp', 'max_messenger'] as const)
  .flatMap(type => contactLinks.filter(link => link.type === type));
