import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/context';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { SitePage } from './pages/SitePage';
import { SitesPage } from './pages/SitesPage';
import { TaskPage } from './pages/TaskPage';

function ProtectedLayout() {
  const { session, profile, loading, signOut } = useAuth();
  if (loading) return <p className="muted main">Загрузка…</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <main className="main">
        <p className="error">Профиль пользователя не найден. Обратитесь к администратору.</p>
        <button onClick={signOut}>Выйти</button>
      </main>
    );
  }
  return <Layout />;
}

function Home() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === 'executor' ? '/my-tasks' : '/sites'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Home />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="sites/:siteId" element={<SitePage />} />
        <Route path="tasks/:taskId" element={<TaskPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
