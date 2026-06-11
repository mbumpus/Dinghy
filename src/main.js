// Dinghy main process (spec 09). Plain CommonJS, no build step.
// Responsibilities: BrowserWindow shell, menu, config.yml file I/O, ffmpeg frame grab.
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

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

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
