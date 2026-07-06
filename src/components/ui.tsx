import { useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { initials } from '../data';
import { EyeIcon, EyeOffIcon } from './icons';

/* Status / temperature pill — always dot + text, never colour alone. */
export function Pill({
  bg,
  fg,
  children,
  fontSize = 11.5,
  fontWeight = 600,
  padding = '3px 10px',
  dotSize = 6,
  gap = 6,
}: {
  bg: string;
  fg: string;
  children: ReactNode;
  fontSize?: number;
  fontWeight?: number;
  padding?: string;
  dotSize?: number;
  gap?: number;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        fontSize,
        fontWeight,
        padding,
        borderRadius: 999,
        background: bg,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: fg }} />
      {children}
    </span>
  );
}

/* Initials avatar. */
export function Avatar({
  name,
  size = 26,
  fontSize = 10.5,
  bg = 'var(--sw-forest-700)',
}: {
  name: string;
  size?: number;
  fontSize?: number;
  bg?: string;
}) {
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: '#ffffff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* White section card with hairline border + 14px radius. */
export function SectionCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--sw-line-soft)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/* Lora section heading, 18px. */
export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: 'var(--font-heading)',
        fontWeight: 600,
        fontSize: 18,
        color: 'var(--sw-ink-900)',
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

/* River-coloured "View all"-style inline link button. */
export function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="hov-mist-link"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--sw-river-600)',
        padding: '4px 8px',
        borderRadius: 6,
      }}
    >
      {children}
    </button>
  );
}

/* Outline pill action button (forest border on white). */
export function OutlineButton({
  onClick,
  children,
  height = 36,
  style,
}: {
  onClick?: () => void;
  children: ReactNode;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className="hov-mist"
      style={{
        height,
        padding: '0 15px',
        borderRadius: 999,
        border: '1px solid var(--sw-forest-900)',
        background: '#ffffff',
        color: 'var(--sw-forest-900)',
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* Solid forest pill action button. */
export function SolidButton({
  onClick,
  children,
  height = 36,
  style,
}: {
  onClick?: () => void;
  children: ReactNode;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className="hov-forest-deep"
      style={{
        height,
        padding: '0 16px',
        borderRadius: 999,
        border: '1px solid var(--sw-forest-900)',
        background: 'var(--sw-forest-900)',
        color: '#ffffff',
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* Password input with a show/hide eye toggle. Wraps any existing input style;
   pass the same style object used for adjacent fields so it lines up visually. */
export function PasswordInput({
  id,
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoComplete,
  style,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  style?: CSSProperties;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{ ...style, width: '100%', paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sw-stone-600)',
        }}
      >
        {visible ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
      </button>
    </div>
  );
}

/* Horizontal mini bar chart row (label · bar · count). */
export function BarRow({
  label,
  width,
  color,
  count,
  labelWidth = 148,
}: {
  label: string;
  width: string;
  color: string;
  count: number | string;
  labelWidth?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${labelWidth}px 1fr 18px`,
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--sw-stone-600)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      <div style={{ height: 8, background: 'var(--sw-sand-100)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: color, width }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sw-ink-900)', textAlign: 'right' }}>{count}</span>
    </div>
  );
}

/* Design-system Callout (information / disclaimer / warning / success). */
export function Callout({
  variant = 'information',
  title,
  children,
}: {
  variant?: 'information' | 'success' | 'warning' | 'disclaimer';
  title?: string;
  children: ReactNode;
}) {
  const map = {
    information: { bg: 'var(--sw-information-bg)', bar: 'var(--sw-information)' },
    success: { bg: 'var(--sw-success-bg)', bar: 'var(--sw-success)' },
    warning: { bg: 'var(--sw-warning-bg)', bar: 'var(--sw-warning)' },
    disclaimer: { bg: 'var(--sw-mist-100)', bar: 'var(--sw-forest-700)' },
  } as const;
  const t = map[variant];
  return (
    <div
      role="note"
      style={{
        display: 'flex',
        gap: 14,
        background: t.bg,
        borderRadius: 'var(--radius-callout)',
        borderLeft: `4px solid ${t.bar}`,
        padding: '16px 18px',
        fontFamily: 'var(--font-body)',
        color: 'var(--sw-ink-900)',
        lineHeight: 1.6,
      }}
    >
      <div>
        {title && <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>{title}</div>}
        <div style={{ fontSize: 15 }}>{children}</div>
      </div>
    </div>
  );
}

/* Date tile (day number over month) used for calls. */
export function DateTile({
  day,
  month = 'Jun',
  size = 'sm',
}: {
  day: number | string;
  month?: string;
  size?: 'sm' | 'lg';
}) {
  const lg = size === 'lg';
  return (
    <div
      style={{
        width: lg ? 54 : 46,
        flexShrink: 0,
        textAlign: 'center',
        background: 'var(--sw-mist-100)',
        borderRadius: lg ? 12 : 10,
        padding: lg ? '10px 0' : '6px 0',
        alignSelf: lg ? 'flex-start' : undefined,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: lg ? 21 : 17,
          color: 'var(--sw-forest-900)',
          lineHeight: 1.1,
        }}
      >
        {day}
      </div>
      <div
        style={{
          fontSize: lg ? 10.5 : 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--sw-stone-600)',
        }}
      >
        {month}
      </div>
    </div>
  );
}

/* Uppercase field label used in info cards. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--sw-stone-600)',
      }}
    >
      {children}
    </div>
  );
}
