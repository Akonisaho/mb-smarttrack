import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, fullName, role, branchId } = req.body;
  if (!email || !fullName || !branchId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const tempPass = 'ST@' + Math.random().toString(36).slice(2,8).toUpperCase() + '!' + new Date().getFullYear();

    // Get firm settings for email branding
    const { data: firmSettings } = await supabaseAdmin
      .from('firm_settings').select('*').limit(1).single();
    const firmName = firmSettings?.firm_name || 'SmartTrack';
    const firmEmail = firmSettings?.email || 'noreply@resend.dev';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mb-smarttrack.vercel.app';

    // Create user via Supabase Admin API
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, branch_id: branchId }
    });

    if (createErr) return res.status(400).json({ error: createErr.message });

    // Update profile
    await supabaseAdmin.from('profiles').upsert({
      id: userData.user.id,
      full_name: fullName,
      email,
      role: role || 'attorney',
      branch_id: branchId,
      firm: firmName,
      password_changed: false,
    });

    // Send welcome email via Resend
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${firmName} <onboarding@resend.dev>`,
          to: email,
          subject: `Welcome to ${firmName} — Your login details`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 16px;background:#f5f5f5;">
              <div style="background:#0A0A0A;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px;">
                <h1 style="color:#8DC63F;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.03em;">SmartTrack</h1>
                <p style="color:#666;margin:4px 0 0;font-size:12px;">${firmName}</p>
              </div>
              <div style="background:#fff;border-radius:12px;padding:32px;">
                <h2 style="color:#111;margin:0 0 8px;font-size:20px;">Welcome, ${fullName}! 👋</h2>
                <p style="color:#666;margin:0 0 24px;line-height:1.6;">You've been added to <strong>${firmName}</strong> on SmartTrack. Here are your login details:</p>
                <div style="background:#f8f8f8;border:1px solid #eee;border-radius:8px;padding:20px;margin-bottom:24px;">
                  <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:6px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:.05em;width:140px;">Login URL</td><td style="padding:6px 0;color:#111;font-size:13px;font-weight:600;"><a href="${appUrl}/login" style="color:#8DC63F;">${appUrl}/login</a></td></tr>
                    <tr><td style="padding:6px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Email</td><td style="padding:6px 0;color:#111;font-size:13px;">${email}</td></tr>
                    <tr><td style="padding:6px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Temp Password</td><td style="padding:6px 0;font-size:16px;font-weight:900;color:#8DC63F;font-family:monospace;letter-spacing:.05em;">${tempPass}</td></tr>
                    <tr><td style="padding:6px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Role</td><td style="padding:6px 0;color:#111;font-size:13px;text-transform:capitalize;">${role || 'attorney'}</td></tr>
                  </table>
                </div>
                <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:14px;margin-bottom:24px;">
                  <p style="margin:0;font-size:13px;color:#92400e;">⚠️ <strong>Important:</strong> You will be asked to set a new password when you first log in. Your temporary password will no longer work after that.</p>
                </div>
                <div style="text-align:center;">
                  <a href="${appUrl}/login" style="display:inline-block;background:#8DC63F;color:#0A0A0A;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Log In Now →</a>
                </div>
                <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
                <p style="color:#bbb;font-size:11px;text-align:center;margin:0;">${firmName} · This is an automated message · Do not reply</p>
              </div>
            </div>
          `,
        }),
      });
    }

    return res.status(200).json({ success: true, tempPassword: tempPass });
  } catch(e) {
    console.error('Invite error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
