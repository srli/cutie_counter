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
 */
export type Trigger = {[key: string]: string}

export enum TriggerType {
    DAILY_WORD_COUNT = 'daily_word_count',
    TOTAL_WORD_COUNT = 'total_word_count',
    TIME_OF_DAY = 'time_of_day',
    EASTER_EGG = 'easter_egg',
}

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
        console.log(`SINGLE WC DIAGLOGUE ${day} info is: ${JSON.stringify(dialogue[0][day.toString()])}`);
        console.log(`SINGLE TIME DIAGLOGUE ${day} info is: ${JSON.stringify(dialogue[2][day.toString()])}`);
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
