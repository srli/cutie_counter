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

import './css/app.css';
import './css/common.css';
import './css/ext/photon.min.css';
import './css/ext/quill.snow.css';

import { ipcRenderer } from 'electron'
import { CutiePane } from './cutie'
import { QuillPane } from './editor'
import { CutieEvent, CutieName, TimeOfDay } from './constants'
import { EventFlags } from './event_flags'


const cpane: CutiePane = new CutiePane(CutieName.RYDER);
const qpane: QuillPane = new QuillPane();

class Monitor {
    private specialDailyPercentages: string[] = ['10', '33', '75', '100', '110', '150', '200'];
    private specialTotalPercentages: string[] = ['10', '25', '33', '50', '66', '75', '90', '100'];

    private readonly flags: EventFlags;
    private eventTriggered: boolean;

    constructor() {
        this.flags = new EventFlags();
        this.triggerTimeEvent();
        setInterval(this.triggerTimeEvent, 1.8e+6); // Run the timer event every 30 minutes
        ipcRenderer.send(CutieEvent.INITIALIZE)
        // this.TimeEvent()
    }

    public async initialize(): Promise<void> {
        await cpane.initialize()
    }

    public triggerWordCountEvent(wordCount: number): void {
        // TODO: Should expressions be reset as the user keeps typing?
        // if (this.eventTriggered) {
        //     cpane.resetGui();
        //     this.eventTriggered = false;
        //     return;
        // }

        // Calculate percentage of daily goal
        const dailyPercentage: number = ((wordCount - this.flags.initialWordCount) / this.flags.dailyWordGoal) * 100
        console.log(`calculated: ${dailyPercentage.toString()}, trying to match ${this.specialDailyPercentages[0]}, it is ${dailyPercentage.toString() === this.specialDailyPercentages[0]}`)
        if (this.specialDailyPercentages[0] <= dailyPercentage.toString()) {
            console.log('hit daily goal');
            cpane.triggerEvent(CutieEvent.DAILY_WC_GOAL, [this.specialDailyPercentages.shift()])
            this.eventTriggered = true;
            return;
        }

        // Calculate percentage of total goal
        const totalPercentage: number = wordCount / this.flags.totalWordGoal
        if (this.specialTotalPercentages[0] <= totalPercentage.toString()) {
            cpane.triggerEvent(CutieEvent.TOTAL_WC_GOAL, [this.specialTotalPercentages.shift()])
            this.eventTriggered = true;
            return;
        }
    }

    public triggerTimeEvent(): void {
      const time = new Date().getHours();
      if (time >= 5 && time < 11 ) {
          cpane.triggerEvent(CutieEvent.TIME_UPDATE, [TimeOfDay.MORNING])
      } else if (time >= 11 && time < 16){
          cpane.triggerEvent(CutieEvent.TIME_UPDATE, [TimeOfDay.DAY])
      } else if (time >= 16 && time < 23) {
          cpane.triggerEvent(CutieEvent.TIME_UPDATE, [TimeOfDay.EVENING])
      } else if (time >= 2 && time < 5) {
          cpane.triggerEvent(CutieEvent.TIME_UPDATE, [TimeOfDay.LATE_NIGHT])
      } else{
        cpane.triggerEvent(CutieEvent.TIME_UPDATE, [TimeOfDay.MIDNIGHT])
      }
    }
}

const monitor: Monitor = new Monitor();

ipcRenderer.on(CutieEvent.LOAD_DIALOGUE, async function(event) {
    await cpane.initialize();
})

ipcRenderer.on(CutieEvent.PANE_CHANGE, async function (event, data) {
    monitor.triggerWordCountEvent(data)
});
