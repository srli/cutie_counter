import { BackgroundState, CutieExpression, CutieName } from "./constants";

/**
 * This interface encapsulates a change to the UI in the cutie pane.
 * If an element is set to null, that associated element will not be changed
 */
export interface CutieDelta {
    readonly expression: CutieExpression | null,
    readonly background: BackgroundState | null,
    readonly text: string | null,
}

/**
 * Custom type definition representing the correlation between trigger key and the delta
 *
 * TODO: This may need to be revised based on the dialogue tree structure
 */
export type Trigger = {[key: string]: CutieDelta;}

// ------ NOTE: This is an example implementation of a sequence of deltas
// ------       For more complex behaviors, some sort of class that generates a tree of these is probably necessary
const holmes1: CutieDelta = {
    expression: CutieExpression.NEUTRAL,
    background: BackgroundState.ROOM_DAY,
    text: `Let's begin, shall we?`,
} as CutieDelta;

const holmes2: CutieDelta = {
    expression: CutieExpression.HAPPY,
    background: BackgroundState.ROOM_DAY,
    text: `A good start, impressive.`,
} as CutieDelta;

const holmes3: CutieDelta = {
    expression: CutieExpression.CURIOUS,
    background: BackgroundState.ROOM_NIGHT,
    text: `Your work ethic is admirable.`,
} as CutieDelta;

const holmes4: CutieDelta = {
    expression: CutieExpression.NEUTRAL,
    background: null,
    text: '',
} as CutieDelta;

const exampleHolmesTrigger: Trigger  = {'0': holmes1, '10': holmes2, '20': holmes3, '30': holmes4};

/**
 * This map is meant to hold all triggers and associate them to their character
 *
 * TODO: This may need to be wrapped into some class based on how dialogue implementation is done
 *       Storing all character content in a single variable is prohibitively heavy
 */
export let cutieToContent: {[key: string]: Trigger;} = {};
cutieToContent[CutieName.HOLMES] = exampleHolmesTrigger;
