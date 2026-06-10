import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(full_name, email)')
    .eq('written_off', false)
    .order('created_at', { ascending: false });

  const { data: payments } = await supabaseAdmin
    .from('invoice_payments')
    .select('invoice_id, amount');

  const now = new Date();
  let sent = 0;

  // Group overdue invoices by client email
  const byClient = {};
  for (const inv of (invoices || [])) {
    const age = Math.floor((now - new Date(inv.created_at)) / 86400000);
    if (age < 30) continue;

    const paid = (payments || []).filter(p => p.invoice_id === inv.id).reduce((s,p) => s + Number(p.amount), 0);
    const outstanding = Math.max(0, (inv.total_units||0)*(inv.rate||150)*1.15 - paid);
    if (outstanding <= 0) continue;

    const email = inv.clients?.email || inv.client_email;
    if (!email) continue;

    if (!byClient[email]) byClient[email] = { name: inv.clients?.full_name || inv.client, email, invoices: [] };
    byClient[email].invoices.push({ ...inv, outstanding, age });
  }

  for (const { name, email, invoices: overdueInvs } of Object.values(byClient)) {
    const total = overdueInvs.reduce((s,i) => s + i.outstanding, 0);
    const rows = overdueInvs.map(i => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;color:#666;">${i.id}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;">${i.matter_id||'—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#dc2626;font-weight:700;">${i.age} days</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;font-weight:700;text-align:right;">R${i.outstanding.toFixed(2)}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f5f5f5;">
        <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
          <h2 style="color:#8DC63F;margin:0;">${firmName}</h2>
          <p style="color:#555;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:.1em;">Account Statement</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:24px;">
          <p style="font-size:14px;color:#333;">Dear ${name},</p>
          <p style="font-size:14px;color:#333;">This is a friendly reminder that the following invoices are outstanding on your account:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead><tr style="background:#f8f8f8;">
              <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:left;">Invoice</th>
              <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:left;">Matter</th>
              <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:left;">Age</th>
              <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;color:#999;text-align:right;">Outstanding</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="background:#f8f8f8;">
              <td colspan="3" style="padding:10px 12px;font-weight:700;font-size:13px;">TOTAL DUE</td>
              <td style="padding:10px 12px;font-weight:700;font-size:15px;text-align:right;color:#dc2626;">R${total.toFixed(2)}</td>
            </tr></tfoot>
          </table>
          ${firm?.bank_name ? `
          <div style="background:#f8f8f8;border-radius:8px;padding:14px;margin:16px 0;">
            <div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:6px;">Payment Details</div>
            <div style="font-size:13px;line-height:1.8;color:#333;">
              Bank: <strong>${firm.bank_name}</strong><br/>
              Account: <strong>${firm.bank_account||'—'}</strong><br/>
              Branch: <strong>${firm.bank_branch||'—'}</strong>
            </div>
          </div>` : ''}
          <p style="font-size:13px;color:#666;">Please arrange payment at your earliest convenience. If you have already made payment, please disregard this notice.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
          <p style="font-size:11px;color:#ccc;text-align:center;">${firmName}${firm?.email ? ' · ' + firm.email : ''}</p>
        </div>
      </div>
    `;

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${firmName} <onboarding@resend.dev>`,
          to: email,
          subject: `Account Statement — R${total.toFixed(2)} outstanding — ${firmName}`,
          html,
        }),
      });
      sent++;
    }
  }

  return res.status(200).json({ sent, clients: Object.keys(byClient).length });
}
