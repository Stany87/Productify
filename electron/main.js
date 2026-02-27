import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';
import dotenv from 'dotenv';

// 1. Load cloud credentials for the Supabase Postgres integration
// In a packaged Electron build, .env is copied to extraResources
const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '..', 'server', '.env');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn('[Electron] ⚠️ No .env file found at:', envPath);
}

// 2. Boot the Express server with the mapped DATABASE_URL
import { startServer } from '../server/index.js';

let mainWindow;

async function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.min(1280, width * 0.9),
        height: Math.min(800, height * 0.9),
        title: "Productify Mainframe",
        minWidth: 400,
        minHeight: 600,
        show: false, // Wait until fully loaded before showing to prevent white flicker
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // When the UI is done rendering out the HTML, show it
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    try {
        if (app.isPackaged) {
            // In production, load the local web server index
            await mainWindow.loadURL('http://localhost:3001');
        } else {
            // In dev, load Vite
            await mainWindow.loadURL('http://localhost:5173');
        }
    } catch (e) {
        console.error('Failed to load Productify URL:', e);
    }
}

app.whenReady().then(async () => {
    // 2. Boot the embedded Express backend server
    console.log('[Electron] Booting internal Express Server...');
    await startServer(3001);

    // 3. Mount the Chromium frontend GUI
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
