const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const SUPABASE_URL  = 'https://zpqdhodxyrkfcgameekn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcWRob2R4eXJrZmNnYW1lZWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzU3MTcsImV4cCI6MjA5MzU1MTcxN30.sjYPAoi0Xc5tzRtjaFw-2odNAno4axh8R4TTOAAtY40';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// Calculate billing units — 1 unit per 6 minutes, ceiling, minimum 1
function calcUnits(seconds) {
  return Math.max(1, Math.ceil(Number(seconds) / 360));
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function sendActivities(activities, userId) {
  if (!activities || activities.length === 0) return;

  const rows = activities.map(a => {
    const durSec = Number(a.duration_seconds || a.duration || 0);
    const cls    = a.classification || 'work';
    // Calculate billing units correctly here
    const units  = cls === 'billable' ? calcUnits(durSec) : 0;
    const date   = new Date(Number(a.startTime || a.start_time || Date.now()))
                     .toLocaleDateString('en-CA');

    return {
      user_id:          userId,
      agent_id:         a.agent_id || 'electron-agent',
      app_name:         a.appName         || a.app_name         || 'Unknown',
      app_display_name: a.appDisplayName  || a.app_display_name || 'Unknown',
      window_title:     a.windowTitle     || a.window_title     || '',
      start_time:       Number(a.startTime || a.start_time || Date.now()),
      end_time:         Number(a.endTime   || a.end_time   || Date.now()),
      duration_seconds: durSec,
      classification:   cls,
      billing_units:    units,   // ← correctly calculated
      is_billable:      cls === 'billable',
      matter:           a.matter || '',
      date:             date,
    };
  });

  const { error } = await supabase
    .from('activities')
    .upsert(rows, {
      onConflict: 'user_id,agent_id,start_time',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('[Supabase] send error:', error.message);
    return false; // signal to tracker to keep the buffer
  }
  console.log(`[Supabase] synced ${rows.length} activities`);
  return true;
}

module.exports = { supabase, signIn, getSession, sendActivities };
