import { useState, type FormEvent } from 'react';
import { useSites } from '../api/sites';
import { useExecutors, useSaveTask, type TaskInput } from '../api/tasks';
import { ErrorText } from './QueryState';

type Props = {
  task?: TaskInput & { id: string };
  siteId: string;
  onDone: (taskId?: string) => void;
};

export function TaskForm({ task, siteId, onDone }: Props) {
  const [form, setForm] = useState<TaskInput>({
    site_id: task?.site_id ?? siteId,
    title: task?.title ?? '',
    description: task?.description ?? '',
    assignee_id: task?.assignee_id ?? '',
  });
  const executors = useExecutors();
  const sites = useSites();
  const save = useSaveTask();

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { ...form, id: task?.id, title: form.title.trim(), description: form.description.trim() },
      { onSuccess: (saved) => onDone(saved.id) },
    );
  };

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        Название
        <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
      </label>
      <label>
        Описание
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <label>
        Объект
        <select value={form.site_id} onChange={(e) => set('site_id', e.target.value)} required>
          {sites.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Исполнитель
        <select value={form.assignee_id} onChange={(e) => set('assignee_id', e.target.value)} required>
          <option value="" disabled>
            Выберите исполнителя
          </option>
          {executors.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </label>
      <ErrorText error={save.error ?? executors.error ?? sites.error} />
      <div className="row">
        <button type="submit" disabled={save.isPending}>
          {task ? 'Сохранить' : 'Создать задачу'}
        </button>
        <button type="button" className="secondary" onClick={() => onDone()}>
          Отмена
        </button>
      </div>
    </form>
  );
}
