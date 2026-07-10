import { AddLeadModal } from './components/AddLeadModal';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { Topbar } from './components/Topbar';
import { VedaMic } from './components/VedaMic';
import { Calls } from './screens/Calls';
import { Customers } from './screens/Customers';
import { Enquiries } from './screens/Enquiries';
import { LeadProfile } from './screens/LeadProfile';
import { Leads } from './screens/Leads';
import { Overview } from './screens/Overview';
import { Pipeline } from './screens/Pipeline';
import { Programs } from './screens/Programs';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { Tasks } from './screens/Tasks';
import { Veda } from './screens/Veda';
import { LiveChat } from './screens/LiveChat';
import { Instructors } from './screens/Instructors';
import { Login } from './screens/Login';
import { useAppStore } from './store';
import { useAuth, type AuthStore } from './auth/useAuth';
import { accessResolved, canSeeScreen, firstAllowedScreen } from './auth/access';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  const auth = useAuth();
  if (!auth.authed) return <Login auth={auth} />;
  return <AuthedApp auth={auth} />;
}

function AuthedApp({ auth }: { auth: AuthStore }) {
  const app = useAppStore();

  // Don't render screens until we know this user's access (avoids flashing a
  // screen a non-admin isn't allowed to see, and landing them on a disallowed
  // default). Admin access is known from the token immediately.
  if (!accessResolved(auth.user)) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: 'var(--sw-ink-500, #6b7280)', fontFamily: 'var(--font-body)' }}>
        Loading your workspace…
      </div>
    );
  }

  // The single choke point: whatever `app.screen` is, if the user can't see it
  // (initial 'overview' default, a deep-link, or any programmatic goNav),
  // substitute their first allowed screen. This is enforced regardless of how
  // the screen was set — the sidebar filter only hides the nav buttons.
  const activeScreen = canSeeScreen(auth.user, app.screen) ? app.screen : firstAllowedScreen(auth.user);

  function renderScreen() {
    if (app.selectedLeadId) return <LeadProfile app={app} />;
    switch (activeScreen) {
      case 'overview':
        return <Overview app={app} />;
      case 'enquiries':
        return <Enquiries app={app} />;
      case 'pipeline':
        return <Pipeline app={app} />;
      case 'leads':
        return <Leads app={app} />;
      case 'tasks':
        return <Tasks app={app} />;
      case 'calls':
        return <Calls app={app} />;
      case 'programs':
        return <Programs />;
      case 'reports':
        return <Reports app={app} />;
      case 'customers':
        return <Customers app={app} />;
      case 'settings':
        return <Settings app={app} />;
      case 'veda':
        return <Veda app={app} />;
      case 'livechat':
        return <LiveChat app={app} />;
      case 'instructors':
        return <Instructors app={app} />;
      default:
        return <Overview app={app} />;
    }
  }

  // The pipeline board and the inbox manage their own internal scroll/height.
  const fillHeight = (activeScreen === 'pipeline' || activeScreen === 'enquiries' || activeScreen === 'livechat') && !app.selectedLeadId;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--sw-sand-050)',
        fontFamily: 'var(--font-body)',
        color: 'var(--sw-ink-900)',
      }}
    >
      <Sidebar app={app} auth={auth} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar app={app} />
        <main style={{ flex: 1, overflowY: fillHeight ? 'hidden' : 'auto', minWidth: 0 }}>
          <div className="sw-screen" key={app.selectedLeadId ?? activeScreen}>
            <ErrorBoundary variant="screen" resetKey={app.selectedLeadId ?? activeScreen}>
              {renderScreen()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {app.showAddLead && <AddLeadModal app={app} />}
      <Toast app={app} />
      <VedaMic />
    </div>
  );
}
