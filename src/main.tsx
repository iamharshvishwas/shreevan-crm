import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/app.css';

// Three experiences in one build, chosen from the URL (SPA rewrites send every
// path to index.html): the staff CRM (default), the public participant Live
// Classes area at /live, and the instructor host area at /teach. The video
// areas (and the heavy 100ms SDK) are lazy-loaded so the CRM bundle stays light.
const path = window.location.pathname;
const isLive = path.startsWith('/live');
const isTeach = path.startsWith('/teach');
const LiveRoot = lazy(() => import('./live/LiveRoot'));
const TeachRoot = lazy(() => import('./teach/TeachRoot'));

const loading = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14 }}>
    Loading…
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary variant="app">
      {isLive ? (
        <Suspense fallback={loading}><LiveRoot /></Suspense>
      ) : isTeach ? (
        <Suspense fallback={loading}><TeachRoot /></Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
