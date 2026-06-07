import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { matterId, clientId, attorneyId, appUrl } = req.body;
  if (!matterId || !clientId || !attorneyId) return res.status(400).json({ error: 'Missing fields' });

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  const { data: client } = await supabaseAdmin.from('clients').select('full_name, email').eq('id', clientId).single();
  const { data: attorney } = await supabaseAdmin.from('profiles').select('full_name').eq('id', attorneyId).single();
  const { data: matter } = await supabaseAdmin.from('matters').select('name').eq('id', matterId).single();

  if (!client?.email) return res.status(400).json({ error: 'Client has no email address' });

  // Create satisfaction record with unique token
  const { data: record } = await supabaseAdmin.from('client_satisfaction').insert([{
    matter_id: matterId, client_id: clientId, attorney_id: attorneyId, rating: 1, submitted: false,
  }]).select().single();

  const ratingUrl = `${appUrl}/rate?token=${record.token}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f5f5f5;">
      <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
        <h2 style="color:#8DC63F;margin:0;">${firmName}</h2>
      </div>
      <div style="background:#fff;border-radius:10px;padding:32px;">
        <h3 style="color:#111;margin:0 0 12px;">Dear ${client.full_name},</h3>
        <p style="font-size:14px;color:#555;margin-bottom:16px;">Your matter <strong>${matter?.name || matterId}</strong> has been concluded. We hope we provided excellent service.</p>
        <p style="font-size:14px;color:#555;margin-bottom:24px;">We would appreciate it if you could take 30 seconds to rate your experience with <strong>${attorney?.full_name}</strong>:</p>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${ratingUrl}" style="background:#8DC63F;color:#0A0A0A;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">Rate My Experience ★</a>
        </div>
        <p style="font-size:12px;color:#9CA3AF;text-align:center;">Your feedback is confidential and helps us improve our service.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:11px;color:#ccc;text-align:center;">${firmName}${firm?.phone ? ' · ' + firm.phone : ''}</p>
      </div>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${firmName} <onboarding@resend.dev>`,
        to: client.email,
        subject: `How was your experience with ${attorney?.full_name}? — ${firmName}`,
        html,
      }),
    });
  }

  return res.status(200).json({ success: true, token: record.token, sentTo: client.email });
}
