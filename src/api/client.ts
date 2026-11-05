/** Разворачивает ответ Supabase: ошибку — в исключение, данные — в результат. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/** То же для запросов, которые обязаны вернуть запись (insert/update + single). */
export function unwrapOne<T>(result: { data: T; error: unknown }): NonNullable<T> {
  const data = unwrap(result);
  if (data === null || data === undefined) throw new Error('Запись не найдена или недоступна');
  return data;
}
