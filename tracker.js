const { sendActivities, getSession } = require('./supabase');
const fs   = require('fs');
const path = require('path');

const POLL_INTERVAL = 3000;   // check active window every 3 s
const SEND_INTERVAL = 30000;  // flush to Supabase every 30 s

let pollTimer      = null;
let sendTimer      = null;
let currentSession = null;
let finalizedSessions = [];

// Set by initTracker()
let bufferFile          = null;
let onSessionExpiredCb  = null;
let sessionExpiredFired = false;

// ── Init ──────────────────────────────────────────────────────────────────────
function initTracker(userDataPath, sessionExpiredCallback) {
  bufferFile         = path.join(userDataPath, 'session-buffer.json');
  onSessionExpiredCb = sessionExpiredCallback;
  loadBuffer();
}

// ── Local session buffer ──────────────────────────────────────────────────────
// Persists finalized sessions to disk so a crash between sync intervals
// doesn't lose captured data. Cleared after a successful Supabase sync.

function loadBuffer() {
  if (!bufferFile) return;
  try {
    const raw = fs.readFileSync(bufferFile, 'utf8');
    const saved = JSON.parse(raw);
    if (Array.isArray(saved) && saved.length > 0) {
      finalizedSessions = [...saved, ...finalizedSessions];
      console.log(`[Buffer] Recovered ${saved.length} unsent session(s) from disk.`);
    }
  } catch {
    // File doesn't exist yet — fine
  }
}

function saveBuffer() {
  if (!bufferFile) return;
  try {
    fs.writeFileSync(bufferFile, JSON.stringify(finalizedSessions), 'utf8');
  } catch (e) {
    console.warn('[Buffer] Could not write buffer:', e.message);
  }
}

function clearBuffer() {
  if (!bufferFile) return;
  try { fs.writeFileSync(bufferFile, '[]', 'utf8'); } catch {}
}

// ── Classification ────────────────────────────────────────────────────────────
const LEGAL_KW = [
  'review','draft','drafting','research','researching','meeting',
  'hearing','compliance','contract','invoice','case','client','court',
  'matter','agreement','deed','affidavit','pleading','brief','motion',
  'settlement','litigation','plaintiff','defendant','tribunal',
  'arbitration','regulatory','deposition','subpoena','summons',
  'judgement','judgment','ruling','claim','dispute','prosecution',
  'defence','defense','appeal','statute','regulation','docket',
  'registrar','interdict','eviction','sequestration','liquidation',
  'counsel','attorney','advocate','barrister','solicitor','notary',
  'beneficiary','fiduciary','sheriff','bailiff','retainer',
  'memorandum','mandate','annexure','exhibit','opinion',
  'discovery','due diligence','consultation','precedent','pleadings',
  'conveyancing','title deed','bond','mortgage','lease','trust',
  'estate','probate','testament','merger','acquisition','insolvency',
  'billing','vat','sars','penalty','audit','assessment',
  'legal','law','file','matter'
];
const BROWSERS  = ['chrome','msedge','edge','firefox','opera','brave'];
const NON_BILL  = ['youtube','netflix','spotify','twitter','facebook','instagram','tiktok','reddit','steam','solitaire','vlc'];
const WORK_APPS = ['winword','excel','outlook','teams','powerpnt','acrobat','notepad','onenote','code','explorer'];

function classify(appName, title) {
  const a = (appName || '').toLowerCase();
  const t = (title   || '').toLowerCase();
  for (const nb of NON_BILL) if (a.includes(nb) || t.includes(nb)) return 'non-billable';
  const isBrowser = BROWSERS.some(b => a.includes(b));
  const hasLegal  = LEGAL_KW.some(k => t.includes(k));
  if (isBrowser)  return hasLegal ? 'work' : 'non-billable';
  if (hasLegal)   return 'billable';
  if (WORK_APPS.some(w => a.includes(w))) return 'work';
  return 'non-billable';
}

function displayName(appName) {
  const n = (appName || '').toLowerCase();
  if (n.includes('winword'))              return 'Microsoft Word';
  if (n.includes('outlook'))             return 'Microsoft Outlook';
  if (n.includes('excel'))               return 'Microsoft Excel';
  if (n.includes('powerpnt'))            return 'PowerPoint';
  if (n.includes('teams'))               return 'Microsoft Teams';
  if (n.includes('chrome'))              return 'Google Chrome';
  if (n.includes('msedge') || n.includes('edge')) return 'Microsoft Edge';
  if (n.includes('acrobat'))             return 'Adobe Acrobat';
  if (n.includes('code'))                return 'VS Code';
  if (n.includes('explorer'))            return 'File Explorer';
  if (n.includes('notepad'))             return 'Notepad';
  return appName || 'Unknown';
}

function normalizeTitle(title) {
  return (title || '')
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\s*-\s*Microsoft\s+\w+/gi, '')
    .replace(/\s*-\s*Google Chrome/gi, '')
    .replace(/\s*\[Read-Only\]/gi, '')
    .replace(/\s*\(AutoRecovered\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .substring(0, 120);
}

function isSameWindow(session, appName, title) {
  if (!session) return false;
  return session.appName === appName && session.normalizedTitle === normalizeTitle(title);
}

// ── Active window polling ─────────────────────────────────────────────────────
async function getActiveWindow() {
  try {
    const { default: activeWin } = await import('active-win');
    return await activeWin();
  } catch {
    return null;
  }
}

async function pollActiveWindow() {
  try {
    const win = await getActiveWindow();
    if (!win) return;
    const appName = win.owner?.name || win.owner?.bundleId || 'Unknown';
    const title   = win.title || '';
    const now     = Date.now();

    if (isSameWindow(currentSession, appName, title)) {
      currentSession.durationMs = now - currentSession.startTime;
      return;
    }

    // Window changed — finalize the previous session
    if (currentSession) {
      const durSec = Math.round((now - currentSession.startTime) / 1000);
      if (durSec >= 10) {
        finalizedSessions.push({
          appName         : currentSession.appName,
          appDisplayName  : currentSession.appDisplayName,
          windowTitle     : currentSession.title,
          startTime       : currentSession.startTime,
          endTime         : now,
          duration_seconds: durSec,
          classification  : currentSession.classification,
        });
        saveBuffer(); // persist immediately — survives a crash
      }
    }

    currentSession = {
      appName,
      appDisplayName : displayName(appName),
      title,
      normalizedTitle: normalizeTitle(title),
      startTime      : now,
      durationMs     : 0,
      classification : classify(appName, title),
    };
  } catch (err) {
    console.error('[Poll]', err.message);
  }
}

// ── Supabase sync ─────────────────────────────────────────────────────────────
async function sendToBackend() {
  const now     = Date.now();
  const session = await getSession().catch(() => null);

  if (!session) {
    console.warn('[Sync] No session — skipping sync.');
    // Only fire the callback once per tracking session to avoid spam
    if (!sessionExpiredFired && onSessionExpiredCb) {
      sessionExpiredFired = true;
      setTimeout(onSessionExpiredCb, 0); // defer so we don't re-enter timers
    }
    return;
  }

  // Session is valid — reset the expired flag
  sessionExpiredFired = false;

  const userId  = session.user.id;
  const payload = [...finalizedSessions];

  // Include the in-progress session as a snapshot
  if (currentSession) {
    const durSec = Math.round((now - currentSession.startTime) / 1000);
    if (durSec >= 10) {
      payload.push({
        appName         : currentSession.appName,
        appDisplayName  : currentSession.appDisplayName,
        windowTitle     : currentSession.title,
        startTime       : currentSession.startTime,
        endTime         : now,
        duration_seconds: durSec,
        classification  : currentSession.classification,
        agent_id        : 'electron-agent',
      });
    }
  }

  if (payload.length === 0) return;

  const ok = await sendActivities(payload, userId);
  if (ok !== false) {
    finalizedSessions = [];
    clearBuffer(); // data is safely in Supabase — clear the local backup
  }
  // If sendActivities failed (returns false), leave sessions in finalizedSessions
  // and the buffer file so they retry on the next interval
}

// ── Start / Stop ──────────────────────────────────────────────────────────────
function startTracking() {
  if (pollTimer) return; // already running
  sessionExpiredFired = false;
  console.log('[Tracker] Started.');

  pollTimer = setInterval(async () => {
    try {
      await Promise.race([
        pollActiveWindow(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
    } catch (e) {
      console.warn('[Poll] Timeout:', e.message);
    }
  }, POLL_INTERVAL);

  sendTimer = setInterval(sendToBackend, SEND_INTERVAL);
  setTimeout(sendToBackend, 10000); // first sync after 10 s
}

function stopTracking() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  clearInterval(sendTimer);
  pollTimer = null;
  sendTimer = null;

  // Finalize the current session before stopping
  if (currentSession) {
    const durSec = Math.round((Date.now() - currentSession.startTime) / 1000);
    if (durSec >= 10) {
      finalizedSessions.push({
        appName         : currentSession.appName,
        appDisplayName  : currentSession.appDisplayName,
        windowTitle     : currentSession.title,
        startTime       : currentSession.startTime,
        endTime         : Date.now(),
        duration_seconds: durSec,
        classification  : currentSession.classification,
      });
      saveBuffer();
    }
    currentSession = null;
  }

  sendToBackend();
  console.log('[Tracker] Stopped.');
}

module.exports = { startTracking, stopTracking, initTracker };
