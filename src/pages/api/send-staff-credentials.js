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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mb-smarttrack.vercel.app';
  const isAttorney = role === 'attorney' || role === 'branch_manager' || role === 'manager';

  const electronSection = isAttorney ? `
        <div style="background:#0D1A00;border:1px solid #3a5c00;border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="font-size:13px;font-weight:700;color:#8DC63F;margin:0 0 6px;">📥 Install the Time Tracking Agent</p>
          <p style="font-size:13px;color:#aaa;margin:0 0 14px;line-height:1.6;">As an attorney, you need the SmartTrack desktop agent installed on your Windows PC. It runs silently in the background and automatically tracks your billable time.</p>
          <ol style="font-size:13px;color:#aaa;padding-left:20px;line-height:2;margin:0 0 14px;">
            <li>Click the button below to download the installer</li>
            <li>Double-click the downloaded file to install</li>
            <li>Sign in with your email and password above</li>
            <li>The green icon will appear in your taskbar — you're live</li>
          </ol>
          <div style="text-align:center;">
            <a href="${appUrl}/downloads/MB SmartTrack Setup 1.0.0.exe" style="display:inline-block;background:#8DC63F;color:#0A0A0A;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">⬇ Download SmartTrack Agent (.exe)</a>
          </div>
        </div>` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f0f0f0;">

      <!-- Header -->
      <div style="background:#0A0A0A;border-radius:12px;padding:28px;text-align:center;margin-bottom:16px;">
        <img src="${appUrl}/logo.png" alt="MB" style="width:52px;height:52px;object-fit:contain;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;" />
        <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em;">
          <span style="color:#F0F0F0;">MB </span><span style="color:#F0F0F0;">Smart</span><span style="color:#8DC63F;">Track</span>
        </div>
        <p style="color:#555;margin:4px 0 0;font-size:12px;">${firmName}</p>
      </div>

      <!-- Body -->
      <div style="background:#fff;border-radius:12px;padding:32px;">
        <h3 style="margin:0 0 6px;color:#111;font-size:20px;">Welcome, ${fullName}!</h3>
        <p style="font-size:14px;color:#666;margin:0 0 24px;line-height:1.6;">Your account has been created on the <strong>${firmName}</strong> practice management system. Everything you need to get started is below.</p>

        <!-- Credentials -->
        <div style="background:#f8f8f8;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;font-weight:600;">Your Login Details</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="font-size:12px;color:#999;padding:5px 0;width:130px;">Role</td><td style="font-size:13px;font-weight:600;color:#111;">${roleLabels[role]||role}</td></tr>
            <tr><td style="font-size:12px;color:#999;padding:5px 0;">Branch</td><td style="font-size:13px;color:#111;">${branchName||'—'}</td></tr>
            <tr><td style="font-size:12px;color:#999;padding:5px 0;">Email</td><td style="font-size:13px;font-weight:600;color:#111;">${email}</td></tr>
            <tr><td style="font-size:12px;color:#999;padding:5px 0;">Temp Password</td><td style="font-size:17px;font-weight:900;color:#8DC63F;font-family:monospace;letter-spacing:.06em;">${tempPassword}</td></tr>
          </table>
        </div>

        <!-- Warning -->
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:20px;">
          <p style="font-size:13px;color:#92400e;margin:0;"><strong>⚠ Important:</strong> You will be asked to set a new password on your first login. Your temporary password will not work after that.</p>
        </div>

        <!-- Electron section for attorneys only -->
        ${electronSection}

        <!-- Login button -->
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${appUrl}/login" style="display:inline-block;background:#0A0A0A;color:#8DC63F;border:2px solid #8DC63F;padding:13px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Log In to SmartTrack →</a>
        </div>

        <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0;">
        <p style="font-size:11px;color:#ccc;text-align:center;margin:0;">${firmName} · MB SmartTrack · This is an automated message</p>
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
