import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });
  const { invoiceId, recipientEmail } = req.body;
  if (!invoiceId) return res.status(400).json({ error: 'Invoice ID required' });

  const { data: inv } = await supabaseAdmin.from('invoices').select('*').eq('id', invoiceId).single();
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'Motsoeneng Bill';

  // Resolve recipient email — passed in, or look up from clients table
  let toEmail = recipientEmail;
  if (!toEmail && inv.client_id) {
    const { data: client } = await supabaseAdmin.from('clients').select('email').eq('id', inv.client_id).single();
    toEmail = client?.email;
  }
  if (!toEmail) return res.status(400).json({ error: 'No email address found for this client. Please add one in the Clients section.' });

  const excl   = (inv.total_units || 0) * (inv.rate || 150);
  const vat    = excl * 0.15;
  const total  = excl * 1.15;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;background:#f5f5f5;">
      <div style="background:#0A0A0A;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
        ${firm?.logo_url ? `<img src="${firm.logo_url}" alt="Logo" style="height:40px;margin-bottom:8px;"/>` : ''}
        <h1 style="color:#8DC63F;margin:0;font-size:22px;font-weight:900;">${firmName}</h1>
        <p style="color:#555;margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">TAX INVOICE</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:32px;">
        <table style="width:100%;margin-bottom:24px;">
          <tr>
            <td style="font-size:13px;color:#666;">Invoice No.</td>
            <td style="font-size:13px;font-weight:700;text-align:right;">${inv.id}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#666;padding-top:6px;">Client</td>
            <td style="font-size:13px;font-weight:700;text-align:right;padding-top:6px;">${inv.client}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#666;padding-top:6px;">Matter</td>
            <td style="font-size:13px;text-align:right;padding-top:6px;color:#7c3aed;">${inv.matter_id || inv.matter_name || '—'}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#666;padding-top:6px;">Period</td>
            <td style="font-size:13px;text-align:right;padding-top:6px;">${inv.period_label || '—'}</td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#f8f8f8;">
              <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:left;border-bottom:2px solid #eee;">Description</th>
              <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:right;border-bottom:2px solid #eee;">Units</th>
              <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:right;border-bottom:2px solid #eee;">Rate</th>
              <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:right;border-bottom:2px solid #eee;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:12px;font-size:13px;border-bottom:1px solid #f0f0f0;">Professional fees — ${inv.period_label || inv.attorney || 'Legal services'}</td>
              <td style="padding:12px;font-size:13px;text-align:right;border-bottom:1px solid #f0f0f0;">${inv.total_units}</td>
              <td style="padding:12px;font-size:13px;text-align:right;border-bottom:1px solid #f0f0f0;">R${inv.rate || 150}</td>
              <td style="padding:12px;font-size:13px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600;">R${excl.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <table style="width:100%;max-width:280px;margin-left:auto;margin-bottom:24px;">
          <tr>
            <td style="font-size:12px;color:#666;padding:4px 0;">Subtotal (excl. VAT)</td>
            <td style="font-size:12px;text-align:right;padding:4px 0;">R${excl.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#666;padding:4px 0;">VAT (15%)</td>
            <td style="font-size:12px;text-align:right;padding:4px 0;">R${vat.toFixed(2)}</td>
          </tr>
          <tr style="border-top:2px solid #eee;">
            <td style="font-size:15px;font-weight:700;padding:10px 0 4px;"><strong>TOTAL DUE</strong></td>
            <td style="font-size:15px;font-weight:700;text-align:right;padding:10px 0 4px;color:#16a34a;">R${total.toFixed(2)}</td>
          </tr>
        </table>
        ${firm?.bank_name ? `
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="font-size:10px;text-transform:uppercase;color:#999;letter-spacing:.08em;margin-bottom:8px;">Payment Details</div>
          <div style="font-size:13px;color:#333;line-height:1.8;">
            Bank: <strong>${firm.bank_name}</strong><br/>
            Account: <strong>${firm.bank_account || '—'}</strong><br/>
            Branch code: <strong>${firm.bank_branch || '—'}</strong><br/>
            Reference: <strong>${inv.id}</strong>
          </div>
        </div>` : ''}
        ${firm?.invoice_footer ? `<p style="font-size:11px;color:#999;text-align:center;margin:0;">${firm.invoice_footer}</p>` : ''}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:11px;color:#ccc;text-align:center;margin:0;">${firmName}${firm?.vat_number ? ' · VAT Reg: ' + firm.vat_number : ''}</p>
      </div>
    </div>
  `;

  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ success: true, warning: 'RESEND_API_KEY not set — email not sent in dev mode.' });
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `${firmName} <onboarding@resend.dev>`,
      to: toEmail,
      subject: `Invoice ${inv.id} — ${firmName}`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }

  return res.status(200).json({ success: true, sentTo: toEmail });
}
