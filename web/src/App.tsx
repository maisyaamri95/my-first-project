import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './data/AppContext';
import { ToastProvider } from './components/Toast';
import { TabBar } from './components/TabBar';
import { Icon } from './components/Icon';
import { APP_NAME } from './config';
import { longDate } from './lib/dates';
import TasksPage from './pages/Tasks';
import ExpensesPage from './pages/Expenses';
import LoginPage, { SetPassword } from './pages/Login';

const TaxPage = lazy(() => import('./pages/Tax'));
const AccountPage = lazy(() => import('./pages/Account'));
const PremiumPage = lazy(() => import('./pages/Premium'));
const PrivacyPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.TermsPage })));
const RefundPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.RefundPage })));

function Splash() {
  return <div className="splash"><span className="mark big"><Icon name="check" size={26} stroke={2.6} /></span></div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user, recovery } = useApp();
  const loc = useLocation();
  if (!ready) return <Splash />;
  if (recovery && user) return <SetPassword />;
  if (!user) return <Navigate to="/masuk" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function Shell() {
  const { household, households, repo } = useApp();
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span className="mark"><Icon name="check" size={15} stroke={2.6} /></span>{APP_NAME}</div>
        <div className="today">
          {households.length > 1 && household ? <span className="space-chip"><Icon name="users" size={14} />{household.isPersonal ? 'Peribadi' : household.name}</span> : longDate(new Date()).replace(/ \d{4}$/, '')}
        </div>
      </header>
      {repo.kind === 'demo' && <div className="notice">Mod demo: data disimpan dalam pelayar ini sahaja.</div>}
      <main>
        <Suspense fallback={<div className="empty">Memuatkan…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/masuk" element={<LoginPage />} />
              <Route path="/premium" element={<PremiumPage />} />
              <Route path="/privasi" element={<PrivacyPage />} />
              <Route path="/terma" element={<TermsPage />} />
              <Route path="/bayaran-balik" element={<RefundPage />} />
              <Route element={<RequireAuth><Shell /></RequireAuth>}>
                <Route path="/tugas" element={<TasksPage />} />
                <Route path="/belanja" element={<ExpensesPage />} />
                <Route path="/cukai" element={<TaxPage />} />
                <Route path="/akaun" element={<AccountPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/tugas" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
