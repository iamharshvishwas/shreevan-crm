import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { ApiUser } from '../api/users';
import {
  CHANNEL_LABEL, ConvertBody, EnquiryDetail, enquiriesApi,
} from '../api/enquiries';
import { CloseIcon } from './icons';
import { Callout } from './ui';

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)', marginBottom: 6 } as const;
const inputStyle = { width: '100%', height: 42, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--sw-ink-900)', background: '#ffffff' } as const;
const selectStyle = { ...inputStyle, padding: '0 10px', cursor: 'pointer' } as const;

const PROGRAMS = ['28-Day Personal Reset', '14-Day Foundations Program', '28-Day Practice Immersion', '28-Day Clarity Retreat', '60-Day Integration Masterclass', 'Not sure yet'];

export function ConvertToLeadModal({
  enquiry, users, onCancel, onConverted,
}: {
  enquiry: EnquiryDetail;
  users: ApiUser[];
  onCancel: () => void;
  onConverted: (message: string) => void;
}) {
  const [dupes, setDupes] = useState<{ id: string; programInterest: string | null }[]>([]);
  const [owner, setOwner] = useState(enquiry.owner?.id ?? users[0]?.id ?? '');
  const [nextAction, setNextAction] = useState('Send first response');
  const [nextDate, setNextDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [program, setProgram] = useState(enquiry.programInterest ?? PROGRAMS[0]);
  const [temperature, setTemperature] = useState<'HOT' | 'WARM' | 'COLD'>('WARM');
  const [valueAmount, setValueAmount] = useState('');
  const [valueCurrency, setValueCurrency] = useState<'USD' | 'INR'>(enquiry.contact.country === 'India' ? 'INR' : 'USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    enquiriesApi.duplicateLeads(enquiry.id).then((r) => setDupes(r.leads)).catch(() => setDupes([]));
  }, [enquiry.id]);

  async function run(body: ConvertBody, successMsg: string) {
    setBusy(true);
    setError(null);
    try {
      await enquiriesApi.convert(enquiry.id, body);
      onConverted(successMsg);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  }

  function create() {
    if (!owner || !nextAction.trim() || !nextDate) {
      setError('Owner, next action and next-action date are required.');
      return;
    }
    void run(
      {
        ownerId: owner,
        nextAction: nextAction.trim(),
        nextActionDate: new Date(`${nextDate}T09:00:00`).toISOString(),
        programInterest: program,
        temperature,
        expectedValueAmount: valueAmount ? Math.round(Number(valueAmount) * 100) : undefined,
        expectedValueCurrency: valueAmount ? valueCurrency : undefined,
      },
      `${enquiry.contact.name} converted to a qualified lead.`,
    );
  }

  return (
    <div
      onClick={(e) => { if ((e.target as HTMLElement).dataset.backdrop) onCancel(); }}
      data-backdrop="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,42,34,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sw-fade-in 160ms var(--ease-calm)' }}
    >
      <div style={{ width: 640, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: '#ffffff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: '28px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: 'var(--sw-ink-900)' }}>Convert to lead</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: 13, color: 'var(--sw-stone-600)' }}>
              Qualify this {CHANNEL_LABEL[enquiry.channel]} enquiry with {enquiry.contact.name} into a commercial opportunity.
            </p>
          </div>
          <button onClick={onCancel} title="Close" className="hov-mist" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sw-stone-600)', padding: 6, borderRadius: 8, display: 'flex' }}>
            <CloseIcon />
          </button>
        </div>

        {dupes.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <Callout variant="warning" title="Possible existing lead">
              <div style={{ fontSize: 13 }}>
                These look like the same person. Link this enquiry instead of creating a duplicate:
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {dupes.map((l) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fff', border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 13, color: 'var(--sw-ink-900)' }}>{l.programInterest ?? 'Existing lead'}</div>
                      <button
                        onClick={() => void run({ linkExistingLeadId: l.id, nextAction: nextAction || 'Follow up', nextActionDate: new Date(`${nextDate}T09:00:00`).toISOString() }, `Enquiry linked to existing lead.`)}
                        disabled={busy}
                        style={{ height: 30, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Link instead
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Callout>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginTop: 20 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={labelStyle}>Contact</span>
            <div style={{ fontSize: 13.5, color: 'var(--sw-ink-900)', fontWeight: 600 }}>{enquiry.contact.name}</div>
            <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 2 }}>
              {enquiry.contact.country ?? '—'} · {CHANNEL_LABEL[enquiry.firstTouchSource]} first-touch
            </div>
          </div>
          <div>
            <label style={labelStyle}>Interested program</label>
            <select value={program} onChange={(e) => setProgram(e.target.value)} style={selectStyle}>
              {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Expected value</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={valueAmount} onChange={(e) => setValueAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 4200" style={{ ...inputStyle, flex: 1 }} />
              <select value={valueCurrency} onChange={(e) => setValueCurrency(e.target.value as 'USD' | 'INR')} style={{ ...selectStyle, width: 84 }}>
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Assigned owner <span style={{ color: 'var(--sw-clay-600)' }}>*</span></label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={selectStyle}>
              <option value="" disabled>Select…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Lead temperature</label>
            <select value={temperature} onChange={(e) => setTemperature(e.target.value as 'HOT' | 'WARM' | 'COLD')} style={selectStyle}>
              <option value="WARM">Warm</option><option value="HOT">Hot</option><option value="COLD">Cold</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Next action <span style={{ color: 'var(--sw-clay-600)' }}>*</span></label>
            <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Next action date <span style={{ color: 'var(--sw-clay-600)' }}>*</span></label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: 'var(--sw-error)', fontWeight: 600, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onCancel} className="hov-mist-link" style={{ height: 42, padding: '0 18px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--sw-river-600)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={create} disabled={busy} className="hov-forest-deep" style={{ height: 42, padding: '0 22px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Creating…' : 'Create qualified lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
