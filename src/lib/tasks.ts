import type { Profile, StatusTransition, Task, TaskStatus } from '../types/database';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
};

/** Подпись кнопки для перехода в статус. */
export const ACTION_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'Взять в работу',
  review: 'Отправить на проверку',
  accepted: 'Принять',
  rework: 'Вернуть на доработку',
};

/**
 * Переходы, доступные пользователю для задачи. Правила берутся из таблицы
 * status_transitions — той же, по которой проверяет база, поэтому интерфейс
 * не может разойтись с серверной логикой.
 */
export function availableTransitions(
  rules: StatusTransition[],
  task: Pick<Task, 'status' | 'assignee_id'>,
  user: Pick<Profile, 'id' | 'role'>,
): StatusTransition[] {
  return rules.filter(
    (rule) =>
      rule.from_status === task.status &&
      (rule.actor === 'manager' ? user.role === 'manager' : task.assignee_id === user.id),
  );
}
