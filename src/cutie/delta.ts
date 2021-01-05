import {BackgroundState, CutieExpression, CutieName, importAll, TimeOfDay} from '../constants'
import testDialog from '../static/cutie_dialogue/ryder/time_daily.json'
console.log(JSON.stringify(testDialog))

/**
 * This interface encapsulates a change to the UI in the cutie pane.
 * If an element is set to null, that associated element will not be changed
 */
export interface Delta {
    readonly character: CutieName | null;
    readonly expression: CutieExpression | null;
    readonly background: BackgroundState | null;
    readonly text: string | null;
}

/**
 * Custom type definition representing the correlation between trigger key and the delta
 *
 * TODO: This may need to be revised based on the dialogue tree structure
 */
export type Trigger = {[key: string]: Delta}

export enum TriggerType {
    DAILY_WORD_COUNT = 'daily_word_count',
    TOTAL_WORD_COUNT = 'total_word_count',
    TIME_OF_DAY = 'time_of_day',
    EASTER_EGG = 'easter_egg',
}

// ------ NOTE: This is an example implementation of a sequence of deltas
// ------       For more complex behaviors, some sort of class that generates a tree of these is probably necessary
const holmes1: Delta = {
  character: null,
  expression: CutieExpression.NEUTRAL,
  background: BackgroundState.ROOM_DAY,
  text: 'Let\'s begin, shall we?'
} as Delta

const ryder1: Delta = {
  character: null,
  expression: CutieExpression.NEUTRAL,
  background: BackgroundState.ROOM_DAY,
  text: 'Let\'s begin, shall we?'
} as Delta

const holmes2: Delta = {
  character: null,
  expression: CutieExpression.HAPPY,
  background: BackgroundState.ROOM_DAY,
  text: 'A good start, impressive.'
} as Delta

const holmes3: Delta = {
  character: null,
  expression: CutieExpression.CURIOUS,
  background: BackgroundState.ROOM_NIGHT,
  text: 'Your work ethic is admirable.'
} as Delta

const holmesMorning: Delta = {
  character: null,
  expression: CutieExpression.HAPPY,
  background: BackgroundState.ROOM_DAY,
  text: 'Good morning. And so begins the first day of the month in which you\'ll complete your story. Feeling excited?'
} as Delta

const holmesDay: Delta = {
  character: null,
  expression: CutieExpression.HAPPY,
  background: BackgroundState.ROOM_DAY,
  text: 'Did you get lunch yet?'
} as Delta

const holmesEvening: Delta = {
  character: null,
  expression: CutieExpression.NEUTRAL,
  background: BackgroundState.ROOM_NIGHT,
  text: 'Evening. It\'s been a long day, hasn\'t it? It\'s good to relax.'
} as Delta

const holmesMidnight: Delta = {
  character: null,
  expression: CutieExpression.CURIOUS,
  background: BackgroundState.ROOM_NIGHT,
  text: 'It\'s pretty late. If you want to write now, you can, but I\'d otherwise recommend getting some sleep. There\'s a whole month ahead of us.'
} as Delta

const holmesLatenight: Delta = {
  character: null,
  expression: CutieExpression.CURIOUS,
  background: BackgroundState.ROOM_NIGHT,
  text: '... Agh! Could you give a bit of warning before you pop up like a serial killer in a movie? I didn\'t know you\'d be awake now... Ahem. '
} as Delta

const sampleDailyWC: Trigger = { '0.10': holmes1, 0.25: holmes3, 0.33: holmes2, 0.75: holmes3 }
const sampleTotalWC: Trigger = { '0.10': holmes1, 0.25: holmes2 }
const sampleTime: Trigger = { morning: holmesMorning, day: holmesDay, evening: holmesEvening, midnight: holmesMidnight, late_night: holmesLatenight } // TODO: this should prob be an enum
const sampleSpecial: Trigger = { keymash: holmes3 }

/**
 * A trigger collection houses all dialogue for a character for one day.
 */
export interface TriggerCollection {
    readonly dailyWC: Trigger;
    readonly totalWC: Trigger;
    readonly time: Trigger;
    readonly special: Trigger;
}

/**
 * This helper function conditionally loads the required json files based on the desired cutie
 * This function is only run once per launch of the app
 *
 * @param name: the cutie to load
 */
async function loadDialogueFile (name: CutieName): Promise<any[]> {
    console.log("importing ", name);
    const dailyWC = await import(`../static/cutie_dialogue/${name}/wc_daily.json`);
    const overallWC = await import(`../static/cutie_dialogue/${name}/wc_overall.json`);
    const dailyTime = await import(`../static/cutie_dialogue/${name}/time_daily.json`);

    console.log("\timported DAILY");
    console.log(JSON.stringify(dailyWC));
    return [dailyWC, overallWC, dailyTime];
}

/**
 * This helper function returns a trigger collection based on input parameters
 *
 * @param name: the cutie to load
 * @param day: the day of dialogue to load
 */
export async function getTriggerCollection (name: CutieName, day: number): Promise<TriggerCollection> {
    const dialogue = await loadDialogueFile(name);
    // loadDialogueFile(name).then(
    //     value => {
    //         dialogue = value
    //         console.log(`DAY 1, MORNING TEXT: ${JSON.stringify(["morning"])}`)
    //     }
    // );

    if (dialogue) {
        console.log(`GOT DAILYWC ${JSON.stringify(dialogue[0])}`);
        console.log(`SINGLE DAY ${day} info is: ${JSON.stringify(dialogue[0][day.toString()])}`);
        const dayStr = day.toString();
        return {
            dailyWC:dialogue[0][dayStr],
            totalWC: dialogue[1][dayStr],
            time: dialogue[2][dayStr],
            special: dialogue[2][dayStr] // TODO: Implement special dialogue
        } as TriggerCollection
    } else {
        throw SyntaxError(`${name} does not have dialogue associated with it.`)
    }
}
