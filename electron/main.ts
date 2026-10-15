/**
 * LocalLedger AI - Electron Main Process (Desktop Shell & Dev Workflow)
 *
 * Manages:
 * - Local loopback port discovery on 127.0.0.1
 * - FastAPI backend process lifecycle management
 * - Automatic Vite development server integration
 * - Safe child process cleanup on shutdown (tree kill without touching unrelated processes)
 * - Electron security profile: contextIsolation, navigation lockdown, shell external links
 * - Per-user persistent storage
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { ChildProcess, spawn, spawnSync } from 'child_process'
import http from 'http'
import net from 'net'
import path from 'path'
import fs from 'fs'
import { createApplicationMenu, attachContextMenu, showAboutDialog } from './menu'

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null
let viteProcess: ChildProcess | null = null
let assignedBackendPort: number = 8000
let isShuttingDown: boolean = false
let backendStderrLog: string = ''
let viteStderrLog: string = ''

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

/**
 * Searches for an available loopback port on 127.0.0.1.
 * Tests preferred port (8000) first; if occupied, asks OS for an ephemeral free port.
 */
function findFreeLoopbackPort(preferredPort = 8000): Promise<number> {
  return new Promise((resolve) => {
    const testServer = net.createServer()
    testServer.unref()

    testServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        const fallbackServer = net.createServer()
        fallbackServer.unref()
        fallbackServer.listen(0, '127.0.0.1', () => {
          const ephemeralPort = (fallbackServer.address() as net.AddressInfo).port
          fallbackServer.close(() => resolve(ephemeralPort))
        })
      } else {
        resolve(preferredPort)
      }
    })

    testServer.listen(preferredPort, '127.0.0.1', () => {
      const port = (testServer.address() as net.AddressInfo).port
      testServer.close(() => resolve(port))
    })
  })
}

/**
 * Probes an HTTP URL to verify if a server is actively responding.
 */
function probeHttpUrl(url: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * Polls backend health endpoint until HTTP 200 is verified or timeout expires.
 */
function waitForBackendHealth(port: number, timeoutMs = 25000): Promise<boolean> {
  const startTime = Date.now()
  const healthUrl = `http://127.0.0.1:${port}/api/v1/health`

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (isShuttingDown) return resolve(false)

      if (backendProcess && backendProcess.exitCode !== null && backendProcess.exitCode !== 0) {
        return reject(
          new Error(
            `Local backend process exited unexpectedly with code ${backendProcess.exitCode}.\n\nLog preview:\n${backendStderrLog.slice(-600) || '(No stderr output recorded)'}`
          )
        )
      }

      const isUp = await probeHttpUrl(healthUrl, 1200)
      if (isUp) {
        return resolve(true)
      }

      if (Date.now() - startTime > timeoutMs) {
        return reject(
          new Error(
            `Timed out after ${timeoutMs / 1000}s waiting for local backend at http://127.0.0.1:${port}/api/v1/health.`
          )
        )
      }

      setTimeout(check, 300)
    }

    check()
  })
}

/**
 * Polls Vite dev server until active.
 */
function waitForViteServer(url: string, timeoutMs = 25000): Promise<boolean> {
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (isShuttingDown) return resolve(false)

      if (viteProcess && viteProcess.exitCode !== null && viteProcess.exitCode !== 0) {
        return reject(
          new Error(
            `Vite development server exited unexpectedly with code ${viteProcess.exitCode}.\n\nLog preview:\n${viteStderrLog.slice(-600) || '(No stderr output recorded)'}`
          )
        )
      }

      const isUp = await probeHttpUrl(url, 1200)
      if (isUp) {
        return resolve(true)
      }

      if (Date.now() - startTime > timeoutMs) {
        return reject(
          new Error(
            `Timed out after ${timeoutMs / 1000}s waiting for Vite dev server at ${url}.`
          )
        )
      }

      setTimeout(check, 400)
    }

    check()
  })
}

/**
 * Resolves Python virtual environment and execution configuration.
 */
function resolveBackendLaunchConfig(dataDir: string, port: number) {
  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, 'backend', 'localledger-backend', 'localledger-backend.exe'),
      path.join(process.resourcesPath, 'localledger-backend', 'localledger-backend.exe'),
      path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'dist',
        'backend',
        'localledger-backend',
        'localledger-backend.exe'
      ),
      path.join(__dirname, '..', 'dist', 'backend', 'localledger-backend', 'localledger-backend.exe'),
    ]

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return {
          command: cand,
          args: ['--host', '127.0.0.1', '--port', String(port), '--data-dir', dataDir],
          cwd: path.dirname(cand),
        }
      }
    }

    throw new Error(
      `Packaged backend executable not found in resources. Checked:\n${candidates.join('\n')}`
    )
  } else {
    // Development mode
    const rootDir = path.resolve(__dirname, '..')
    const venvPython = path.join(rootDir, 'backend', '.venv', 'Scripts', 'python.exe')
    const rootVenvPython = path.join(rootDir, '.venv', 'Scripts', 'python.exe')
    const desktopEntry = path.join(rootDir, 'backend', 'desktop_entry.py')

    if (!fs.existsSync(venvPython) && !fs.existsSync(rootVenvPython)) {
      throw new Error(
        `Python virtual environment not found!\n\nPlease initialize the backend virtual environment:\n` +
          `  cd backend\n` +
          `  python -m venv .venv\n` +
          `  .\\.venv\\Scripts\\pip.exe install -r requirements.txt`
      )
    }

    const pythonBin = fs.existsSync(venvPython) ? venvPython : rootVenvPython

    if (!fs.existsSync(desktopEntry)) {
      throw new Error(`Desktop entrypoint script missing: ${desktopEntry}`)
    }

    return {
      command: pythonBin,
      args: [desktopEntry, '--host', '127.0.0.1', '--port', String(port)],
      cwd: path.join(rootDir, 'backend'),
    }
  }
}

/**
 * Starts FastAPI backend service.
 */
async function startBackendService(port: number, dataDir: string): Promise<void> {
  const config = resolveBackendLaunchConfig(dataDir, port)
  console.log(`[Main] Launching LocalLedger backend: ${config.command} ${config.args.join(' ')}`)

  backendProcess = spawn(config.command, config.args, {
    cwd: config.cwd,
    env: {
      ...process.env,
      ...(app.isPackaged ? { LOCALLEDGER_DATA_DIR: dataDir } : {}),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout?.on('data', (chunk) => {
    console.log(`[Backend stdout] ${chunk.toString().trim()}`)
  })

  backendProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString()
    backendStderrLog += text
    console.error(`[Backend stderr] ${text.trim()}`)
  })

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Main] Backend process exited with code ${code}, signal: ${signal}`)
    if (!isShuttingDown && code !== 0) {
      dialog.showErrorBox(
        'Backend Process Error',
        `LocalLedger AI companion terminated unexpectedly (exit code ${code}).\n\nLog preview:\n${backendStderrLog.slice(
          -600
        )}`
      )
    }
    backendProcess = null
  })

  await waitForBackendHealth(port)
  console.log(`[Main] LocalLedger backend verified healthy on http://127.0.0.1:${port}`)
}

/**
 * In development mode, ensures the Vite development server is running.
 */
async function ensureViteDevServer(): Promise<string> {
  const devUrl = 'http://127.0.0.1:5173/'
  const alreadyRunning = await probeHttpUrl(devUrl, 1000)

  if (alreadyRunning) {
    console.log(`[Main] Detected existing Vite dev server at ${devUrl}`)
    return devUrl
  }

  const rootDir = path.resolve(__dirname, '..')
  const frontendDir = path.join(rootDir, 'frontend')

  if (!fs.existsSync(path.join(frontendDir, 'package.json'))) {
    throw new Error(`Frontend package.json not found at ${frontendDir}`)
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  console.log(`[Main] Spawning Vite development server in ${frontendDir}...`)

  viteProcess = spawn(npmCmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: frontendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  })

  viteProcess.stdout?.on('data', (chunk) => {
    console.log(`[Vite stdout] ${chunk.toString().trim()}`)
  })

  viteProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString()
    viteStderrLog += text
    console.error(`[Vite stderr] ${text.trim()}`)
  })

  viteProcess.on('exit', (code) => {
    console.log(`[Main] Vite dev server exited with code ${code}`)
    viteProcess = null
  })

  await waitForViteServer(devUrl, 25000)
  console.log(`[Main] Vite dev server active and verified at ${devUrl}`)
  return devUrl
}

/**
 * Gracefully terminates spawned child processes (backend and vite) on Windows without
 * affecting any unrelated or pre-existing processes.
 */
function terminateChildProcesses(): void {
  isShuttingDown = true

  if (backendProcess && !backendProcess.killed) {
    const pid = backendProcess.pid
    if (pid) {
      console.log(`[Main] Stopping backend process tree (PID ${pid})...`)
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
        } else {
          backendProcess.kill('SIGTERM')
        }
      } catch (err) {
        console.error('[Main] Error terminating backend process:', err)
      }
    }
    backendProcess = null
  }

  if (viteProcess && !viteProcess.killed) {
    const pid = viteProcess.pid
    if (pid) {
      console.log(`[Main] Stopping Vite dev server process tree (PID ${pid})...`)
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
        } else {
          viteProcess.kill('SIGTERM')
        }
      } catch (err) {
        console.error('[Main] Error terminating Vite dev server process:', err)
      }
    }
    viteProcess = null
  }
}

/**
 * Creates and configures the main Electron BrowserWindow.
 */
function createMainWindow(port: number, devUrl?: string): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.js')
  const iconCandidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
  ]
  const resolvedIcon = iconCandidates.find((c) => fs.existsSync(c))

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'LocalLedger AI',
    backgroundColor: '#0b0f19',
    icon: resolvedIcon,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      preload: preloadPath,
      additionalArguments: [`--backend-port=${port}`],
    },
  })

  // Attach native context menu (Cut, Copy, Paste, Select All)
  attachContextMenu(win)

  // Diagnostic logging for renderer events and console messages
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer did-fail-load] code: ${errorCode}, error: ${errorDescription}, url: ${validatedURL}`)
  })

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelNames = ['verbose', 'info', 'warning', 'error']
    const lvl = levelNames[level] || 'log'
    console.log(`[Renderer ${lvl}] ${message} (${sourceId}:${line})`)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Renderer crash] reason: ${details.reason}, exitCode: ${details.exitCode}`)
  })

  // Security: block unauthorized renderer navigation
  win.webContents.on('will-navigate', (event, url) => {
    const isLocalAppUrl =
      url.startsWith('file://') ||
      url.startsWith(`http://127.0.0.1:${port}`) ||
      url.startsWith('http://localhost:5173') ||
      url.startsWith('http://127.0.0.1:5173')

    if (!isLocalAppUrl) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // Security: open external popup links in user default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load UI: in dev mode use Vite dev server; in production load built files
  if (!app.isPackaged && devUrl) {
    win.loadURL(devUrl).catch((err) => {
      console.error('[Main] Failed to load dev URL:', err)
      dialog.showErrorBox('Failed to load application', `Could not load dev server at ${devUrl}:\n\n${err.message}`)
    })
  } else {
    const candidates = [
      path.resolve(__dirname, '..', 'frontend', 'dist', 'index.html'),
      path.join(app.getAppPath(), 'frontend', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'index.html'),
    ]
    const foundPath = candidates.find((c) => fs.existsSync(c))
    if (foundPath) {
      console.log(`[Main] Loading production UI from: ${foundPath}`)
      win.loadFile(foundPath).catch((err) => {
        console.error('[Main] Failed to load index.html:', err)
        dialog.showErrorBox('Failed to load application', `Could not load frontend bundle at ${foundPath}:\n\n${err.message}`)
      })
    } else {
      const err = new Error(`Frontend bundle not found. Checked:\n${candidates.join('\n')}`)
      console.error('[Main]', err.message)
      dialog.showErrorBox('Frontend Bundle Missing', err.message)
      throw err
    }
  }

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.on('did-finish-load', async () => {
    try {
      const rootHtml = await win.webContents.executeJavaScript('document.getElementById("root")?.innerHTML || ""')
      const docTitle = await win.webContents.executeJavaScript('document.title')
      if (rootHtml.trim().length > 0) {
        console.log(`[Renderer DOM] Successfully rendered "${docTitle}" (root HTML size: ${rootHtml.length} chars)`)
      } else {
        console.error(`[Renderer DOM ERROR] Document loaded but #root is EMPTY! Blank window detected!`)
      }
    } catch (err: any) {
      console.error('[Renderer DOM check error]', err)
    }
  })

  setTimeout(() => {
    if (win && !win.isDestroyed() && !win.isVisible()) {
      console.log('[Main] Forcing window display after timeout fallback')
      win.show()
    }
  }, 3000)

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

// App lifecycle
app.whenReady().then(async () => {
  const userDataDir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(userDataDir, { recursive: true })

  ipcMain.handle('open-data-folder', async () => {
    await shell.openPath(userDataDir)
  })

  ipcMain.on('get-backend-port-sync', (event) => {
    event.returnValue = assignedBackendPort
  })

  ipcMain.handle('get-backend-port', async () => assignedBackendPort)
  ipcMain.handle('get-backend-url', async () => `http://127.0.0.1:${assignedBackendPort}/api/v1`)
  ipcMain.handle('show-about-dialog', async () => {
    showAboutDialog(mainWindow)
  })
  ipcMain.handle('trigger-upload-dialog', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.webContents.send('menu-action', 'add-receipt')
    }
  })

  try {
    // 1. Identify an open loopback port safely
    assignedBackendPort = await findFreeLoopbackPort(8000)
    console.log(`[Main] Assigned backend loopback port: ${assignedBackendPort}`)

    // 2. Launch FastAPI backend
    await startBackendService(assignedBackendPort, userDataDir)

    // 3. In development mode, ensure Vite dev server is running
    let devServerUrl: string | undefined
    if (!app.isPackaged) {
      devServerUrl = await ensureViteDevServer()
    }

    // 4. Create Electron window and set application menu
    mainWindow = createMainWindow(assignedBackendPort, devServerUrl)
    createApplicationMenu(mainWindow, { userDataDir, getBackendPort: () => assignedBackendPort })

    // 5. Check for test auto-exit flag
    const autoExitArg = process.argv.find((a) => a.startsWith('--auto-exit-after='))
    if (autoExitArg) {
      const ms = parseInt(autoExitArg.split('=')[1], 10)
      if (!isNaN(ms) && ms > 0) {
        console.log(`[Main] Auto-exit scheduled in ${ms}ms`)
        setTimeout(() => {
          console.log('[Main] Auto-exit timer reached, quitting app...')
          app.quit()
        }, ms)
      }
    }
  } catch (err: any) {
    console.error('[Main] Startup failure:', err)
    dialog.showErrorBox(
      'Startup Failure - LocalLedger AI',
      `Failed to launch LocalLedger AI desktop environment.\n\n${err.message || err}`
    )
    terminateChildProcesses()
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(assignedBackendPort)
    }
  })
})

// Clean shutdown listeners
app.on('before-quit', terminateChildProcesses)
app.on('will-quit', terminateChildProcesses)
process.on('exit', terminateChildProcesses)
process.on('SIGINT', () => {
  terminateChildProcesses()
  app.quit()
})
process.on('SIGTERM', () => {
  terminateChildProcesses()
  app.quit()
})

app.on('window-all-closed', () => {
  terminateChildProcesses()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
