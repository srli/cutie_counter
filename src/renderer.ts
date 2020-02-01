import { ipcRenderer } from "electron";
import { CutiePane } from "./cutie";
import { QuillPane } from "./editor";
import { CutieEvents, CutieName } from "./constants";

const cpane: CutiePane = new CutiePane("#cutie", '#cutieName','#cutieDialogue', CutieName.HOLMES);
const qpane: QuillPane = new QuillPane();

class Monitor {
    constructor(readonly totalWordGoal: number, readonly dailyWordGoal: number, readonly dailyInitialCount: number) {}

    // TODO: Actually make this trigger do something
    public triggerWordCountEvent(wordCount: number) {
        const dailyPercentage: string = ((wordCount - this.dailyInitialCount) / this.dailyWordGoal).toFixed(2);
        const totalPercentage: string = (wordCount / this.totalWordGoal).toFixed(2);

        // TODO: Actually trigger based off percentages here
        if (wordCount == 4) {
            cpane.triggerEvent(CutieEvents.WORD_COUNT_UPDATE, '10');
        } else if (wordCount == 6) {
            cpane.triggerEvent(CutieEvents.WORD_COUNT_UPDATE, '20');
        }  else if (wordCount == 2) {
            cpane.triggerEvent(CutieEvents.WORD_COUNT_UPDATE, '0');
        }
    }

}

const monitor: Monitor = new Monitor(10, 1, 0);
ipcRenderer.on(CutieEvents.PANE_CHANGE , function(event , data){
    console.log('got event');
    monitor.triggerWordCountEvent(data);
});

