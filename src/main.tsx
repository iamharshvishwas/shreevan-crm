import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/app.css';

// Three experiences in one build, chosen from host + path (SPA rewrites send
// every path to index.html): the staff CRM (default), the public student area,
// and the instructor host area. Students get a clean branded subdomain
// (class.shreevanwellness.com → student area, no /live needed); the /live and
// /teach paths also work on any host as a fallback. The video areas (and the
// heavy 100ms SDK) are lazy-loaded so the CRM bundle stays light.
const host = window.location.hostname;
const path = window.location.pathname;
const isStudentHost = host.startsWith('class.') || host.startsWith('learn.') || host.startsWith('live.') || host.startsWith('classes.');
const isLive = isStudentHost || path.startsWith('/live');
const isTeach = !isStudentHost && (host.startsWith('teach.') || path.startsWith('/teach'));
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
