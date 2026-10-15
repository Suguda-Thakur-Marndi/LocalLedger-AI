/**
 * LocalLedger AI - Native Application Menu & Context Menu Architecture
 *
 * Implements:
 * - File menu: Add Receipt (Ctrl+O), Open Data Folder, Export Vault Backup, Settings (Ctrl+,), Exit (Alt+F4)
 * - Edit menu: Undo, Redo, Cut, Copy, Paste, Select All (standard native editing roles)
 * - View menu: Reload (Ctrl+R), Force Reload (Ctrl+Shift+R), DevTools (Ctrl+Shift+I), Zoom controls, Fullscreen
 * - Window menu: Minimize (Ctrl+M), Close (Ctrl+W), Bring to Front
 * - Help menu: Help & Sovereign Guide (F1), About LocalLedger AI (Local-First privacy notice)
 * - Native right-click context menu for inputs and text selection
 */

import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions, shell } from 'electron'

export interface ApplicationMenuOptions {
  userDataDir: string
  getBackendPort: () => number
}

export function createApplicationMenu(mainWindow: BrowserWindow, options: ApplicationMenuOptions): Menu {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    // 1. File Menu
    {
      label: '&File',
      submenu: [
        {
          label: '&Add Receipt / Upload Files...',
          accelerator: 'CommandOrControl+O',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.focus()
              mainWindow.webContents.send('menu-action', 'add-receipt')
            }
          },
        },
        {
          label: '&Open Data Folder',
          accelerator: 'CommandOrControl+Shift+D',
          click: async () => {
            try {
              await shell.openPath(options.userDataDir)
            } catch (err) {
              console.error('[Menu] Failed to open data folder:', err)
            }
          },
        },
        {
          label: '&Export Vault Backup...',
          accelerator: 'CommandOrControl+Shift+B',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.focus()
              mainWindow.webContents.send('menu-action', 'export-backup')
            }
          },
        },
        { type: 'separator' },
        {
          label: '&Settings...',
          accelerator: 'CommandOrControl+,',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.focus()
              mainWindow.webContents.send('menu-action', 'open-settings')
            }
          },
        },
        { type: 'separator' },
        {
          label: 'E&xit',
          accelerator: isMac ? 'Command+Q' : 'Alt+F4',
          role: 'quit',
        },
      ],
    },

    // 2. Edit Menu (Standard native editing roles)
    {
      label: '&Edit',
      submenu: [
        { label: '&Undo', role: 'undo' },
        { label: '&Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cu&t', role: 'cut' },
        { label: '&Copy', role: 'copy' },
        { label: '&Paste', role: 'paste' },
        { label: 'Select &All', role: 'selectAll' },
      ],
    },

    // 3. View Menu
    {
      label: '&View',
      submenu: [
        { label: '&Reload', role: 'reload', accelerator: 'CommandOrControl+R' },
        { label: '&Force Reload', role: 'forceReload', accelerator: 'CommandOrControl+Shift+R' },
        { label: 'Toggle &Developer Tools', role: 'toggleDevTools', accelerator: 'CommandOrControl+Shift+I' },
        { type: 'separator' },
        { label: 'Actual &Size', role: 'resetZoom', accelerator: 'CommandOrControl+0' },
        { label: 'Zoom &In', role: 'zoomIn', accelerator: 'CommandOrControl+=' },
        { label: 'Zoom &Out', role: 'zoomOut', accelerator: 'CommandOrControl+-' },
        { type: 'separator' },
        { label: 'Toggle &Full Screen', role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },

    // 4. Window Menu
    {
      label: '&Window',
      submenu: [
        { label: '&Minimize', role: 'minimize', accelerator: 'CommandOrControl+M' },
        { label: '&Close', role: 'close', accelerator: 'CommandOrControl+W' },
        { type: 'separator' },
        {
          label: 'Bring &All to Front',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.show()
              mainWindow.focus()
            }
          },
        },
      ],
    },

    // 5. Help Menu
    {
      label: '&Help',
      submenu: [
        {
          label: '&Documentation & Sovereign Guide',
          accelerator: 'F1',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.focus()
              mainWindow.webContents.send('menu-action', 'open-help')
            }
          },
        },
        { type: 'separator' },
        {
          label: '&About LocalLedger AI',
          click: () => {
            showAboutDialog(mainWindow)
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  return menu
}

/**
 * Displays the official native About dialog.
 */
export function showAboutDialog(parentWindow?: BrowserWindow | null): void {
  const version = app.getVersion() || '1.0.0'
  dialog.showMessageBox(parentWindow || undefined as any, {
    type: 'info',
    title: 'About LocalLedger AI',
    message: `LocalLedger AI — v${version}`,
    detail:
      'Private, sovereign invoice and receipt management desktop application.\n\n' +
      '• 100% On-Device Processing: OCR parsing, neural extraction, and SQLite database run locally.\n' +
      '• Sovereign Privacy: Zero telemetry, zero cloud tracking, zero external network sockets.\n' +
      '• Loopback Security: Bound strictly to 127.0.0.1.',
    buttons: ['OK'],
  })
}

/**
 * Attaches a native right-click context menu (Cut, Copy, Paste, Select All) to the browser window.
 */
export function attachContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const isEditable = params.isEditable
    const hasText = params.selectionText.trim().length > 0

    const template: MenuItemConstructorOptions[] = []

    if (isEditable) {
      template.push(
        { role: 'undo', enabled: params.editFlags.canUndo },
        { role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    } else if (hasText) {
      template.push(
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    }

    if (!app.isPackaged || process.env.NODE_ENV === 'development') {
      if (template.length > 0) template.push({ type: 'separator' })
      template.push({
        label: 'Inspect Element',
        click: () => win.webContents.inspectElement(params.x, params.y),
      })
    }

    if (template.length > 0) {
      const contextMenu = Menu.buildFromTemplate(template)
      contextMenu.popup({ window: win })
    }
  })
}
