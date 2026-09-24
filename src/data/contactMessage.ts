export const contactMessage = 'Здравствуйте! Хочу заказать деловую фотосъёмку. Подскажите, пожалуйста, какие даты у вас свободны?';

const encodedMessage = encodeURIComponent(contactMessage);

export const whatsappContactUrl = `https://wa.me/79658502552?text=${encodedMessage}`;
export const telegramContactUrl = `https://t.me/alkruze?text=${encodedMessage}`;
