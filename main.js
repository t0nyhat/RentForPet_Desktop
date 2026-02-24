const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const os = require("os");
const http = require("http");

let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (_) {
  // electron-updater пока не установлен в окружении разработки
}

// Хранит ссылку на дочерний процесс .NET и единственное главное окно
let dotnetProcess = null;
let mainWindowRef = null;
let updateCheckIntervalRef = null;

// Единая папка "Pet Hotel" (как и data) — чтобы api.log был там же, где DB и документация
function getPetHotelDir() {
  return path.join(app.getPath("appData"), "Pet Hotel");
}
function getApiLogPath() {
  return path.join(getPetHotelDir(), "api.log");
}

function getWindowIconPath() {
  const iconPath = path.join(__dirname, "build", "icons", "icon.png");
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function writeApiLog(line) {
  const lineStr = `[${new Date().toISOString()}] ${line}\n`;
  try {
    const logPath = getApiLogPath();
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logPath, lineStr);
  } catch (e) {
    console.error("writeApiLog:", e);
  }
  // Запасной лог в /tmp (всегда доступен для записи)
  try {
    fs.appendFileSync("/tmp/pethotel-desktop.log", lineStr);
  } catch (_) {}
}

// Получение пути к исполняемому файлу .NET в зависимости от платформы
function getDotNetExecutablePath() {
  const isDev = !app.isPackaged;
  const platform = os.platform();
  let executablePath = "";

  if (isDev) {
    // В режиме разработки используем проект .NET
    executablePath = path.join(
      __dirname,
      "PetHotel.API",
      "bin",
      "Debug",
      "net8.0",
      "PetHotel.API",
    );
    if (platform === "win32") {
      executablePath += ".exe";
    }
  } else {
    // В собранном приложении используем исполняемый файл из ресурсов
    if (platform === "win32") {
      executablePath = path.join(
        process.resourcesPath,
        "dotnet",
        "PetHotel.API.exe",
      );
    } else {
      executablePath = path.join(
        process.resourcesPath,
        "dotnet",
        "PetHotel.API",
      );
    }
  }

  return executablePath;
}

// Запуск .NET сервера
function startDotNetServer() {
  const executablePath = getDotNetExecutablePath();
  const isDev = !app.isPackaged;

  // В packaged режиме: данные в ~/Library/Application Support/Pet Hotel/data
  // В dev режиме: данные в папке проекта (data/), НЕ устанавливаем PETSHOTEL_DATA_PATH
  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: "http://localhost:5226",
  };

  // Только для packaged приложения устанавливаем путь к данным
  if (!isDev) {
    const dataPath = path.join(app.getPath("appData"), "Pet Hotel", "data");
    env.PETSHOTEL_DATA_PATH = dataPath;
  }

  console.log(`Запуск .NET сервера: ${executablePath}`);
  console.log(
    `Dev режим: ${isDev}, PETSHOTEL_DATA_PATH: ${env.PETSHOTEL_DATA_PATH || "(не задан, используется папка проекта)"}`,
  );

  const logToFile = app.isPackaged;
  if (logToFile) {
    writeApiLog(`Запуск API: ${executablePath}`);
    writeApiLog(`PETSHOTEL_DATA_PATH=${env.PETSHOTEL_DATA_PATH}`);
  }

  const spawnOpts = {
    cwd: path.dirname(executablePath),
    env,
    stdio: logToFile ? ["ignore", "pipe", "pipe"] : "inherit",
  };

  try {
    // На macOS запуск через shell иногда обходит ограничения на вложенные бинарники в .app
    if (app.isPackaged && os.platform() === "darwin") {
      const cmd = `"${executablePath}"`;
      dotnetProcess = spawn(cmd, [], { ...spawnOpts, shell: true });
    } else {
      dotnetProcess = spawn(executablePath, [], spawnOpts);
    }
  } catch (e) {
    if (logToFile) writeApiLog("ОШИБКА spawn: " + e.message);
    throw e;
  }

  if (logToFile && dotnetProcess.stdout) {
    dotnetProcess.stdout.on("data", (data) => {
      writeApiLog(data.toString().trim());
    });
  }
  if (logToFile && dotnetProcess.stderr) {
    dotnetProcess.stderr.on("data", (data) => {
      writeApiLog("STDERR: " + data.toString().trim());
    });
  }

  dotnetProcess.on("error", (error) => {
    console.error("Ошибка запуска .NET сервера:", error);
    if (logToFile) {
      writeApiLog("ОШИБКА запуска: " + error.message);
    }
  });

  dotnetProcess.on("exit", (code, signal) => {
    console.log(
      `.NET сервер завершил работу с кодом: ${code} и сигналом: ${signal}`,
    );
    if (logToFile) {
      writeApiLog(`Выход: code=${code} signal=${signal}`);
    }
  });
}

const API_PORT = 5226;
const API_HEALTH_URL = `http://localhost:${API_PORT}/health`;

function setupAutoUpdates() {
  if (!app.isPackaged || !autoUpdater) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    writeApiLog("Проверка обновлений GitHub...");
  });

  autoUpdater.on("update-available", (info) => {
    writeApiLog(`Найдено обновление: ${info.version}`);
    dialog
      .showMessageBox(mainWindowRef ?? undefined, {
        type: "info",
        title: "Доступно обновление",
        message: `Доступна новая версия ${info.version}.`,
        detail: "Обновление загружается в фоне.",
        buttons: ["OK"],
      })
      .catch(() => {});
  });

  autoUpdater.on("update-not-available", (info) => {
    writeApiLog(`Обновлений нет. Текущая версия: ${info.version}`);
  });

  autoUpdater.on("download-progress", (progress) => {
    writeApiLog(`Загрузка обновления: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    writeApiLog(`Обновление загружено: ${info.version}`);
    dialog
      .showMessageBox(mainWindowRef ?? undefined, {
        type: "question",
        title: "Обновление готово",
        message: `Версия ${info.version} готова к установке.`,
        detail: "Перезапустить приложение сейчас?",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => {});
  });

  autoUpdater.on("error", (error) => {
    writeApiLog(`Ошибка автообновления: ${error?.message || error}`);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    writeApiLog(`Не удалось проверить обновления: ${error?.message || error}`);
  });

  // Повторная проверка раз в 6 часов
  updateCheckIntervalRef = setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((error) => {
        writeApiLog(
          `Периодическая проверка обновлений завершилась с ошибкой: ${error?.message || error}`,
        );
      });
    },
    6 * 60 * 60 * 1000,
  );
}

/** Ждём, пока API ответит на /health (макс. 30 сек), затем вызываем cb ровно один раз. */
function waitForApiReady(cb, maxWaitMs = 30000) {
  let done = false;
  function callOnce() {
    if (done) return;
    done = true;
    cb();
  }
  const start = Date.now();
  function tryOnce() {
    const req = http.get(API_HEALTH_URL, (res) => {
      if (res.statusCode === 200) callOnce();
      else scheduleNext();
    });
    req.on("error", () => scheduleNext());
    req.setTimeout(2000, () => {
      req.destroy();
      scheduleNext();
    });
  }
  function scheduleNext() {
    if (done) return;
    if (Date.now() - start >= maxWaitMs) {
      if (app.isPackaged)
        writeApiLog("Таймаут ожидания API (30 сек), открываем окно.");
      callOnce();
      return;
    }
    setTimeout(tryOnce, 500);
  }
  tryOnce();
}

// Создание главного окна приложения (только одно окно)
function createWindow() {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.focus();
    return;
  }
  mainWindowRef = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      // Allow file:// to fetch localhost (packaged app loads from file://, requests to API)
      webSecurity: !app.isPackaged,
    },
  });

  // Чтобы фронт однозначно определил Electron и подключался к localhost:5226
  const ua = mainWindowRef.webContents.getUserAgent();
  if (!ua.toLowerCase().includes("electron")) {
    mainWindowRef.webContents.setUserAgent(ua + " Electron/Desktop");
  }

  mainWindowRef.on("closed", () => {
    mainWindowRef = null;
  });

  // Загрузка React приложения
  if (app.isPackaged) {
    // В упакованном приложении __dirname указывает внутрь app.asar
    const indexPath = path.join(__dirname, "frontend", "dist", "index.html");
    mainWindowRef.loadFile(indexPath).catch((err) => {
      console.error("Ошибка загрузки файла index.html:", err);
      console.log("Путь к файлу:", indexPath);
    });
  } else {
    mainWindowRef.loadURL("http://localhost:5173");
  }

  // Открытие DevTools в режиме разработки
  if (!app.isPackaged) {
    mainWindowRef.webContents.openDevTools();
  }
}

// Обработчик события готовности приложения
app.whenReady().then(() => {
  // Сразу пишем в лог (проверка, что запущена эта сборка; путь см. в BUILD_DESKTOP.md)
  if (app.isPackaged) {
    writeApiLog("App ready");
  }

  // Запуск .NET сервера
  startDotNetServer();

  // В упакованном приложении ждём готовности API (БД + seed), затем открываем окно
  if (app.isPackaged) {
    waitForApiReady(() => {
      createWindow();
      setupAutoUpdates();
    });
  } else {
    createWindow();
  }

  // Обработчик активации приложения (macOS) — не создаём второе окно
  app.on("activate", () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.focus();
      return;
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Обработчик завершения работы приложения
app.on("before-quit", () => {
  // Остановка .NET сервера при завершении приложения
  if (dotnetProcess) {
    dotnetProcess.kill();
  }
  if (updateCheckIntervalRef) {
    clearInterval(updateCheckIntervalRef);
    updateCheckIntervalRef = null;
  }
});

// Обработчик завершения работы приложения (все окна закрыты)
app.on("window-all-closed", () => {
  // Закрытие последнего окна = выход из приложения (в т.ч. на macOS)
  app.quit();
});

// IPC обработчики
ipcMain.handle("get-app-info", () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    isPackaged: app.isPackaged,
  };
});
