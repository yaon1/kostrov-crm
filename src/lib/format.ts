const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
