import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://zpqdhodxyrkfcgameekn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcWRob2R4eXJrZmNnYW1lZWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzU3MTcsImV4cCI6MjA5MzU1MTcxN30.sjYPAoi0Xc5tzRtjaFw-2odNAno4axh8R4TTOAAtY40';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ─────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUp(email, password, fullName, role = 'attorney') {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, role } }
  });
  return { data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

// ── Activities ───────────────────────────────────────────────────────
export async function fetchActivities({ date, limit = 500, userId } = {}) {
  let q = supabase.from('activities').select('*').neq('agent_id', 'demo');
  if (userId)  q = q.eq('user_id', userId);
  if (date)    q = q.eq('date', date);
  q = q.order('start_time', { ascending: false }).limit(limit);
  const { data, error } = await q;
  return { activities: data || [], error };
}

export async function fetchAllActivities({ userId } = {}) {
  let q = supabase.from('activities').select('*').neq('agent_id', 'demo');
  if (userId) q = q.eq('user_id', userId);
  q = q.order('start_time', { ascending: false }).limit(2000);
  const { data, error } = await q;
  return { activities: data || [], error };
}

export async function upsertActivity(activity, userId) {
  const { data, error } = await supabase.from('activities').upsert({
    ...activity,
    user_id: userId,
  }, { onConflict: 'user_id,agent_id,start_time', ignoreDuplicates: false });
  return { data, error };
}

export async function patchActivity(id, updates) {
  const { error } = await supabase.from('activities').update(updates).eq('id', id);
  return { error };
}

export async function patchActivityMatter(id, matter) {
  const { error } = await supabase.from('activities').update({ matter }).eq('id', id);
  return { error };
}

// ── Matters ──────────────────────────────────────────────────────────
export async function fetchMatters(userId) {
  let q = supabase.from('matters').select('*');
  if (userId) q = q.eq('user_id', userId);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  return { matters: data || [], error };
}

export async function createMatter({ id, name, client, description, userId }) {
  // Check duplicate
  const { data: existing } = await supabase.from('matters').select('id').eq('id', id).single();
  if (existing) return { error: { message: `Matter ID "${id}" already exists.` } };
  const { data, error } = await supabase.from('matters').insert({
    id: id.toUpperCase(), name, client, description: description || '', user_id: userId
  }).select().single();
  return { data, error };
}

export async function deleteMatter(id) {
  const { error } = await supabase.from('matters').delete().eq('id', id);
  // Unlink activities
  await supabase.from('activities').update({ matter: '' }).eq('matter', id);
  return { error };
}

// ── Invoices ─────────────────────────────────────────────────────────
export async function fetchInvoices(userId) {
  let q = supabase.from('invoices').select('*');
  if (userId) q = q.eq('user_id', userId);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  return { invoices: data || [], error };
}

export async function saveInvoice(invoice, userId) {
  const count = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const num   = (count.count || 0) + 1;
  const id    = `MB-${String(num).padStart(4,'0')}-${new Date().getFullYear()}`;
  const { data, error } = await supabase.from('invoices').insert({
    ...invoice, id, user_id: userId
  }).select().single();
  return { data, error, id };
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  return { error };
}

// ── History ──────────────────────────────────────────────────────────
export async function fetchHistory(year, userId) {
  let q = supabase.from('activities')
    .select('date, duration_seconds, is_billable, billing_units')
    .neq('agent_id', 'demo');
  if (userId) q = q.eq('user_id', userId);
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;
  q = q.gte('date', startDate).lte('date', endDate);
  const { data, error } = await q;
  if (error) return { months: [], error };
  // Group by month client-side
  const months = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2,'0')}`;
    months[key] = { month: key, sessions: 0, total_seconds: 0, billable_seconds: 0, billable_units: 0 };
  }
  (data || []).forEach(a => {
    const key = a.date.substring(0, 7);
    if (!months[key]) return;
    months[key].sessions++;
    months[key].total_seconds    += a.duration_seconds || 0;
    months[key].billable_seconds += a.is_billable ? (a.duration_seconds || 0) : 0;
    months[key].billable_units   += a.is_billable ? (a.billing_units || 0) : 0;
  });
  return { months: Object.values(months), error: null };
}

export async function fetchMonthActivities(month, userId) {
  let q = supabase.from('activities').select('*').neq('agent_id', 'demo');
  if (userId) q = q.eq('user_id', userId);
  q = q.gte('date', `${month}-01`).lte('date', `${month}-31`).order('start_time', { ascending: true });
  const { data, error } = await q;
  return { activities: data || [], error };
}

// ── Manager ──────────────────────────────────────────────────────────
export async function fetchManagerSummary(date) {
  const { data, error } = await supabase
    .from('manager_summary')
    .select('*')
    .eq('date', date || new Date().toISOString().split('T')[0]);
  return { summary: data || [], error };
}

export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'attorney')
    .order('full_name');
  return { profiles: data || [], error };
}

// ── Search ───────────────────────────────────────────────────────────
export async function searchAll(query, userId) {
  const term = `%${query}%`;
  const [actsRes, mattersRes, invoicesRes] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', userId)
      .or(`window_title.ilike.${term},app_display_name.ilike.${term},matter.ilike.${term}`)
      .order('start_time', { ascending: false }).limit(40),
    supabase.from('matters').select('*').eq('user_id', userId)
      .or(`name.ilike.${term},client.ilike.${term},id.ilike.${term}`)
      .order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('user_id', userId)
      .or(`client.ilike.${term},matter_name.ilike.${term},id.ilike.${term}`)
      .order('created_at', { ascending: false }).limit(20),
  ]);

  if(actsRes.error)    console.error('search acts error:', actsRes.error.message);
  if(mattersRes.error) console.error('search matters error:', mattersRes.error.message);
  if(invoicesRes.error)console.error('search invoices error:', invoicesRes.error.message);

  return {
    activities: actsRes.data    || [],
    matters:    mattersRes.data || [],
    invoices:   invoicesRes.data|| [],
  };
}
