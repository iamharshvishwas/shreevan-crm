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
import { Login } from './screens/Login';
import { useAppStore } from './store';
import { useAuth, type AuthStore } from './auth/useAuth';

export function App() {
  const auth = useAuth();
  if (!auth.authed) return <Login auth={auth} />;
  return <AuthedApp auth={auth} />;
}

function AuthedApp({ auth }: { auth: AuthStore }) {
  const app = useAppStore();

  function renderScreen() {
    if (app.selectedLeadId) return <LeadProfile app={app} />;
    switch (app.screen) {
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
      default:
        return <Overview app={app} />;
    }
  }

  // The pipeline board and the inbox manage their own internal scroll/height.
  const fillHeight = (app.screen === 'pipeline' || app.screen === 'enquiries') && !app.selectedLeadId;

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
          <div className="sw-screen" key={app.selectedLeadId ?? app.screen}>
            {renderScreen()}
          </div>
        </main>
      </div>

      {app.showAddLead && <AddLeadModal app={app} />}
      <Toast app={app} />
      <VedaMic />
    </div>
  );
}
