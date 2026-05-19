import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, fullName, role, branchId } = req.body;
  if (!email || !fullName || !branchId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Step 1 — Create user with random temp password
    const tempPass = 'MB@' + Math.random().toString(36).slice(2,8).toUpperCase() + '!2026';
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role || 'attorney' }
    });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.user) return res.status(400).json({ error: 'Failed to create account' });

    // Step 2 — Save profile
    await new Promise(r => setTimeout(r, 1500));
    await supabaseAdmin.from('profiles').upsert({
      id:        data.user.id,
      full_name: fullName,
      email:     email,
      role:      role || 'attorney',
      branch_id: branchId || null,
      firm:      'Motsoeneng Bill',
    });

    // Step 3 — Generate password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    // Step 4 — Send email via Resend
    const resetLink = linkData?.properties?.action_link || 'https://mb-smarttrack.vercel.app/login';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Motsoeneng Bill <onboarding@resend.dev>',
        to: email,
        subject: 'You have been invited to MB SmartTrack',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px;">
            <div style="background: #0A0A0A; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <h1 style="color: #8DC63F; font-size: 28px; margin: 0;">MB SmartTrack</h1>
              <p style="color: #555; font-size: 12px; margin: 4px 0 0;">Motsoeneng Bill Attorneys</p>
            </div>
            <div style="background: white; border-radius: 12px; padding: 32px;">
              <h2 style="color: #0A0A0A; margin-bottom: 8px;">Welcome, ${fullName}</h2>
              <p style="color: #555; margin-bottom: 24px;">You have been invited to join MB SmartTrack — the firm's time tracking and billing system.</p>
              <p style="color: #555; margin-bottom: 24px;">Click the button below to set your password and access your account.</p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetLink}" style="background: #8DC63F; color: #0A0A0A; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Set My Password</a>
              </div>
              <p style="color: #999; font-size: 12px;">If you did not expect this invitation please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #999; font-size: 11px; text-align: center;">Motsoeneng Bill Attorneys · MB SmartTrack</p>
            </div>
          </div>
        `,
      }),
    });

    return res.status(200).json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}