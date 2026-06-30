import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/app.css';

// Two experiences in one build: the staff CRM (default) and the public
// participant Live Classes area at /live. SPA rewrites send every path to
// index.html, so we pick the root here from the URL. The Live area (and its
// heavy 100ms video SDK) is lazy-loaded so the CRM bundle stays light.
const isLive = window.location.pathname.startsWith('/live');
const LiveRoot = lazy(() => import('./live/LiveRoot'));

const loading = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14 }}>
    Loading…
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary variant="app">
      {isLive ? (
        <Suspense fallback={loading}>
          <LiveRoot />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
