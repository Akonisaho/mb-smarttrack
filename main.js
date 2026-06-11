const {
  app, Tray, Menu, nativeImage, shell,
  Notification, BrowserWindow, ipcMain, powerMonitor
} = require('electron');
const path = require('path');
const fs   = require('fs');
const { autoUpdater } = require('electron-updater');
const { startTracking, stopTracking, initTracker } = require('./tracker');
const { signIn, getSession } = require('./supabase');

// ── Single instance ───────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); }

// ── State ─────────────────────────────────────────────────────────────────────
let tray          = null;
let loginWin      = null;
let isTracking    = false;
let isPaused      = false;
let reminderTimer = null;
let crashFile     = null;
let updateReady   = false;

// ── Tray icon helpers ─────────────────────────────────────────────────────────
const ICON_COLORS = {
  active : '#8DC63F', // green  — tracking
  paused : '#F59E0B', // amber  — paused
  idle   : '#6B7280', // gray   — not started / signed out
  error  : '#DC2626', // red    — crashed / session expired
};

const ICON_TIPS = {
  active : 'SmartTrack — Tracking Active',
  paused : 'SmartTrack — Paused',
  idle   : 'SmartTrack — Not started',
  error  : 'SmartTrack — Error (right-click to sign in)',
};

function makeIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
              `<circle cx="8" cy="8" r="7" fill="${color}"/></svg>`;
  try {
    const img = nativeImage.createFromDataURL(
      'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
    );
    if (!img.isEmpty()) return img;
  } catch {}
  // Fallback to file icon
  try {
    const fb = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    if (!fb.isEmpty()) return fb.resize({ width: 16, height: 16 });
  } catch {}
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASElEQVQ4T2NkIAL8////hyMIJyoqSrIZFBtAsiFkG0K2IWQbQrYhZBtCtiFkGwIABMUAATf8QQIAAAAASUVORK5CYII='
  );
}

function setTrayState(state) {
  if (!tray) return;
  tray.setImage(makeIcon(ICON_COLORS[state] || ICON_COLORS.idle));
  tray.setToolTip(ICON_TIPS[state] || 'SmartTrack');
}

// ── Crash recovery ────────────────────────────────────────────────────────────
const CRASH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RESTARTS    = 3;

function initCrashFile(userDataPath) {
  try { fs.mkdirSync(userDataPath, { recursive: true }); } catch {}
  crashFile = path.join(userDataPath, 'crash-state.json');
}

function readCrashState() {
  try { return JSON.parse(fs.readFileSync(crashFile, 'utf8')); }
  catch { return { timestamps: [] }; }
}

function writeCrashState(state) {
  try { fs.writeFileSync(crashFile, JSON.stringify(state), 'utf8'); } catch {}
}

function setupCrashHandler() {
  process.on('uncaughtException', (err) => {
    console.error('[Crash]', err?.message || err);
    try { stopTracking(); } catch {}

    const now   = Date.now();
    const state = readCrashState();
    // Keep only crash timestamps within the 5-minute window
    state.timestamps = (state.timestamps || []).filter(t => now - t < CRASH_WINDOW_MS);
    state.timestamps.push(now);
    writeCrashState(state);

    if (state.timestamps.length < MAX_RESTARTS) {
      // Still under the limit — relaunch
      console.log(`[Crash] Restarting (attempt ${state.timestamps.length} of ${MAX_RESTARTS})...`);
      app.relaunch();
      app.exit(1);
    } else {
      // 3 crashes in 5 minutes — give up, reset counter, notify user
      writeCrashState({ timestamps: [] });
      notify(
        'SmartTrack — Agent Failed',
        `The agent crashed ${MAX_RESTARTS} times and could not recover. ` +
        `Time is NOT being tracked. Please restart SmartTrack manually.`
      );
      setTrayState('error');
      buildTrayMenu();
    }
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────
function notify(title, body) {
  if (!Notification.isSupported()) return;
  try { new Notification({ title, body }).show(); } catch {}
}

// ── Session expired callback ──────────────────────────────────────────────────
// Called by tracker.js when Supabase returns no session during a sync
function onSessionExpired() {
  if (!isTracking) return; // already handled
  console.warn('[Auth] Session expired — stopping tracking and prompting sign in.');
  isTracking = false;
  isPaused   = false;
  setTrayState('error');
  buildTrayMenu();
  notify(
    'SmartTrack — Sign In Required',
    'Your session has expired. Time tracking has stopped. Please sign in again.'
  );
  createLoginWindow();
}

// ── Auto-start ────────────────────────────────────────────────────────────────
function setAutoStart(enable) {
  app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath });
}

// ── Tray menu ─────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  const statusLabel = !isTracking
    ? 'Not started'
    : isPaused ? 'Paused' : 'Tracking Active';

  const menu = Menu.buildFromTemplate([
    { label: 'MB SmartTrack', enabled: false },
    { label: `Status: ${statusLabel}`, enabled: false },
    { type: 'separator' },
    {
      label   : isPaused ? '▶ Resume Tracking' : '⏸ Pause Tracking',
      enabled : isTracking,
      click   : () => {
        if (isPaused) {
          startTracking();
          isPaused = false;
          setTrayState('active');
          buildTrayMenu();
          notify('SmartTrack', 'Tracking resumed.');
        } else {
          stopTracking();
          isPaused = true;
          setTrayState('paused');
          buildTrayMenu();
          notify('SmartTrack', 'Tracking paused. Right-click to resume.');
        }
      }
    },
    { type: 'separator' },
    {
      label : '📊 Open Dashboard',
      click : () => shell.openExternal('https://mb-smarttrack.vercel.app')
    },
    { type: 'separator' },
    {
      label   : 'Auto-start on login',
      type    : 'checkbox',
      checked : app.getLoginItemSettings().openAtLogin,
      click   : item => setAutoStart(item.checked)
    },
    { type: 'separator' },
    ...(updateReady ? [{
      label : '🔄 Restart to Update',
      click : () => { autoUpdater.quitAndInstall(); }
    }] : [{
      label   : 'Check for Updates',
      click   : () => { autoUpdater.checkForUpdates().catch(() => {}); }
    }]),
    { type: 'separator' },
    {
      label : 'Quit SmartTrack',
      click : () => { stopTracking(); clearInterval(reminderTimer); app.quit(); }
    }
  ]);

  if (tray) tray.setContextMenu(menu);
}

function buildTray() {
  if (!tray) {
    tray = new Tray(makeIcon(ICON_COLORS.idle));
    tray.setToolTip('SmartTrack — Not started');
  }
  buildTrayMenu();
}

// ── Reminder scheduler ────────────────────────────────────────────────────────
function startReminderScheduler() {
  reminderTimer = setInterval(() => {
    const now  = new Date();
    const hour = now.getHours();
    const min  = now.getMinutes();
    if ((!isTracking || isPaused) && hour >= 8 && hour < 18 && (min === 0 || min === 30)) {
      notify(
        'SmartTrack — Tracking not active',
        `It is ${now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}. ` +
        `Right-click the tray icon to resume.`
      );
    }
  }, 60 * 1000);
}

// ── Begin tracking ────────────────────────────────────────────────────────────
function beginTracking() {
  startTracking();
  isTracking = true;
  isPaused   = false;
  setTrayState('active');
  buildTrayMenu();
  startReminderScheduler();
  setAutoStart(true);
  notify('SmartTrack', 'Tracking started. Billable time is being recorded.');
}

// ── Login window ──────────────────────────────────────────────────────────────
function createLoginWindow() {
  if (loginWin) { loginWin.focus(); return; }
  loginWin = new BrowserWindow({
    width: 420, height: 500,
    resizable: false,
    title: 'MB SmartTrack — Sign In',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  const logoPath = path.join(__dirname, 'icon.png');
  let logoSrc = '';
  try {
    const logoB64 = fs.readFileSync(logoPath).toString('base64');
    logoSrc = `data:image/png;base64,${logoB64}`;
  } catch (_) { /* use text fallback */ }

  const html = `<!DOCTYPE html><html><head>
  <meta charset="utf-8"><title>MB SmartTrack</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A0A0A;font-family:'Segoe UI',sans-serif;color:#F0F0F0;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .box{background:#111;border:1px solid #1A1A1A;border-radius:12px;padding:32px;
         width:100%;max-width:360px}
    .brand{text-align:center;margin-bottom:4px}
    .brand-row{display:flex;align-items:center;justify-content:center;gap:2px}
    .brand-logo{height:44px;width:auto;object-fit:contain;mix-blend-mode:screen}
    .brand-text{font-size:26px;font-weight:900;letter-spacing:-0.04em}
    .brand-text .smart{color:#F0F0F0}.brand-text .track{color:#8DC63F}
    .firm{text-align:center;font-size:11px;color:#444;text-transform:uppercase;
          letter-spacing:.1em;margin-bottom:4px}
    .tagline{text-align:center;font-size:10px;color:#222;margin-bottom:28px}
    label{display:block;font-size:10px;color:#555;text-transform:uppercase;
          letter-spacing:.07em;margin-bottom:4px}
    input{background:#1A1A1A;border:1px solid #252525;color:#F0F0F0;padding:10px 14px;
          border-radius:7px;font-size:13px;width:100%;margin-bottom:14px;
          outline:none;font-family:inherit}
    input:focus{border-color:rgba(141,198,63,0.5)}
    button{background:#8DC63F;border:none;color:#0A0A0A;padding:12px;
           border-radius:7px;font-size:13px;font-weight:700;width:100%;
           cursor:pointer;font-family:inherit;margin-top:2px}
    button:disabled{opacity:0.6;cursor:default}
    .err{background:rgba(220,80,80,0.08);border:1px solid rgba(220,80,80,0.3);
         border-radius:6px;padding:10px 12px;font-size:12px;color:#E05252;
         margin-bottom:12px;display:none}
    .note{text-align:center;font-size:10px;color:#333;margin-top:16px;line-height:1.6}
  </style></head><body>
  <div class="box">
    <div class="brand">
      <div class="brand-row">
        ${logoSrc ? `<img class="brand-logo" src="${logoSrc}" onerror="this.style.display='none'"/>` : ''}
        <div class="brand-text"><span class="smart">Smart</span><span class="track">Track</span></div>
      </div>
    </div>
    <div class="firm">Motsoeneng Bill Attorneys</div>
    <div class="tagline">The Quality of Now</div>
    <div class="err" id="err"></div>
    <label>Email address</label>
    <input type="email" id="email" placeholder="your@email.com" autofocus/>
    <label>Password</label>
    <input type="password" id="pass" placeholder="Your password"/>
    <button id="btn" onclick="doLogin()">Sign In &amp; Start Tracking</button>
    <div class="note">
      After signing in, this window closes automatically.<br>
      Tracking runs silently in the system tray.
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    function doLogin() {
      const email = document.getElementById('email').value.trim();
      const pass  = document.getElementById('pass').value;
      const err   = document.getElementById('err');
      const btn   = document.getElementById('btn');
      if (!email || !pass) {
        err.textContent = 'Please enter your email and password.';
        err.style.display = 'block';
        return;
      }
      btn.textContent = 'Signing in...';
      btn.disabled = true;
      err.style.display = 'none';
      ipcRenderer.send('login-attempt', { email, pass });
    }
    document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    ipcRenderer.on('login-error', (e, msg) => {
      const err = document.getElementById('err');
      err.textContent = msg;
      err.style.display = 'block';
      document.getElementById('btn').textContent = 'Sign In & Start Tracking';
      document.getElementById('btn').disabled = false;
    });
  </script></body></html>`;

  loginWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  loginWin.setMenu(null);
  loginWin.on('closed', () => { loginWin = null; });
}

ipcMain.on('login-attempt', async (event, { email, pass }) => {
  const { data, error } = await signIn(email, pass);
  if (error || !data.session) {
    event.reply('login-error', error?.message || 'Sign in failed. Check your credentials.');
    return;
  }
  if (loginWin) { loginWin.close(); loginWin = null; }
  beginTracking();
});

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  initCrashFile(userDataPath);
  initTracker(userDataPath, onSessionExpired);
  setupCrashHandler();

  buildTray();

  // ── Auto-update ───────────────────────────────────────────────────────────
  autoUpdater.autoDownload        = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    notify('SmartTrack — Update Available', 'A new version is downloading in the background.');
  });

  autoUpdater.on('update-downloaded', () => {
    updateReady = true;
    buildTrayMenu();
    notify('SmartTrack — Update Ready', 'Restart SmartTrack to apply the latest update.');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Update]', err?.message || err);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Update] Check failed:', err?.message || err);
  });

  // ── Power monitor (sleep / wake) — must be inside whenReady ────────────────
  powerMonitor.on('suspend', () => {
    if (isTracking && !isPaused) {
      stopTracking();
      console.log('[Power] Machine sleeping — tracking paused.');
    }
  });

  powerMonitor.on('resume', async () => {
    console.log('[Power] Machine woke — checking session...');
    if (!isTracking || isPaused) return;
    stopTracking();
    // Wait for network to stabilise after wake
    await new Promise(r => setTimeout(r, 3000));
    const session = await getSession().catch(() => null);
    if (!session) {
      onSessionExpired();
      return;
    }
    startTracking();
    setTrayState('active');
    notify('SmartTrack', 'Tracking resumed after sleep.');
  });

  // ── Initial auth check ──────────────────────────────────────────────────────
  try {
    const session = await getSession();
    if (session) {
      beginTracking();
    } else {
      setTrayState('idle');
      createLoginWindow();
    }
  } catch (e) {
    console.error('[Startup]', e.message);
    setTrayState('error');
    createLoginWindow();
  }
});

// ── Keep alive in tray ────────────────────────────────────────────────────────
app.on('window-all-closed', e => e.preventDefault());
app.on('before-quit', () => { stopTracking(); clearInterval(reminderTimer); });
