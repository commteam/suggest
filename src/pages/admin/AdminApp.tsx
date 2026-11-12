import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { hasTeamsSourceParam } from '@/lib/teams/teamsHost';
import AdminLayout from './AdminLayout';
import AdminLogin from './AdminLogin';
import BackupPage from './BackupPage';
import PresentationPage from './PresentationPage';
import RequireAdmin from './RequireAdmin';
import SettingsPage from './SettingsPage';
import TeamsAdminEntry from './TeamsAdminEntry';
import WinnerEditor from './WinnerEditor';
import WinnersPage from './WinnersPage';

export default function AdminApp() {
  const { pathname, search } = useLocation();
  // Teams 개인 탭 진입: /admin?source=teams → 로그인(또는 관리자 화면)으로
  if (hasTeamsSourceParam(search) && /^\/admin\/?$/.test(pathname)) return <TeamsAdminEntry />;
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<WinnersPage />} />
        <Route path="winners/new" element={<WinnerEditor />} />
        <Route path="winners/:id" element={<WinnerEditor />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="presentation" element={<PresentationPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
