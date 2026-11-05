import type { ReactNode } from 'react';
import { errorMessage } from '../lib/errors';

type Props = { isPending: boolean; error: unknown; children: ReactNode };

/** Единое отображение загрузки и ошибки запроса. */
export function QueryState({ isPending, error, children }: Props) {
  if (error) return <p className="error">{errorMessage(error)}</p>;
  if (isPending) return <p className="muted">Загрузка…</p>;
  return <>{children}</>;
}

export function ErrorText({ error }: { error: unknown }) {
  return error ? <p className="error">{errorMessage(error)}</p> : null;
}
