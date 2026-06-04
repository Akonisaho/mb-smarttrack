import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, action, otp } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  // VERIFY OTP
  if (action === 'verify') {
    if (!otp) return res.status(400).json({ error: 'OTP required' });
    const { data: record } = await supabaseAdmin
      .from('portal_otps')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('otp', otp)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!record) return res.status(400).json({ error: 'Invalid or expired code. Please request a new one.' });
    await supabaseAdmin.from('portal_otps').update({ used: true }).eq('id', record.id);
    // Find client by email
    const { data: client } = await supabaseAdmin
      .from('clients').select('*').eq('email', email.toLowerCase().trim()).eq('is_active', true).maybeSingle();
    if (!client) return res.status(404).json({ error: 'No client account found for this email.' });
    return res.status(200).json({ success: true, clientId: client.id });
  }

  // SEND OTP
  const clientEmail = email.toLowerCase().trim();
  const { data: client } = await supabaseAdmin
    .from('clients').select('id,full_name').eq('email', clientEmail).eq('is_active', true).maybeSingle();
  if (!client) return res.status(404).json({ error: 'No account found for this email address. Please contact the firm.' });

  const otp6 = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabaseAdmin.from('portal_otps').insert([{ email: clientEmail, otp: otp6, expires_at: expiresAt }]);

  const { data: firmSettings } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firmSettings?.firm_name || 'SmartTrack';

  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${firmName} <onboarding@resend.dev>`,
        to: clientEmail,
        subject: `Your ${firmName} portal login code`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;background:#f5f5f5;">
            <div style="background:#0A0A0A;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
              <h1 style="color:#8DC63F;margin:0;font-size:24px;font-weight:900;">SmartTrack</h1>
              <p style="color:#666;margin:4px 0 0;font-size:12px;">${firmName}</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:32px;text-align:center;">
              <p style="color:#666;font-size:14px;margin:0 0 8px;">Hello ${client.full_name},</p>
              <p style="color:#666;font-size:14px;margin:0 0 24px;">Here is your one-time login code for the client portal:</p>
              <div style="background:#f8f8f8;border:2px solid #8DC63F;border-radius:12px;padding:24px;margin-bottom:24px;">
                <div style="font-size:40px;font-weight:900;letter-spacing:.3em;color:#111;font-family:monospace;">${otp6}</div>
              </div>
              <p style="color:#999;font-size:12px;margin:0;">This code expires in <strong>10 minutes</strong>.</p>
              <p style="color:#999;font-size:12px;margin:8px 0 0;">If you did not request this, please ignore this email.</p>
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0;">
              <p style="color:#ccc;font-size:11px;margin:0;">${firmName} · Client Portal</p>
            </div>
          </div>
        `,
      }),
    });
  }

  return res.status(200).json({ success: true, message: 'Code sent to your email.' });
}
