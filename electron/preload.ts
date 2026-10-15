/**
 * LocalLedger AI - Desktop Preload Bridge
 *
 * Secure context bridge adhering to Electron security best practices:
 * - Node.js integration disabled
 * - Context isolation enabled
 * - Only minimal, strictly typed APIs exposed to renderer
 */

import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopBridge {
  getApiBaseUrl: () => string
  getBackendPort: () => number
  isDesktopApp: () => boolean
  getAppVersion: () => string
  getPlatform: () => string
  onBackendStatus: (callback: (status: { healthy: boolean; message?: string }) => void) => () => void
  onMenuAction: (callback: (action: string) => void) => () => void
  openDataFolder: () => Promise<void>
  showAboutDialog: () => Promise<void>
  triggerUploadDialog: () => Promise<void>
}

// Read configuration passed from main process via IPC or process arguments
let backendPort = 8000
try {
  const syncPort = ipcRenderer.sendSync('get-backend-port-sync')
  if (typeof syncPort === 'number' && syncPort > 0) {
    backendPort = syncPort
  }
} catch {
  const rawPort = process.argv?.find((arg) => arg.startsWith('--backend-port='))?.split('=')[1]
  if (rawPort) backendPort = parseInt(rawPort, 10)
}
const backendUrl = `http://127.0.0.1:${backendPort}/api/v1`

const desktopBridge: DesktopBridge = {
  getApiBaseUrl: () => backendUrl,
  getBackendPort: () => backendPort,
  isDesktopApp: () => true,
  getAppVersion: () => process.env.npm_package_version || '1.0.0',
  getPlatform: () => process.platform,
  onBackendStatus: (callback) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('backend-status', handler)
    return () => {
      ipcRenderer.removeListener('backend-status', handler)
    }
  },
  onMenuAction: (callback) => {
    const handler = (_event: any, action: string) => callback(action)
    ipcRenderer.on('menu-action', handler)
    return () => {
      ipcRenderer.removeListener('menu-action', handler)
    }
  },
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  showAboutDialog: () => ipcRenderer.invoke('show-about-dialog'),
  triggerUploadDialog: () => ipcRenderer.invoke('trigger-upload-dialog'),
}

// Expose safe API to renderer under window.desktopBridge
contextBridge.exposeInMainWorld('desktopBridge', desktopBridge)
console.log(`[DesktopBridge] Initialized secure desktop bridge; backend URL: ${backendUrl}`)
