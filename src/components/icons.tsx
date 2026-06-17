import type { CSSProperties } from 'react';

type IconPart =
  | string
  | { c: [number, number, number] }
  | { r: [number, number, number, number, number?] };

interface IcProps {
  parts: IconPart[];
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}

/** Lucide-style outline icon: rounded caps, 1.75px default stroke. */
export function Ic({ parts, size = 18, strokeWidth = 1.75, style }: IcProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {parts.map((p, i) => {
        if (typeof p === 'string') return <path key={i} d={p} />;
        if ('c' in p) return <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />;
        return <rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4] || 0} />;
      })}
    </svg>
  );
}

export const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <Ic parts={[{ c: [11, 11, 8] }, 'm21 21-4.3-4.3']} size={size} />
);

export const BellIcon = () => (
  <Ic parts={['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0']} size={17} />
);

export const PlusIcon = () => <Ic parts={['M5 12h14', 'M12 5v14']} size={15} strokeWidth={2} />;

export const WarningIcon = ({ size = 17 }: { size?: number }) => (
  <Ic
    parts={['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z', 'M12 9v4', 'M12 17h.01']}
    size={size}
  />
);

export const CalendarIcon = ({ size = 17, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) => (
  <Ic
    parts={['M8 2v4', 'M16 2v4', { r: [3, 4, 18, 18, 2] }, 'M3 10h18']}
    size={size}
    strokeWidth={strokeWidth}
  />
);

export const ClockIcon = ({ size = 13, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) => (
  <Ic parts={[{ c: [12, 12, 10] }, 'M12 6v6l4 2']} size={size} strokeWidth={strokeWidth} />
);

export const CloseIcon = ({ size = 18 }: { size?: number }) => (
  <Ic parts={['M18 6 6 18', 'm6 6 12 12']} size={size} strokeWidth={2} />
);

export const CheckIcon = ({ size = 22 }: { size?: number }) => (
  <Ic parts={['M20 6 9 17l-5-5']} size={size} />
);

export const BackIcon = () => <Ic parts={['m12 19-7-7 7-7', 'M19 12H5']} size={15} />;

export const ExportIcon = () => (
  <Ic parts={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3']} size={14} />
);

export const CollapseIcon = () => (
  <Ic parts={['m11 17-5-5 5-5', 'm18 17-5-5 5-5']} size={16} strokeWidth={2} />
);

export const DocumentIcon = ({ size = 22 }: { size?: number }) => (
  <Ic parts={['M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z', 'M14 2v6h6']} size={size} />
);

export const ErrorCircleIcon = () => (
  <Ic parts={[{ c: [12, 12, 10] }, 'M12 8v4', 'M12 16h.01']} size={14} strokeWidth={2} />
);

export const PhoneIcon = ({ size = 14 }: { size?: number }) => (
  <Ic
    parts={[
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    ]}
    size={size}
  />
);
