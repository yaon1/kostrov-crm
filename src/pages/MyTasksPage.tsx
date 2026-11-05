import { Link } from 'react-router-dom';
import { useMyTasks } from '../api/tasks';
import { useMe } from '../auth/context';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateTime } from '../lib/format';

export function MyTasksPage() {
  const me = useMe();
  const tasks = useMyTasks(me.id);

  return (
    <>
      <h1>Мои задачи</h1>
      <QueryState isPending={tasks.isPending} error={tasks.error}>
        {tasks.data?.length === 0 ? (
          <p className="muted">Задач нет.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Задача</th>
                <th>Объект</th>
                <th>Статус</th>
                <th>Создана</th>
              </tr>
            </thead>
            <tbody>
              {tasks.data?.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td>{task.site && <Link to={`/sites/${task.site.id}`}>{task.site.name}</Link>}</td>
                  <td>
                    <StatusBadge status={task.status} />
                  </td>
                  <td>{formatDateTime(task.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryState>
    </>
  );
}
