const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, clipboard, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

function loadEnvironment() {
    const candidates = [
        process.env.APTEKA999_ENV,
        path.join(process.cwd(), '.env'),
        process.platform === 'win32' ? 'C:\\sync-agent\\.env' : '',
        path.join(path.dirname(process.execPath), '.env'),
    ].filter(Boolean);
    const envPath = candidates.find(candidate => fs.existsSync(candidate));
    require('dotenv').config(envPath ? { path: envPath } : {});
    return envPath || '';
}

const envPath = loadEnvironment();
const backendUrl = String(process.env.BACKEND_URL || '').replace(/\/+$/, '');
const apiKey = String(process.env.OPERATOR_API_KEY || process.env.SYNC_API_KEY || '');
const branchNumber = Number.parseInt(process.env.BRANCH_NUMBER || '', 10);
const operatorName = String(process.env.OPERATOR_NAME || 'Kassa xodimi').trim();
const pollMs = Math.max(3, Number.parseInt(process.env.ORDER_POLL_SECONDS || '5', 10)) * 1000;
const api = axios.create({
    baseURL: `${backendUrl}/api/sync`,
    timeout: 15_000,
    headers: {
        'x-operator-key': apiKey,
        'x-sync-key': apiKey,
        'content-type': 'application/json',
    },
});

let mainWindow;
let tray;
let quitting = false;
let pollTimer;
let pollInFlight = false;
let knownOrderIds = new Set();
let firstPoll = true;

function iconPath() {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'logo999.jpg')
        : path.join(__dirname, '..', '..', 'frontend', 'public', 'logo999.jpg');
}

function configError() {
    if (!backendUrl) return 'BACKEND_URL kiritilmagan';
    if (apiKey.length < 16) return 'OPERATOR_API_KEY yoki SYNC_API_KEY kiritilmagan';
    if (!Number.isInteger(branchNumber)) return 'BRANCH_NUMBER noto\'g\'ri';
    return '';
}

function showWindow() {
    if (!mainWindow) return;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    const [windowWidth, windowHeight] = mainWindow.getSize();
    mainWindow.setPosition(
        Math.round(x + width - windowWidth - 24),
        Math.max(y + 20, Math.round(y + (height - windowHeight) / 2))
    );
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.show();
    mainWindow.focus();
    mainWindow.flashFrame(true);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 560,
        height: 760,
        minWidth: 500,
        minHeight: 620,
        show: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        backgroundColor: '#f3f7f5',
        icon: iconPath(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.on('close', event => {
        if (quitting) return;
        event.preventDefault();
        mainWindow.hide();
    });
}

function createTray() {
    const image = nativeImage.createFromPath(iconPath()).resize({ width: 20, height: 20 });
    tray = new Tray(image);
    tray.setToolTip('Apteka999 Operator');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Buyurtmalarni ochish', click: showWindow },
        { label: 'Hozir tekshirish', click: () => pollOrders(true) },
        { type: 'separator' },
        { label: 'Chiqish', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('double-click', showWindow);
}

function alertNewOrders(count) {
    showWindow();
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: `Yangi buyurtma${count > 1 ? 'lar' : ''} keldi`,
            body: `${count} ta buyurtma xodim tasdig'ini kutmoqda.`,
            icon: iconPath(),
            urgency: 'critical',
        });
        notification.on('click', showWindow);
        notification.show();
    }
    mainWindow.webContents.send('orders:alert', { count });
}

async function pollOrders(forceShow = false) {
    if (pollInFlight || configError()) return;
    pollInFlight = true;
    try {
        const { data } = await api.get('/operator/orders', { params: { branchNumber } });
        const orders = Array.isArray(data.orders) ? data.orders : [];
        const currentIds = new Set(orders.map(order => order._id));
        const newOrders = orders.filter(order => !knownOrderIds.has(order._id));
        knownOrderIds = currentIds;
        mainWindow.webContents.send('orders:update', { ...data, connected: true });
        if ((firstPoll && orders.length > 0) || (!firstPoll && newOrders.length > 0)) {
            alertNewOrders(firstPoll ? orders.length : newOrders.length);
        } else if (forceShow) {
            showWindow();
        }
        firstPoll = false;
    } catch (error) {
        mainWindow.webContents.send('orders:connection', {
            connected: false,
            message: [
                error.response?.data?.error || error.message,
                envPath ? `Sozlama: ${envPath}` : 'Sozlama fayli topilmadi',
                backendUrl ? `Backend: ${backendUrl}` : '',
                Number.isInteger(branchNumber) ? `Filial: ${branchNumber}` : '',
            ].filter(Boolean).join(' | '),
        });
        if (forceShow) showWindow();
    } finally {
        pollInFlight = false;
    }
}

ipcMain.handle('orders:action', async (_event, payload) => {
    const action = payload?.action;
    if (!['accept', 'reject'].includes(action)) throw new Error('Noto\'g\'ri amal');
    const body = {
        branchNumber,
        operatorName,
        ...(action === 'reject' ? { reason: payload.reason, comment: payload.comment } : {}),
    };
    try {
        const { data } = await api.post(`/operator/orders/${payload.orderId}/${action}`, body);
        await pollOrders();
        return data;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
});

ipcMain.handle('clipboard:write', (_event, text) => {
    clipboard.writeText(String(text || ''));
    return true;
});
ipcMain.on('window:hide', () => mainWindow?.hide());
ipcMain.handle('app:info', () => ({ branchNumber, operatorName, envPath, configError: configError() }));

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
    app.on('second-instance', showWindow);
    app.whenReady().then(() => {
        createWindow();
        createTray();
        if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
        mainWindow.webContents.once('did-finish-load', () => {
            const error = configError();
            if (error) {
                mainWindow.webContents.send('orders:connection', { connected: false, message: error });
                showWindow();
                return;
            }
            pollOrders();
            pollTimer = setInterval(pollOrders, pollMs);
        });
    });
}

app.on('before-quit', () => {
    quitting = true;
    if (pollTimer) clearInterval(pollTimer);
});
app.on('window-all-closed', event => event.preventDefault());
