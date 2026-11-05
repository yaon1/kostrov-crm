import { STATUS_LABEL } from '../lib/tasks';
import type { TaskStatus } from '../types/database';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}
