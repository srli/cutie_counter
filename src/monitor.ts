// import {ipcMain} from "electron";
//
export enum CutieEvents {
    WORD_COUNT = 'word_count',
    EXPRESSION_CHANGE = 'expression_change',
    BACKGROUND_CHANGE = 'background_change',
    CG_TRIGGER = 'cg_trigger'
}

export enum CutieEventCodes {
    SUCCESSFUL ,
    ERROR,
}
//
// // ipcMain.on(CutieEvents.WORD_COUNT, (event, arg) => {
// //     event.reply('asynchronous-reply', 'pong')
// // });
//
// class Monitor {
//     constructor(readonly totalWordGoal: number, readonly dailyWordGoal: number, readonly dailyInitialCount: number) {
//     }
//
//     public triggerWordCountEvent(wordCount: number) {
//         const dailyPercentage: number = (wordCount - this.dailyInitialCount) / this.dailyWordGoal;
//         const totalPercentage: number = wordCount / this.totalWordGoal;
//
//
//     }
//
// }
//
// const monitor: Monitor = new Monitor(10, 1, 0);
// ipcMain.on(CutieEvents.WORD_COUNT, (event, arg) => {
//     console.log(arg);
//     event.returnValue =  CutieEventCodes.SUCCESSFUL
// });
