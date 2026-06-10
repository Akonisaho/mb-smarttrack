import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  // Vercel cron passes Authorization header
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);
  const in7  = new Date(today); in7.setDate(today.getDate() + 7);

  const fmt = (d) => d.toLocaleDateString('en-CA');

  // Fetch matters with prescription dates in next 30 days
  const { data: matters } = await supabaseAdmin
    .from('matters')
    .select('id, name, client, user_id, prescription_date')
    .not('prescription_date', 'is', null)
    .eq('status', 'open')
    .gte('prescription_date', fmt(today))
    .lte('prescription_date', fmt(in30));

  if (!matters?.length) return res.status(200).json({ sent: 0 });

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  let sent = 0;
  for (const m of matters) {
    const prescDate = new Date(m.prescription_date + 'T12:00:00');
    const daysLeft = Math.floor((prescDate - today) / 86400000);

    if (![30, 14, 7].includes(daysLeft)) continue;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', m.user_id)
      .single();

    if (!profile?.email) continue;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f5f5f5;">
        <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
          <h2 style="color:#E05252;margin:0;">⚠ Prescription Date Alert</h2>
          <p style="color:#666;margin:6px 0 0;font-size:12px;">${firmName}</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:24px;">
          <p style="font-size:14px;color:#333;">Hi ${profile.full_name},</p>
          <p style="font-size:14px;color:#333;">The following matter prescribes in <strong style="color:#E05252;">${daysLeft} days</strong>:</p>
          <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;">
            <div style="font-size:12px;color:#999;margin-bottom:4px;">Matter</div>
            <div style="font-size:16px;font-weight:700;color:#111;">${m.name}</div>
            <div style="font-size:13px;color:#555;margin-top:4px;">Client: ${m.client}</div>
            <div style="font-size:13px;color:#555;">Matter ID: ${m.id}</div>
            <div style="font-size:14px;font-weight:700;color:#E05252;margin-top:8px;">Prescription Date: ${prescDate.toLocaleDateString('en-ZA',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
          </div>
          <p style="font-size:13px;color:#666;">Please take the necessary action before the prescription date to protect your client's rights.</p>
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
          to: profile.email,
          subject: `⚠ Prescription Alert — ${m.name} prescribes in ${daysLeft} days`,
          html,
        }),
      });
      sent++;
    }
  }

  return res.status(200).json({ sent, checked: matters.length });
}
