import { useState, type FormEvent } from 'react';
import { useSaveSite, type SiteInput } from '../api/sites';
import { ErrorText } from './QueryState';

type Props = { site?: SiteInput & { id: string }; onDone: () => void };

export function SiteForm({ site, onDone }: Props) {
  const [name, setName] = useState(site?.name ?? '');
  const [address, setAddress] = useState(site?.address ?? '');
  const save = useSaveSite();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: site?.id, name: name.trim(), address: address.trim() }, { onSuccess: onDone });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Адрес
        <input value={address} onChange={(e) => setAddress(e.target.value)} required />
      </label>
      <ErrorText error={save.error} />
      <div className="row">
        <button type="submit" disabled={save.isPending}>
          {site ? 'Сохранить' : 'Создать объект'}
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Отмена
        </button>
      </div>
    </form>
  );
}
