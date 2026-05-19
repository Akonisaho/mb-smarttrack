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
    
    // Use admin API with explicit options
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role || 'attorney' }
    });

    console.log('Create user response:', JSON.stringify({ 
      userId: data?.user?.id, 
      error: error?.message,
      errorCode: error?.code 
    }));

    if (error) return res.status(400).json({ error: error.message });

    await new Promise(r => setTimeout(r, 1500));
    
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
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#8DC63F;">Welcome to MB SmartTrack</h2>
            <p>Hi ${fullName},</p>
            <p>You have been added to MB SmartTrack by Motsoeneng Bill Attorneys.</p>
            <p><strong>Login details:</strong></p>
            <ul>
              <li>Website: <a href="https://mb-smarttrack.vercel.app">mb-smarttrack.vercel.app</a></li>
              <li>Email: ${email}</li>
              <li>Temporary password: <strong>${tempPass}</strong></li>
            </ul>
            <p>Please log in and change your password immediately.</p>
            <a href="https://mb-smarttrack.vercel.app/login" style="background:#8DC63F;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Log In Now</a>
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