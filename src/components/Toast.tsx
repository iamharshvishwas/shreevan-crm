import type { AppStore } from '../store';
import { CheckIcon, CloseIcon } from './icons';

export function Toast({ app }: { app: AppStore }) {
  if (!app.toast) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 200,
        background: 'var(--sw-forest-900)',
        color: '#ffffff',
        borderRadius: 12,
        boxShadow: 'var(--shadow-lg)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 380,
        animation: 'sw-toast-in 240ms var(--ease-calm)',
      }}
    >
      <span style={{ display: 'flex', color: 'var(--sw-gold-100)' }}>
        <CheckIcon size={18} />
      </span>
      <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{app.toast}</span>
      <button
        onClick={() => app.setToast(null)}
        className="hov-toast-x"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 4, display: 'flex', borderRadius: 6, flexShrink: 0 }}
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
