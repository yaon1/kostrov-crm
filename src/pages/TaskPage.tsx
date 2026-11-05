import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteTask, useTask } from '../api/tasks';
import { useMe } from '../auth/context';
import { ErrorText, QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { TaskActions } from '../components/TaskActions';
import { TaskForm } from '../components/TaskForm';
import { TaskHistory } from '../components/TaskHistory';
import { formatDateTime } from '../lib/format';

export function TaskPage() {
  const { taskId = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const task = useTask(taskId);
  const deleteTask = useDeleteTask();
  const [editing, setEditing] = useState(false);

  return (
    <QueryState isPending={task.isPending} error={task.error}>
      {!task.data ? (
        <p>Задача не найдена или недоступна.</p>
      ) : (
        <>
          <p>
            <Link to={`/sites/${task.data.site_id}`}>← {task.data.site?.name}</Link>
          </p>
          {editing ? (
            <TaskForm task={task.data} siteId={task.data.site_id} onDone={() => setEditing(false)} />
          ) : (
            <section className="card">
              <div className="page-title">
                <h1>{task.data.title}</h1>
                {me.role === 'manager' && (
                  <div className="row">
                    <button className="secondary" onClick={() => setEditing(true)}>
                      Изменить
                    </button>
                    <button
                      className="danger"
                      disabled={deleteTask.isPending}
                      onClick={() =>
                        confirm('Удалить задачу вместе с историей?') &&
                        deleteTask.mutate(taskId, { onSuccess: () => navigate(`/sites/${task.data?.site_id}`) })
                      }
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
              <ErrorText error={deleteTask.error} />
              {task.data.description && <p className="description">{task.data.description}</p>}
              <dl className="fields">
                <dt>Статус</dt>
                <dd>
                  <StatusBadge status={task.data.status} />
                </dd>
                <dt>Объект</dt>
                <dd>{task.data.site?.name}</dd>
                <dt>Исполнитель</dt>
                <dd>{task.data.assignee?.full_name}</dd>
                <dt>Автор</dt>
                <dd>{task.data.author?.full_name}</dd>
                <dt>Создана</dt>
                <dd>{formatDateTime(task.data.created_at)}</dd>
              </dl>
            </section>
          )}
          <TaskActions task={task.data} />
          <TaskHistory taskId={taskId} />
        </>
      )}
    </QueryState>
  );
}
