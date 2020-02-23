
/**
 * This class houses event flags that must persist across sections
 *
 * TODO: Load event flags from save file
 */
export class EventFlags {
    readonly totalWordGoal: number = 100;
    readonly dailyWordGoal: number = 10;
    readonly initialWordCount: number;

    constructor () {
      this.initialWordCount = 0
    }
}
