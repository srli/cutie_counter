/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './css/index.css';
import './css/ext/photon.min.css';
import './css/ext/quill.snow.css';

import { ipcRenderer } from 'electron'
import { CutiePane } from './cutie'
import { QuillPane } from './editor'
import { CutieEvent, CutieName } from './constants'
import { EventFlags } from './event_flags'


const cpane: CutiePane = new CutiePane(CutieName.HOLMES);
const qpane: QuillPane = new QuillPane();

class Monitor {
    private specialDailyPercentages: string[] = ['0.10', '0.33', '0.75', '1.00', '1.10', '1.50', '2.00'];
    private specialTotalPercentages: string[] = ['0.10', '0.25', '0.33', '0.50', '0.66', '0.75', '0.90', '1.00'];

    private readonly flags: EventFlags;

    constructor () {
        this.flags = new EventFlags()
    }

    public triggerWordCountEvent (wordCount: number) {
        // Calculate percentage of daily goal
        const dailyPercentage: number = (wordCount - this.flags.initialWordCount) / this.flags.dailyWordGoal
        console.log(`calculated: ${dailyPercentage.toFixed(2)}, trying to match ${this.specialDailyPercentages[0]}, it is ${dailyPercentage.toFixed(2) === this.specialDailyPercentages[0]}`)
        if (this.specialDailyPercentages[0] <= dailyPercentage.toFixed(2)) {
            console.log('hit daily goal')
            cpane.triggerEvent(CutieEvent.DAILY_WC_GOAL, [this.specialDailyPercentages.shift()])
        }
        // Calculate percentage of total goal
        const totalPercentage: number = wordCount / this.flags.totalWordGoal
        if (this.specialTotalPercentages[0] <= totalPercentage.toFixed(2)) {
            cpane.triggerEvent(CutieEvent.TOTAL_WC_GOAL, [this.specialTotalPercentages.shift()])
        }
    }
}

const monitor: Monitor = new Monitor();
ipcRenderer.on(CutieEvent.PANE_CHANGE, function (event, data) {
    monitor.triggerWordCountEvent(data)
});