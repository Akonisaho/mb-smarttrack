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
    const tempPass = 'MB@' + Math.random().toString(36).slice(2,8).toUpperCase() + '!2026';

    // Use signUp via anon key — works on free plan
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password: tempPass,
      options: {
        data: { full_name: fullName, role: role || 'attorney' }
      }
    });

    console.log('SignUp result:', JSON.stringify({ 
      userId: data?.user?.id, 
      error: error?.message 
    }));

    if (error) return res.status(400).json({ error: error.message });
    if (!data?.user) return res.status(400).json({ error: 'No user returned' });

    await new Promise(r => setTimeout(r, 2000));

    await supabaseAdmin.from('profiles').upsert({
      id:        data.user.id,
      full_name: fullName,
      email:     email,
      role:      role || 'attorney',
      branch_id: branchId || null,
      firm:      'Motsoeneng Bill',
    });

    // Send email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Motsoeneng Bill <onboarding@resend.dev>',
        to: email,
        subject: 'Welcome to MB SmartTrack',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;background:#f9f9f9;">
            <div style="background:#0A0A0A;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <h1 style="color:#8DC63F;margin:0;font-size:24px;">MB SmartTrack</h1>
              <p style="color:#555;margin:4px 0 0;font-size:12px;">Motsoeneng Bill Attorneys</p>
            </div>
            <div style="background:white;border-radius:12px;padding:32px;">
              <h2 style="color:#111;margin-bottom:16px;">Welcome, ${fullName}!</h2>
              <p style="color:#555;margin-bottom:24px;">You have been added to MB SmartTrack — the firm's time tracking and billing system.</p>
              <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:24px;">
                <p style="margin:0;color:#333;"><strong>Website:</strong> mb-smarttrack.vercel.app</p>
                <p style="margin:8px 0 0;color:#333;"><strong>Email:</strong> ${email}</p>
                <p style="margin:8px 0 0;color:#333;"><strong>Temporary password:</strong> <strong style="color:#8DC63F;">${tempPass}</strong></p>
              </div>
              <p style="color:#555;margin-bottom:24px;">Please log in and change your password after your first login.</p>
              <div style="text-align:center;">
                <a href="https://mb-smarttrack.vercel.app/login" style="background:#8DC63F;color:#0A0A0A;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Log In Now</a>
              </div>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
              <p style="color:#999;font-size:11px;text-align:center;">Motsoeneng Bill Attorneys · Confidential</p>
            </div>
          </div>
        `,
      }),
    });

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
}