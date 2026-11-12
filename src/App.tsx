import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DemoBadge } from '@/components/common/DemoBadge';
import PublicPage from '@/pages/PublicPage';

const AdminApp = lazy(() => import('@/pages/admin/AdminApp'));

export default function App() {
  return (
    <BrowserRouter>
      <PublicDemoBadge />
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="p-10 text-center text-muted">불러오는 중…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<PublicPage />} />
      </Routes>
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: { description: '!text-[#c3cfe3]' },
          style: {
            background: '#0d1730',
            color: '#eef2fa',
            border: '1px solid color-mix(in oklab, var(--c-accent) 45%, transparent)',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </BrowserRouter>
  );
}

/** 관리자 화면은 헤더 안에 배지를 직접 표시 */
function PublicDemoBadge() {
  const { pathname } = useLocation();
  return pathname.startsWith('/admin') ? null : <DemoBadge />;
}
