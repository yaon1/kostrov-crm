import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteSite, useSite } from '../api/sites';
import { useSiteTasks } from '../api/tasks';
import { useMe } from '../auth/context';
import { ErrorText, QueryState } from '../components/QueryState';
import { SiteForm } from '../components/SiteForm';
import { StatusBadge } from '../components/StatusBadge';
import { TaskForm } from '../components/TaskForm';
import { formatDateTime } from '../lib/format';

export function SitePage() {
  const { siteId = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const site = useSite(siteId);
  const tasks = useSiteTasks(siteId);
  const deleteSite = useDeleteSite();
  const [mode, setMode] = useState<'view' | 'edit' | 'add-task'>('view');
  const isManager = me.role === 'manager';

  const remove = () => {
    if (!confirm('Удалить объект?')) return;
    deleteSite.mutate(siteId, { onSuccess: () => navigate('/sites') });
  };

  return (
    <QueryState isPending={site.isPending} error={site.error}>
      {!site.data ? (
        <p>Объект не найден или недоступен.</p>
      ) : (
        <>
          <p>
            <Link to="/sites">← Объекты</Link>
          </p>
          {mode === 'edit' ? (
            <SiteForm site={site.data} onDone={() => setMode('view')} />
          ) : (
            <div className="page-title">
              <div>
                <h1>{site.data.name}</h1>
                <p className="muted">{site.data.address}</p>
              </div>
              {isManager && (
                <div className="row">
                  <button onClick={() => setMode('add-task')}>Новая задача</button>
                  <button className="secondary" onClick={() => setMode('edit')}>
                    Изменить
                  </button>
                  <button className="danger" onClick={remove} disabled={deleteSite.isPending}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          )}
          <ErrorText error={deleteSite.error} />
          {mode === 'add-task' && (
            <TaskForm
              siteId={siteId}
              onDone={(taskId) => (taskId ? navigate(`/tasks/${taskId}`) : setMode('view'))}
            />
          )}

          <h2>Задачи</h2>
          <QueryState isPending={tasks.isPending} error={tasks.error}>
            {tasks.data?.length === 0 ? (
              <p className="muted">Задач нет.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Исполнитель</th>
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
                      <td>{task.assignee?.full_name}</td>
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
      )}
    </QueryState>
  );
}
