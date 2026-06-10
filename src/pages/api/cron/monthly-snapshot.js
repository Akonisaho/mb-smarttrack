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

  // Calculate last month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStr = lastMonth.toLocaleDateString('en-CA').substring(0, 7);
  const monthLabel = lastMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, monthly_target, rate, role')
    .in('role', ['attorney', 'branch_manager']);

  const { data: activities } = await supabaseAdmin
    .from('activities')
    .select('user_id, billing_units, duration_seconds, is_billable, date')
    .neq('agent_id', 'demo')
    .gte('date', `${monthStr}-01`)
    .lte('date', `${monthStr}-31`);

  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('user_id, total_units, rate')
    .gte('created_at', `${monthStr}-01`)
    .lte('created_at', `${monthStr}-31`);

  let sent = 0;

  for (const p of (profiles || [])) {
    if (!p.email) continue;

    const acts = (activities || []).filter(a => a.user_id === p.id);
    const billable = acts.filter(a => a.is_billable);
    const units = billable.reduce((s, a) => s + (a.billing_units || 0), 0);
    const billSec = billable.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const totalSec = acts.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const invs = (invoices || []).filter(i => i.user_id === p.id);
    const invoiced = invs.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150) * 1.15, 0);
    const target = p.monthly_target || 0;
    const pct = target > 0 ? Math.round(units / target * 100) : null;
    const rate = p.rate || 150;
    const toHm = (s) => { s = Number(s) || 0; if (s <= 0) return '0m'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
    const utilisation = totalSec > 0 ? Math.round(billSec / totalSec * 100) : 0;

    const statusColor = pct === null ? '#888' : pct >= 100 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#dc2626';
    const statusMsg = pct === null ? 'No target set' : pct >= 100 ? '🎉 Target achieved!' : pct >= 70 ? '📈 Good progress' : '⚠️ Below target';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f5f5f5;">
        <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
          <h2 style="color:#8DC63F;margin:0;">Monthly Performance Summary</h2>
          <p style="color:#555;margin:4px 0 0;font-size:13px;">${monthLabel}</p>
          <p style="color:#333;margin:4px 0 0;font-size:12px;">${firmName}</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:24px;">
          <p style="font-size:15px;font-weight:700;color:#111;margin-bottom:4px;">Hi ${p.full_name},</p>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Here's your performance summary for ${monthLabel}.</p>

          ${pct !== null ? `
          <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-size:12px;color:#666;">Monthly Target Progress</span>
              <span style="font-size:12px;font-weight:700;color:${statusColor};">${pct}% · ${statusMsg}</span>
            </div>
            <div style="background:#f0f0f0;border-radius:4px;height:10px;overflow:hidden;">
              <div style="background:${statusColor};height:100%;width:${Math.min(pct,100)}%;border-radius:4px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="font-size:11px;color:#999;">${units} / ${target} units</span>
              <span style="font-size:11px;color:#999;">Target: ${target} units</span>
            </div>
          </div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            ${[
              ['Billing Units', `${units} units`, '#8DC63F'],
              ['Billable Time', toHm(billSec), '#4A90D9'],
              ['Utilisation', `${utilisation}%`, utilisation >= 70 ? '#16a34a' : '#f59e0b'],
              ['Revenue Invoiced', `R${invoiced.toFixed(2)}`, '#8DC63F'],
            ].map(([l,v,c]) => `
              <div style="background:#f8f8f8;border-radius:8px;padding:14px;">
                <div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:4px;">${l}</div>
                <div style="font-size:20px;font-weight:700;color:${c};">${v}</div>
              </div>`).join('')}
          </div>

          <p style="font-size:13px;color:#666;">Log in to view your full month breakdown and track your progress toward your next target.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
          <p style="font-size:11px;color:#ccc;text-align:center;">${firmName} · MB SmartTrack</p>
        </div>
      </div>
    `;

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${firmName} <onboarding@resend.dev>`,
          to: p.email,
          subject: `Your ${monthLabel} Performance Summary — ${pct !== null ? pct + '% of target' : units + ' units'}`,
          html,
        }),
      });
      sent++;
    }
  }

  return res.status(200).json({ sent, attorneys: profiles?.length || 0, month: monthStr });
}
