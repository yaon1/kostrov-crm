import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSites } from '../api/sites';
import { useMe } from '../auth/context';
import { QueryState } from '../components/QueryState';
import { SiteForm } from '../components/SiteForm';

export function SitesPage() {
  const me = useMe();
  const sites = useSites();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="page-title">
        <h1>Объекты</h1>
        {me.role === 'manager' && !creating && <button onClick={() => setCreating(true)}>Новый объект</button>}
      </div>
      {creating && <SiteForm onDone={() => setCreating(false)} />}
      <QueryState isPending={sites.isPending} error={sites.error}>
        {sites.data?.length === 0 ? (
          <p className="muted">Объектов пока нет.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Адрес</th>
                <th>Задач</th>
              </tr>
            </thead>
            <tbody>
              {sites.data?.map((site) => (
                <tr key={site.id}>
                  <td>
                    <Link to={`/sites/${site.id}`}>{site.name}</Link>
                  </td>
                  <td>{site.address}</td>
                  <td>{site.tasks[0]?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryState>
    </>
  );
}
