import { useRef, useState } from 'react';
import type { AppStore } from '../store';
import { ApiError } from '../api/client';
import { CHANNEL_LABEL, enquiriesApi, type Channel, type ManualEnquiryBody } from '../api/enquiries';
import { CloseIcon, ErrorCircleIcon } from './icons';

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)', marginBottom: 6 } as const;
const inputStyle = { width: '100%', height: 42, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--sw-ink-900)', background: '#ffffff' } as const;
const selectStyle = { ...inputStyle, padding: '0 10px', cursor: 'pointer' } as const;

const CHANNELS: Channel[] = ['PHONE', 'WALKIN', 'WHATSAPP', 'EMAIL', 'INSTAGRAM', 'FACEBOOK', 'WEBSITE_FORM', 'REFERRAL'];
const COUNTRIES = ['United Kingdom', 'USA', 'Canada', 'Australia', 'India', 'Other'];
const PROGRAMS = ['28-Day Personal Reset', '14-Day Foundations Program', '28-Day Practice Immersion', '28-Day Clarity Retreat', '60-Day Integration Masterclass', 'Not sure yet'];

/** Captures a manual enquiry (phone/walk-in/etc.) — runs through the backend
 *  ingestion pipeline so it appears in Enquiries and routes/SLAs apply. */
export function AddLeadModal({ app }: { app: AppStore }) {
  const draft = useRef<Partial<ManualEnquiryBody>>({ channel: 'PHONE', country: 'India', programInterest: '28-Day Personal Reset' });
  const [busy, setBusy] = useState(false);

  function close() { app.setShowAddLead(false); app.setAddError(false); }
  function set<K extends keyof ManualEnquiryBody>(k: K, v: ManualEnquiryBody[K]) { draft.current[k] = v; }

  async function save() {
    const d = draft.current;
    if (!d.name?.trim() || !d.message?.trim()) { app.setAddError(true); return; }
    setBusy(true);
    try {
      const res = await enquiriesApi.manual({
        name: d.name.trim(),
        channel: d.channel ?? 'PHONE',
        country: d.country,
        email: d.email,
        phone: d.phone,
        message: d.message.trim(),
        programInterest: d.programInterest,
      });
      close();
      app.showToastMsg(`Enquiry captured — ${d.name.trim()} is now in the inbox.`);
      app.goNav('enquiries');
      void res;
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Could not save enquiry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={(e) => { if ((e.target as HTMLElement).dataset.backdrop) close(); }} data-backdrop="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,42,34,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sw-fade-in 160ms var(--ease-calm)' }}>
      <div style={{ width: 640, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: '#ffffff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: '28px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: 'var(--sw-ink-900)' }}>Add an enquiry</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: 13, color: 'var(--sw-stone-600)' }}>Log a phone, walk-in or referred enquiry — it enters the inbox and gets routed.</p>
          </div>
          <button onClick={close} title="Close" className="hov-mist" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sw-stone-600)', padding: 6, borderRadius: 8, display: 'flex' }}><CloseIcon /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginTop: 22 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="nl-name" style={labelStyle}>Full name <span style={{ color: 'var(--sw-clay-600)' }}>*</span></label>
            <input id="nl-name" onChange={(e) => set('name', e.target.value)} placeholder="e.g. Olivia Bennett" style={inputStyle} />
            {app.addError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--sw-error)', fontWeight: 600, marginTop: 6 }}>
                <ErrorCircleIcon /> Name and message are required.
              </div>
            )}
          </div>
          <div>
            <label htmlFor="nl-channel" style={labelStyle}>Channel</label>
            <select id="nl-channel" defaultValue="PHONE" onChange={(e) => set('channel', e.target.value as Channel)} style={selectStyle}>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nl-country" style={labelStyle}>Country</label>
            <select id="nl-country" defaultValue="India" onChange={(e) => set('country', e.target.value)} style={selectStyle}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nl-email" style={labelStyle}>Email</label>
            <input id="nl-email" type="email" onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="nl-phone" style={labelStyle}>Phone / WhatsApp</label>
            <input id="nl-phone" onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="nl-program" style={labelStyle}>Interested program</label>
            <select id="nl-program" defaultValue="28-Day Personal Reset" onChange={(e) => set('programInterest', e.target.value)} style={selectStyle}>
              {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="nl-msg" style={labelStyle}>Enquiry / message <span style={{ color: 'var(--sw-clay-600)' }}>*</span></label>
            <textarea id="nl-msg" rows={3} onChange={(e) => set('message', e.target.value)} placeholder="What did they ask about?" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 26 }}>
          <button onClick={close} className="hov-mist-link" style={{ height: 42, padding: '0 18px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--sw-river-600)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={busy} className="hov-forest-deep" style={{ height: 42, padding: '0 22px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Add enquiry'}</button>
        </div>
      </div>
    </div>
  );
}
