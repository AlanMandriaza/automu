import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import fs from 'fs'; // Importamos el módulo 'fs' de Node

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');

  // --- **LÓGICA DE ALMACENAMIENTO ROBUSTA** ---
  // 1. Obtener la ruta estándar para los datos de la aplicación.
  const userDataPath = app.getPath('userData');
  // 2. Definir la ruta específica para nuestro historial dentro de esa carpeta.
  const historyDataPath = path.join(userDataPath, 'history_data');
  
  // 3. Asegurarse de que el directorio exista.
  try {
    if (!fs.existsSync(historyDataPath)) {
      fs.mkdirSync(historyDataPath, { recursive: true });
    }
    console.log(`El historial se guardará en: ${historyDataPath}`);
  } catch (error) {
    console.error('Error al crear el directorio de historial:', error);
  }
  // --- **FIN DE LA LÓGICA** ---

  // 4. Pasar la ruta correcta al proceso del servidor como un argumento.
  serverProcess = fork(serverPath, [historyDataPath], {
    silent: true
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server]: ${data.toString().trim()}`);
  });
  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server ERROR]: ${data.toString().trim()}`);
  });
  serverProcess.on('exit', (code, signal) => {
    console.log(`El proceso del servidor terminó con código: ${code}, señal: ${signal}`);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('Intentando cerrar el proceso del servidor...');
    serverProcess.kill();
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'public/icon.png')
  });

  mainWindow.loadURL('http://localhost:3000');

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('before-quit', () => {
  stopServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
