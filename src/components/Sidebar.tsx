import type { AppStore } from '../store';
import type { AuthStore } from '../auth/useAuth';
import type { ScreenKey } from '../types';
import { initials } from '../data';
import { useActionableCount } from '../api/enquiries';
import { CollapseIcon, Ic } from './icons';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Founder · admin',
  RELATIONSHIP: 'Relationship manager',
  MARKETING: 'Marketing manager',
  OPERATIONS: 'Operations manager',
};

const NAV: { key: ScreenKey; label: string; icon: JSX.Element }[] = [
  { key: 'overview', label: 'Overview', icon: <Ic parts={[{ r: [3, 3, 7, 9, 1.5] }, { r: [14, 3, 7, 5, 1.5] }, { r: [14, 12, 7, 9, 1.5] }, { r: [3, 16, 7, 5, 1.5] }]} /> },
  { key: 'enquiries', label: 'Enquiries', icon: <Ic parts={['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z']} /> },
  { key: 'livechat', label: 'Live Chat', icon: <Ic parts={['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z']} /> },
  { key: 'leads', label: 'Leads', icon: <Ic parts={['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', { c: [9, 7, 4] }, 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']} /> },
  { key: 'pipeline', label: 'Booking Pipeline', icon: <Ic parts={[{ r: [3, 3, 18, 18, 2] }, 'M8 7v9', 'M12 7v5', 'M16 7v7']} /> },
  { key: 'tasks', label: 'Tasks & Follow-ups', icon: <Ic parts={['m3 17 2 2 4-4', 'm3 7 2 2 4-4', 'M13 6h8', 'M13 12h8', 'M13 18h8']} /> },
  { key: 'calls', label: 'Discovery Calls', icon: <Ic parts={['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z']} /> },
  { key: 'programs', label: 'Programs', icon: <Ic parts={['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12']} /> },
  { key: 'reports', label: 'Reports', icon: <Ic parts={['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3']} /> },
  { key: 'customers', label: 'Confirmed Customers', icon: <Ic parts={['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', { c: [9, 7, 4] }, 'm16 11 2 2 4-4']} /> },
  { key: 'veda', label: 'Veda — AI Agent', icon: <Ic parts={['M12 2a10 10 0 1 0 10 10', 'M12 6v6l4 2', 'M20 2v4h4', 'M22 2 17 7']} /> },
  { key: 'settings', label: 'Settings', icon: <Ic parts={['M20 7h-9', 'M14 17H5', { c: [17, 17, 3] }, { c: [7, 7, 3] }]} /> },
];

export function Sidebar({ app, auth }: { app: AppStore; auth: AuthStore }) {
  const collapsed = app.sidebarCollapsed;
  const hideLabel = collapsed ? { display: 'none' as const } : {};
  const name = auth.user?.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'User';
  const roleLabel = ROLE_LABEL[auth.user?.role ?? ''] ?? 'Team member';
  const { count: enquiryBadge } = useActionableCount();

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: 'var(--sw-forest-900)',
        transition: 'width 240ms var(--ease-calm)',
        overflow: 'hidden',
        width: collapsed ? 76 : 248,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 18px 16px 18px' }}>
        <img
          src="/assets/shreevan-mark-on-forest.png"
          alt="Shreevan Wellness"
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, ...hideLabel }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: '#ffffff', whiteSpace: 'nowrap' }}>
            Shreevan Wellness
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
              whiteSpace: 'nowrap',
            }}
          >
            CRM · Lead tracker
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
        {NAV.map((item) => {
          const active = app.screen === item.key && !app.selectedLeadId;
          const badge = item.key === 'enquiries' ? enquiryBadge : 0;
          return (
            <button
              key={item.key}
              onClick={() => app.goNav(item.key)}
              title={item.label}
              className="hov-nav"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                fontWeight: 600,
                transition: 'background 160ms',
                background: active ? 'var(--sw-forest-950)' : 'transparent',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.72)',
              }}
            >
              <span style={{ display: 'inline-flex', flexShrink: 0, position: 'relative' }}>
                {item.icon}
                {badge > 0 && collapsed && (
                  <span style={{ position: 'absolute', top: -5, right: -6, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: 'var(--sw-clay-600)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--sw-forest-900)' }}>{badge}</span>
                )}
              </span>
              <span style={{ whiteSpace: 'nowrap', ...hideLabel }}>{item.label}</span>
              {badge > 0 && !collapsed && (
                <span style={{ marginLeft: 'auto', minWidth: 20, height: 19, padding: '0 6px', borderRadius: 999, background: active ? 'rgba(255,255,255,0.2)' : 'var(--sw-clay-600)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: '14px 14px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--sw-gold-500)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(name)}
        </div>
        <div style={{ minWidth: 0, flex: 1, ...hideLabel }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{roleLabel}</div>
        </div>
        <button
          onClick={() => void auth.logout()}
          title="Sign out"
          className="hov-nav"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 6, borderRadius: 6, display: 'flex', ...hideLabel }}
        >
          <Ic parts={['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9']} size={16} strokeWidth={2} />
        </button>
        <button
          onClick={() => app.setSidebarCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hov-nav"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.65)',
            padding: 6,
            borderRadius: 6,
            display: 'flex',
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 240ms var(--ease-calm)',
          }}
        >
          <CollapseIcon />
        </button>
      </div>
    </nav>
  );
}
