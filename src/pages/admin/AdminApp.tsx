import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AdminLogin from './AdminLogin';
import BackupPage from './BackupPage';
import PresentationPage from './PresentationPage';
import RequireAdmin from './RequireAdmin';
import SettingsPage from './SettingsPage';
import WinnerEditor from './WinnerEditor';
import WinnersPage from './WinnersPage';

export default function AdminApp() {
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
