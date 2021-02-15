import { app, BrowserWindow, ipcMain } from 'electron';
import { CutieEventCode, CutieEvent } from './constants'

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let mainWindow: BrowserWindow | null;

const createWindow = (): void => {
  // Create the browser window.
   mainWindow = new BrowserWindow({
    height: 800,
    width: 1000,
    minWidth: 775,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true
    },
    titleBarStyle: 'hidden',
    show: true,
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on(CutieEvent.WORD_COUNT_UPDATE, (event, arg) => {
  mainWindow.webContents.send(CutieEvent.PANE_CHANGE, arg);
  event.returnValue = CutieEventCode.SUCCESSFUL
});
ipcMain.on(CutieEvent.INITIALIZE, (event, arg) => {
    mainWindow.webContents.send(CutieEvent.LOAD_DIALOGUE, arg);
    event.returnValue = CutieEventCode.SUCCESSFUL
});