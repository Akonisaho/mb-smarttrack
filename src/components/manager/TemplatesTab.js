import { useState } from 'react';
import { C } from '../../lib/styles';
import { fmtDate } from '../../lib/format';

export default function TemplatesTab({ matters, profiles }) {
  const [selTemplate, setSelTemplate] = useState('');

  const TEMPLATES = [
    { id: 'engagement', label: 'Letter of Engagement', icon: '📋', desc: "Formal letter setting out the firm's mandate and fee arrangement" },
    { id: 'demand', label: 'Letter of Demand', icon: '⚠️', desc: 'Formal demand for payment or performance within 7 days' },
    { id: 'trust_receipt', label: 'Trust Receipt', icon: '🏦', desc: 'Acknowledgement of funds received into the trust account' },
    { id: 'withdrawal', label: 'Notice of Withdrawal', icon: '📄', desc: 'Notice of withdrawal as attorney of record' },
  ];

  const generate = type => {
    const m2 = selTemplate ? matters.find(x => x.id === selTemplate) : null;
    const a2 = m2 ? profiles.find(p => p.id === m2.user_id) : null;
    const d = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
    const hdr = `<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px"><strong style="font-size:18px">MOTSOENENG BILL</strong><br/><small>Attorneys · Notaries · Conveyancers</small></div>`;
    const ftr = `<div style="margin-top:40px;border-top:1px solid #ccc;padding-top:12px;font-size:11px;text-align:center">Motsoeneng Bill</div>`;
    let html = '';
    const base = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;max-width:800px;margin:40px auto;padding:40px;font-size:13px;line-height:1.6}</style></head><body>`;
    if (type === 'engagement') html = `${base}${hdr}<p><strong>DATE:</strong> ${d}</p><p><strong>Our Ref:</strong> ${m2?.id || '[MATTER REF]'}</p><br/><p><strong>TO: ${m2?.client || '[CLIENT NAME]'}</strong></p><br/><h3 style="text-transform:uppercase">Letter of Engagement</h3><p>Dear ${m2?.client || '[Client]'},</p><p>We confirm our mandate to act on your behalf in: <strong>${m2?.name || '[MATTER DESCRIPTION]'}</strong></p><p>Attorney responsible: <strong>${a2?.full_name || '[ATTORNEY]'}</strong></p><p>Our fees are charged at R${a2?.rate || 150} per billing unit (6 minutes), invoiced monthly and payable within 30 days.</p><br/><p>Yours faithfully,</p><br/><br/><p><strong>${a2?.full_name || '[ATTORNEY]'}</strong><br/>Motsoeneng Bill</p>${ftr}</body></html>`;
    else if (type === 'demand') html = `${base}${hdr}<p><strong>DATE:</strong> ${d}</p><p><strong>Our Ref:</strong> ${m2?.id || '[MATTER REF]'}</p><br/><p><strong>BY EMAIL AND REGISTERED POST</strong></p><br/><p><strong>TO: ${m2?.client || '[RESPONDENT]'}</strong></p><br/><h3 style="text-transform:uppercase">Letter of Demand</h3><p>We hereby demand that you comply with the following within <strong>7 (seven) days</strong>:</p><p>[STATE DEMAND CLEARLY]</p><p>Failure to comply will result in legal proceedings without further notice, in which event you will be liable for all legal costs on an attorney and own client scale.</p><br/><p>Yours faithfully,</p><br/><br/><p><strong>${a2?.full_name || '[ATTORNEY]'}</strong><br/>Attorneys for ${m2?.client || '[Client]'}</p>${ftr}</body></html>`;
    else if (type === 'trust_receipt') html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:40px;font-size:13px}</style></head><body>${hdr}<h3 style="text-align:center;text-transform:uppercase">Trust Receipt</h3><table style="width:100%;border-collapse:collapse;margin-top:20px"><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ccc">${d}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Received from</strong></td><td style="padding:8px;border:1px solid #ccc">${m2?.client || '[CLIENT NAME]'}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Matter</strong></td><td style="padding:8px;border:1px solid #ccc">${m2?.id || '[REF]'} — ${m2?.name || '[MATTER]'}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Amount (R)</strong></td><td style="padding:8px;border:1px solid #ccc">R ___________</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Purpose</strong></td><td style="padding:8px;border:1px solid #ccc">___________</td></tr></table><br/><p>Signed: _________________________<br/>${a2?.full_name || '[ATTORNEY]'}<br/>Motsoeneng Bill</p>${ftr}</body></html>`;
    else html = `${base}${hdr}<p><strong>DATE:</strong> ${d}</p><br/><p><strong>TO: The Registrar / Clerk of the Court</strong></p><br/><h3 style="text-transform:uppercase">Notice of Withdrawal as Attorney of Record</h3><p>Matter: ${m2?.id || '[REF]'} — Client: ${m2?.client || '[CLIENT]'}</p><p>TAKE NOTICE that MOTSOENENG BILL hereby withdraws as attorney of record for ${m2?.client || '[CLIENT]'} in the above matter, effective immediately.</p><p>Last known address of client: [CLIENT ADDRESS]</p><br/><p>Yours faithfully,</p><br/><br/><p><strong>${a2?.full_name || '[ATTORNEY]'}</strong><br/>Motsoeneng Bill</p>${ftr}</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Document Templates</div>
          <div className="mb-sub">Generate standard firm documents — select matter to pre-fill details</div>
        </div>
      </div>

      <div className="mb-card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 10 }}>Select Matter (optional — pre-fills client and attorney details)</div>
        <select className="mb-sel" style={{ maxWidth: 500 }} value={selTemplate} onChange={e => setSelTemplate(e.target.value)}>
          <option value="">— No matter selected (blank template) —</option>
          {matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.name} — {m.client}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        {TEMPLATES.map(t => (
          <div key={t.id} className="mb-card">
            <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>{t.desc}</div>
            <button className="mb-btn mb-btn-primary" onClick={() => generate(t.id)}>Generate &amp; Print</button>
          </div>
        ))}
      </div>
    </div>
  );
}
