import { useState } from 'react';
import { C } from '../../lib/styles';

export default function CampaignsTab({ matters, clients, isMobile, showAlert }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recip, setRecip] = useState('all');
  const [matter, setMatter] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    if (!subject.trim() || !body.trim()) { showAlert('Subject and body are required.', 'error'); return; }
    setSending(true); setResult(null);
    const r = await fetch('/api/send-campaign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, body, recipientType: recip, matterId: matter }) });
    const d = await r.json();
    setSending(false); setResult(d);
    if (r.ok) showAlert(d.message || `✓ Sent to ${d.sent} client(s).`);
    else showAlert('Error: ' + (d.error || 'Failed'), 'error');
  };

  const templates = [
    { t: 'Overdue Notice', s: 'Outstanding invoice reminder — action required', b: 'We wish to draw your attention to an outstanding invoice on your account that is now overdue.\n\nPlease make payment at your earliest convenience to avoid further action. If you have already made payment, please disregard this notice.\n\nShould you wish to discuss a payment arrangement, please contact our offices.' },
    { t: 'Matter Update', s: 'Update on your legal matter', b: 'We would like to provide you with an update on your matter currently in our care.\n\nPlease contact our offices at your earliest convenience to discuss the progress and next steps.\n\nWe remain committed to resolving your matter efficiently.' },
    { t: 'FICA Reminder', s: 'FICA documentation required — urgent', b: 'In terms of the Financial Intelligence Centre Act (FICA), we are required to obtain and verify your identification documents.\n\nPlease bring a certified copy of your ID and proof of residence to our offices or reply to this email with the required documents at your earliest convenience.\n\nFailure to provide these documents may result in us being unable to continue acting on your behalf.' },
  ];

  return (
    <div className="mb-main">
      <div style={{ marginBottom: 14 }}>
        <div className="mb-heading">Client Campaigns</div>
        <div className="mb-sub">Send bulk emails to clients — overdue notices, newsletters, announcements</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div className="mb-card">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 14 }}>Compose Campaign</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="mb-lbl">Recipients</label>
              <select className="mb-field" value={recip} onChange={e => setRecip(e.target.value)}>
                <option value="all">All active clients</option>
                <option value="overdue">Clients with overdue invoices</option>
                <option value="matter">Specific matter clients</option>
              </select>
            </div>
            {recip === 'matter' && (
              <div>
                <label className="mb-lbl">Matter</label>
                <select className="mb-field" value={matter} onChange={e => setMatter(e.target.value)}>
                  <option value="">— Select matter —</option>
                  {matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-lbl">Subject *</label>
              <input className="mb-field" type="text" placeholder="e.g. Important update regarding your matter" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="mb-lbl">Message Body *</label>
              <textarea className="mb-field" placeholder="Write your message here." value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 160, resize: 'vertical' }} />
            </div>
            <button className="mb-btn mb-btn-primary" style={{ opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={send}>
              {sending ? 'Sending…' : 'Send Campaign'}
            </button>
            {result && (
              <div style={{ background: result.error ? 'rgba(220,80,80,0.1)' : 'rgba(141,198,63,0.08)', border: `1px solid ${result.error ? 'rgba(220,80,80,0.3)' : 'rgba(141,198,63,0.25)'}`, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: result.error ? '#E05252' : '#8DC63F' }}>
                {result.message || result.error}
              </div>
            )}
          </div>
        </div>

        <div className="mb-card">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 14 }}>Quick Templates</div>
          {templates.map(({ t, s, b }) => (
            <div key={t} style={{ borderBottom: '1px solid #1A1A1A', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#C8C8C8', marginBottom: 4 }}>{t}</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8, lineHeight: 1.4 }}>{s}</div>
              <button className="mb-btn" style={{ fontSize: 11 }} onClick={() => { setSubject(s); setBody(b); }}>Use this template →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
