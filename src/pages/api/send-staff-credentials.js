import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { fullName, email, role, tempPassword, branchName } = req.body;
  if (!email || !tempPassword) return res.status(400).json({ error: 'Missing fields' });

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  const roleLabels = {
    attorney: 'Attorney / Fee Earner',
    branch_manager: 'Branch Manager',
    manager: 'National Manager',
    bookkeeper: 'Bookkeeper',
    receptionist: 'Receptionist',
    hr: 'HR',
  };

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f5f5f5;">
      <div style="background:#0A0A0A;border-radius:10px;padding:24px;text-align:center;margin-bottom:16px;">
        <h2 style="color:#8DC63F;margin:0;font-size:22px;font-weight:900;">${firmName}</h2>
        <p style="color:#555;margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">MB SmartTrack</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:32px;">
        <h3 style="margin:0 0 8px;color:#111;">Welcome, ${fullName}!</h3>
        <p style="font-size:14px;color:#555;margin-bottom:20px;">Your account has been created on the ${firmName} practice management system. Here are your login details:</p>

        <div style="background:#f8f8f8;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
          <table style="width:100%;">
            <tr><td style="font-size:12px;color:#999;padding:4px 0;">Role</td><td style="font-size:13px;font-weight:600;color:#111;">${roleLabels[role]||role}</td></tr>
            <tr><td style="font-size:12px;color:#999;padding:4px 0;">Branch</td><td style="font-size:13px;color:#111;">${branchName||'—'}</td></tr>
            <tr><td style="font-size:12px;color:#999;padding:4px 0;">Login Email</td><td style="font-size:13px;font-weight:600;color:#111;">${email}</td></tr>
            <tr><td style="font-size:12px;color:#999;padding:4px 0;">Temp Password</td><td style="font-size:15px;font-weight:900;color:#8DC63F;letter-spacing:.05em;">${tempPassword}</td></tr>
          </table>
        </div>

        <div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:8px;padding:14px;margin-bottom:20px;">
          <p style="font-size:13px;color:#92400E;margin:0;"><strong>⚠ Important:</strong> You will be asked to change this password the first time you log in. Please keep it confidential until then.</p>
        </div>

        <p style="font-size:14px;color:#333;margin-bottom:8px;">To get started:</p>
        <ol style="font-size:13px;color:#555;padding-left:20px;line-height:2;">
          <li>Go to the login page</li>
          <li>Enter your email and temporary password above</li>
          <li>Set your new permanent password</li>
          <li>Start using the system</li>
        </ol>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:11px;color:#ccc;text-align:center;margin:0;">${firmName} · Powered by MB SmartTrack</p>
      </div>
    </div>
  `;

  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ success: true, warning: 'RESEND_API_KEY not set — email not sent' });
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `${firmName} <onboarding@resend.dev>`,
      to: email,
      subject: `Your ${firmName} login details — Welcome aboard!`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }

  return res.status(200).json({ success: true, sentTo: email });
}
