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
    // Generate a temporary password
    const tempPass = 'MB@' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!';
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role || 'attorney' }
    });
    
    if (error) return res.status(400).json({ error: error.message });
    if (!data.user) return res.status(400).json({ error: 'Failed to create user' });

    await new Promise(r => setTimeout(r, 1500));
    
    await supabaseAdmin.from('profiles').upsert({
      id:        data.user.id,
      full_name: fullName,
      email:     email,
      role:      role || 'attorney',
      branch_id: branchId || null,
      firm:      'Motsoeneng Bill',
    });

    // Send password reset email so they can set their own password
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    return res.status(200).json({ 
      success: true, 
      tempPassword: tempPass,
      message: `Account created. Temporary password: ${tempPass}`
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}