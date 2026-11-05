import { useState } from 'react';
import { useChangeStatus, useTransitions } from '../api/tasks';
import { useMe } from '../auth/context';
import { ACTION_LABEL, availableTransitions } from '../lib/tasks';
import type { Task } from '../types/database';
import { ErrorText } from './QueryState';

type Props = { task: Pick<Task, 'id' | 'status' | 'assignee_id'> };

/** Только те действия, которые доступны текущему пользователю в текущем статусе. */
export function TaskActions({ task }: Props) {
  const me = useMe();
  const rules = useTransitions();
  const change = useChangeStatus();
  const [comment, setComment] = useState('');

  const actions = availableTransitions(rules.data ?? [], task, me);
  if (actions.length === 0) return null;

  const hasComment = comment.trim().length > 0;

  return (
    <section className="card">
      <h3>Действия</h3>
      <label>
        Комментарий {actions.some((a) => a.comment_required) && <span className="muted">(обязателен при возврате на доработку)</span>}
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <ErrorText error={change.error ?? rules.error} />
      <div className="row">
        {actions.map((action) => (
          <button
            key={action.to_status}
            className={action.to_status === 'rework' ? 'secondary' : undefined}
            disabled={change.isPending || (action.comment_required && !hasComment)}
            onClick={() =>
              change.mutate(
                { taskId: task.id, to: action.to_status, comment: comment.trim() },
                { onSuccess: () => setComment('') },
              )
            }
          >
            {ACTION_LABEL[action.to_status]}
          </button>
        ))}
      </div>
    </section>
  );
}
