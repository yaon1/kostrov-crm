import { useTaskHistory } from '../api/tasks';
import { formatDateTime } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { QueryState } from './QueryState';

export function TaskHistory({ taskId }: { taskId: string }) {
  const history = useTaskHistory(taskId);

  return (
    <section className="card">
      <h3>История</h3>
      <QueryState isPending={history.isPending} error={history.error}>
        <ol className="history">
          {history.data?.map((item) => (
            <li key={item.id}>
              <div>
                {item.from_status ? <StatusBadge status={item.from_status} /> : <span className="muted">создана</span>}
                {' → '}
                <StatusBadge status={item.to_status} />
              </div>
              <div className="muted">
                {item.actor?.full_name ?? 'Пользователь'} · {formatDateTime(item.changed_at)}
              </div>
              {item.comment && <blockquote>{item.comment}</blockquote>}
            </li>
          ))}
        </ol>
      </QueryState>
    </section>
  );
}
