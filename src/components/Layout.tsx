import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useMe } from '../auth/context';

const ROLE_LABEL = { manager: 'постановщик', executor: 'исполнитель' } as const;

export function Layout() {
  const me = useMe();
  const { signOut } = useAuth();

  return (
    <>
      <header className="header">
        <nav className="row">
          <strong>Объекты и задачи</strong>
          <NavLink to="/sites">Объекты</NavLink>
          {me.role === 'executor' && <NavLink to="/my-tasks">Мои задачи</NavLink>}
        </nav>
        <div className="row">
          <span className="muted">
            {me.full_name} ({ROLE_LABEL[me.role]})
          </span>
          <button className="secondary" onClick={signOut}>
            Выйти
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
