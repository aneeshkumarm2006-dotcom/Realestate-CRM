import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import useAuthStore from './store/authStore';
import useOrgStore from './store/orgStore';
import useNotificationStore from './store/notificationStore';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import MyBoardsPage from './pages/MyBoardsPage';
import BoardDetailPage from './pages/BoardDetailPage';
import FormBuilderPage from './pages/FormBuilderPage';
import PublicFormPage from './pages/PublicFormPage';
import CalendarPage from './pages/CalendarPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProductivityPage from './pages/ProductivityPage';
import AutomationsPage from './pages/AutomationsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import LeadIntakePage from './pages/LeadIntakePage';
import MyTasksPage from './pages/MyTasksPage';
import SettingsPage from './pages/SettingsPage';
import MembersPage from './pages/MembersPage';
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import ToastContainer from './components/ui/Toast';

/**
 * ProtectedRoute — redirects to /login when not authenticated.
 */
const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // Save intended destination (e.g. /onboarding?invite=xxx) so we can
    // redirect back after login instead of losing query params.
    const intended = location.pathname + location.search;
    if (intended !== '/login') {
      sessionStorage.setItem('postLoginRedirect', intended);
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

/**
 * RequireOrg — for app pages that need a selected org. If the user has no
 * organisations, send them to onboarding.
 */
const RequireOrg = () => {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  // While hydrating the user, don't redirect yet
  if (loading || !user) return <Outlet />;

  const hasOrg =
    Array.isArray(user.organisations) && user.organisations.length > 0;
  return hasOrg ? <Outlet /> : <Navigate to="/onboarding" replace />;
};

/**
 * RequireAdmin — admin-only routes. Non-admins are redirected to /dashboard.
 */
const RequireAdmin = () => {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const currentOrg = useOrgStore((s) => s.currentOrg);

  // While hydrating, don't make a decision yet
  if (loading || !user || !currentOrg) return <Outlet />;

  const adminId =
    typeof currentOrg.admin === 'object' && currentOrg.admin !== null
      ? currentOrg.admin._id || currentOrg.admin
      : currentOrg.admin;
  const isMainAdmin = !!adminId && String(adminId) === String(user._id);
  const isExtraAdmin = Array.isArray(currentOrg.admins) &&
    currentOrg.admins.some((a) => {
      const id = typeof a === 'object' && a !== null ? a._id || a : a;
      return String(id) === String(user._id);
    });
  const isAdmin = isMainAdmin || isExtraAdmin;
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

/**
 * PublicOnlyRoute — if already logged in, bounce to /dashboard.
 */
const PublicOnlyRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const setOrgsFromUser = useOrgStore((s) => s.setOrgsFromUser);
  const fetchSharedBoards = useOrgStore((s) => s.fetchSharedBoards);
  const currentOrgId = useOrgStore((s) => s.currentOrg?._id);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const clearNotifications = useNotificationStore((s) => s.clear);

  // On mount (or token change), hydrate the user profile from the backend.
  useEffect(() => {
    if (token && !user) {
      fetchCurrentUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep orgStore synced with the user's organisations, and pull the boards
  // shared with this user (other workspaces) so the navbar can list them.
  useEffect(() => {
    if (user) {
      setOrgsFromUser(user);
      fetchSharedBoards().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pull notifications once the user is hydrated and re-fetch whenever the
  // active organisation changes so the bell only shows notifications for
  // the workspace the user is currently looking at. Clear on logout.
  useEffect(() => {
    if (user) {
      fetchNotifications(currentOrgId || undefined);
    } else {
      clearNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, currentOrgId]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* F13 — public, brandable intake form. No auth shell, no navbar. A
            logged-in admin can still open it to preview their own form. */}
        <Route path="/f/:slug" element={<PublicFormPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOrg />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/boards" element={<MyBoardsPage />} />
            <Route path="/boards/:id" element={<BoardDetailPage />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/productivity" element={<ProductivityPage />} />
              {/* F6 — Recipe library & automation builder (admin-only) */}
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/boards/:id/automations" element={<AutomationsPage />} />
              <Route path="/boards/:id/integrations" element={<IntegrationsPage />} />
              {/* F9 — Automated Lead Agent: per-board intake policy (admin-only) */}
              <Route path="/boards/:id/intake" element={<LeadIntakePage />} />
              {/* F13 — public form builder (admin-only) */}
              <Route path="/forms/new" element={<FormBuilderPage />} />
              <Route path="/forms/:id/edit" element={<FormBuilderPage />} />
            </Route>
            <Route path="/members" element={<MembersPage />} />
            <Route path="/workspace-settings" element={<WorkspaceSettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
