type ErrorLike = { code?: string; message?: string };

/** Человекочитаемое сообщение. Тексты ошибок бизнес-правил приходят из базы на русском. */
export function errorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as ErrorLike;
  if (code === '23503') return 'Нельзя удалить: есть связанные задачи.';
  if (message === 'Invalid login credentials') return 'Неверный email или пароль.';
  return message || 'Что-то пошло не так. Попробуйте ещё раз.';
}
