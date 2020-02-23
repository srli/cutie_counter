import { BackgroundState, CutieExpression, CutieName } from '../constants'

/**
 * This interface encapsulates a change to the UI in the cutie pane.
 * If an element is set to null, that associated element will not be changed
 */
export interface Delta {
    readonly character: CutieName | null,
    readonly expression: CutieExpression | null,
    readonly background: BackgroundState | null,
    readonly text: string | null,
}

/**
 * Custom type definition representing the correlation between trigger key and the delta
 *
 * TODO: This may need to be revised based on the dialogue tree structure
 */
export type Trigger = {[key: string]: Delta;}

export enum TriggerType {
    DAILY_WORD_COUNT = 'daily_word_count',
    TOTAL_WORD_COUNT = 'total_word_count',
    TIME_OF_DAY = 'time_of_day',
    EASTER_EGG = 'easter_egg',
}

// ------ NOTE: This is an example implementation of a sequence of deltas
// ------       For more complex behaviors, some sort of class that generates a tree of these is probably necessary
const holmes1: Delta = {
  character: CutieName.HOLMES,
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

const sampleDailyWC: Trigger = { '0.10': holmes1, 0.25: holmes3, 0.33: holmes2, 0.75: holmes3 }
const sampleTotalWC: Trigger = { '0.10': holmes1, 0.25: holmes2 }
const sampleTime: Trigger = { day: holmes3 } // TODO: this should prob be an enum
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
 * This helper function returns a trigger collection based on input parameters
 *
 * @param name: the cutie to load
 * @param day: the day of dialogue to load
 */
export function getTriggerCollection (name: CutieName, day: number) {
  return {
    dailyWC: sampleDailyWC,
    totalWC: sampleTotalWC,
    time: sampleTime,
    special: sampleSpecial
  } as TriggerCollection
}
