// Dinghy main process (spec 09). Plain CommonJS, no build step.
// Responsibilities: BrowserWindow shell, menu, config.yml file I/O, ffmpeg frame grab.
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const { Discovery, Cam } = require('onvif');

let win = null;
let configPath = null;            // remembered across Open/Save within a session
const pendingGrabs = new Set();   // ffmpeg children, killed on window close

// Remove user:pass@ credentials from any string before it reaches logs or the UI.
function sanitize(text, url) {
  let out = String(text || '');
  const m = /^[a-z]+:\/\/([^@/]+)@/i.exec(url || '');
  if (m) out = out.split(m[1]).join('***');
  return out.replace(/\/\/[^@/\s]+@/g, '//***@');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1680,
    height: 980,
    icon: path.join(__dirname, '..', 'dinghy.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, '..', 'dinghy.html'));
  win.on('closed', () => {
    for (const child of pendingGrabs) child.kill('SIGKILL');
    pendingGrabs.clear();
    win = null;
  });
}

function sendMenu(action) {
  if (win) win.webContents.send('menu', action);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Config…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open-config') },
        { label: 'Save Config', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save-config') },
        { label: 'Save Config As…', accelerator: 'Shift+CmdOrCtrl+S', click: () => sendMenu('save-config-as') },
        { type: 'separator' },
        { label: 'Export YAML…', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('export-yaml') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },   // standard roles so copy/paste (incl. image paste) work
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC: config file I/O ----
ipcMain.handle('config:open', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Frigate Config',
    filters: [{ name: 'YAML', extensions: ['yml', 'yaml'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  const file = result.filePaths[0];
  try {
    const content = await fs.readFile(file, 'utf8');
    configPath = file;
    return { path: file, content };
  } catch (e) {
    return { error: `Could not read ${path.basename(file)}: ${e.code || e.message}` };
  }
});

ipcMain.handle('config:save', async (_e, content, opts) => {
  let target = configPath;
  if (opts.as || !target) {
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Frigate Config',
      defaultPath: configPath || 'config.yml',
      filters: [{ name: 'YAML', extensions: ['yml', 'yaml'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    target = result.filePath;
  }
  try {
    await fs.writeFile(target, content, 'utf8');
    configPath = target;
    return { path: target };
  } catch (e) {
    return { error: `Could not write ${path.basename(target)}: ${e.code || e.message}` };
  }
});

// ---- IPC: single-frame RTSP grab via system ffmpeg ----
ipcMain.handle('frame:grab', (_e, url) => new Promise(resolve => {
  if (typeof url !== 'string' || !/^rtsps?:\/\//i.test(url)) {
    resolve({ error: 'Camera input is not an RTSP URL.' });
    return;
  }
  // URL passed as argv — never shell-interpolated.
  const args = ['-rtsp_transport', 'tcp', '-i', url, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'];
  const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  pendingGrabs.add(ff);
  const chunks = [];
  const errs = [];
  const timer = setTimeout(() => ff.kill('SIGKILL'), 15000);
  ff.stdout.on('data', c => chunks.push(c));
  ff.stderr.on('data', c => errs.push(c));
  ff.on('error', () => {
    clearTimeout(timer);
    pendingGrabs.delete(ff);
    resolve({ error: 'ffmpeg not found — install it and make sure it is on your PATH.' });
  });
  ff.on('close', code => {
    clearTimeout(timer);
    pendingGrabs.delete(ff);
    if (code === 0 && chunks.length) {
      resolve({ dataUrl: 'data:image/jpeg;base64,' + Buffer.concat(chunks).toString('base64') });
    } else {
      const tail = Buffer.concat(errs).toString().trim().split('\n').pop() || `ffmpeg exited with code ${code}`;
      resolve({ error: sanitize(tail.slice(-300), url) });
    }
  });
}));

// ---- IPC: ffmpeg availability check (startup status indicator) ----
ipcMain.handle('ffmpeg:check', () => new Promise(resolve => {
  let out = '';
  let ff;
  try {
    ff = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    resolve({ found: false, platform: process.platform });
    return;
  }
  ff.stdout.on('data', c => { out += c; });
  ff.on('error', () => resolve({ found: false, platform: process.platform }));
  ff.on('close', code => {
    const m = /ffmpeg version (\S+)/.exec(out);
    resolve(code === 0
      ? { found: true, version: m ? m[1] : null, platform: process.platform }
      : { found: false, platform: process.platform });
  });
}));

// ---- IPC: ONVIF discovery (spec 10) — main process only, discovery scope only ----
function scopeValue(scopes, key) {
  const m = new RegExp('onvif://www\\.onvif\\.org/' + key + '/([^\\s]+)').exec(scopes || '');
  return m ? decodeURIComponent(m[1]) : null;
}

function parseProbeMatch(data) {
  try {
    const pm = data.probeMatches.probeMatch;
    const xaddr = String(pm.XAddrs || '').split(/\s+/).filter(Boolean)[0];
    if (!xaddr) return null;
    const u = new URL(xaddr);
    const scopes = typeof pm.scopes === 'string' ? pm.scopes : '';
    return {
      address: u.hostname,
      port: u.port ? Number(u.port) : 80,
      xaddr,
      name: scopeValue(scopes, 'name'),
      hardware: scopeValue(scopes, 'hardware')
    };
  } catch {
    return null;
  }
}

let discovering = false;
ipcMain.handle('onvif:discover', () => new Promise(resolve => {
  if (discovering) { resolve({ error: 'Discovery already in progress.' }); return; }
  discovering = true;
  try {
    Discovery.probe({ timeout: 4000, resolve: false }, (err, matches) => {
      discovering = false;
      if (err) { resolve({ error: 'Discovery failed: ' + err.message }); return; }
      const seen = new Set();
      const devices = [];
      for (const m of matches || []) {
        const d = parseProbeMatch(m);
        if (d && !seen.has(d.address + ':' + d.port)) {
          seen.add(d.address + ':' + d.port);
          devices.push(d);
        }
      }
      resolve({ devices });
    });
  } catch (e) {
    discovering = false;
    resolve({ error: 'Discovery failed: ' + e.message });
  }
}));

ipcMain.handle('onvif:device', (_e, opts) => new Promise(resolve => {
  const { address, port, username, password } = opts || {};
  if (!address) { resolve({ error: 'No device address.' }); return; }
  // strip both credential parts from anything that could reach the UI or logs
  const scrub = (msg) => {
    let s = String(msg || 'Connection failed');
    if (password) s = s.split(password).join('***');
    if (username) s = s.split(username).join('***');
    return s;
  };
  const fail = (msg) => resolve({ error: scrub(msg) });
  let settled = false;
  const done = (v) => { if (!settled) { settled = true; resolve(v); } };
  const timer = setTimeout(() => done({ error: 'Device timed out after 8s.' }), 8000);

  try {
    new Cam({ hostname: address, port: port || 80, username, password, timeout: 7000 }, function (err) {
      if (err) { clearTimeout(timer); return done({ error: 'Could not connect: ' + scrub(err.message || err) }); }
      const cam = this;
      cam.getDeviceInformation((diErr, info) => {
        const device = {
          manufacturer: (info && info.manufacturer) || null,
          model: (info && info.model) || null,
          profiles: []
        };
        const profiles = Array.isArray(cam.profiles) ? cam.profiles : [];
        if (!profiles.length) { clearTimeout(timer); return done(device); }
        let pending = profiles.length;
        for (const p of profiles) {
          const enc = p.videoEncoderConfiguration || {};
          const entry = {
            name: p.name || 'profile',
            token: (p.$ && p.$.token) || p.token || null,
            width: (enc.resolution && enc.resolution.width) || null,
            height: (enc.resolution && enc.resolution.height) || null,
            fps: (enc.rateControl && enc.rateControl.frameRateLimit) || null,
            rtsp: null
          };
          device.profiles.push(entry);
          cam.getStreamUri({ protocol: 'RTSP', profileToken: entry.token }, (sErr, stream) => {
            if (!sErr && stream && stream.uri) entry.rtsp = stream.uri;
            if (--pending === 0) { clearTimeout(timer); done(device); }
          });
        }
      });
    });
  } catch (e) {
    clearTimeout(timer);
    fail(e.message);
  }
}));

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
