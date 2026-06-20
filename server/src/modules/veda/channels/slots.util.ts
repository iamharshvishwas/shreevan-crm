export interface ProposedSlot {
  iso: string;   // UTC ISO timestamp
  label: string; // short, <= 20 chars for a WhatsApp button title
}

const IST_OFFSET_MS = 5.5 * 3600_000;

/**
 * Propose the next few discovery-call slots at fixed IST hours (11:00, 16:00),
 * starting tomorrow. Returns UTC ISO + a short button label. Deliberately simple
 * — real availability/calendar integration is a later enhancement.
 */
export function proposeSlots(count = 3, hoursIst = [11, 16]): ProposedSlot[] {
  const slots: ProposedSlot[] = [];
  const now = Date.now();
  let dayOffset = 1; // start tomorrow

  while (slots.length < count && dayOffset <= 7) {
    for (const h of hoursIst) {
      if (slots.length >= count) break;
      // Build the IST wall-clock time, then convert to UTC.
      const istBase = new Date(now + dayOffset * 86_400_000 + IST_OFFSET_MS);
      const y = istBase.getUTCFullYear();
      const m = istBase.getUTCMonth();
      const d = istBase.getUTCDate();
      const utcMs = Date.UTC(y, m, d, h, 0, 0) - IST_OFFSET_MS;
      const utc = new Date(utcMs);
      slots.push({ iso: utc.toISOString(), label: labelFor(utc, dayOffset, h) });
    }
    dayOffset++;
  }
  return slots;
}

function labelFor(utc: Date, dayOffset: number, hourIst: number): string {
  const ampm = hourIst >= 12 ? 'PM' : 'AM';
  const h12 = hourIst > 12 ? hourIst - 12 : hourIst;
  const time = `${h12} ${ampm}`;
  if (dayOffset === 1) return `Tomorrow ${time}`;
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(utc);
  return `${wd} ${time}`;
}

/** Render a UTC ISO time for display in IST (used in confirmations). */
export function formatIst(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso)) + ' IST';
}
