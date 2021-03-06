// The enums and functions in this file represent constants used throughout the package
import RequireContext = __WebpackModuleApi.RequireContext;
import isDev from "electron-is-dev";
import * as path from "path";

/**
 * Currently available cuties
 */
export enum CutieName {
    RYDER = 'ryder',
    EMBER = 'ember'
}

/**
 * TODO: THIS IS PRETTY SHITTY, FIX
 */
export enum CutieIntroduction {
    RYDER = 'Ryder is a dedicated freelance writer. He spends his days working from home, ' +
        'and loves having someone to bounce some of his stranger thoughts off of.' +
        ' His down to earth style of encouragement is well suited to writers looking for someone to rely on.',
    EMBER = 'Ember is a bright, young aspiring novelist. She works at the local library during the afternoons, ' +
        'although she often slacks off by reading the works she is supposed to be organizing. ' +
        'She enjoys searching for inspiration for her own novel in the writing of those she admires. ' +
        'Her dream is to live in a huge library with the one she loves most. ' +
        'Her bright and cheery encouragement is well suited to writers who need a good friend.',
}

// Container IDs are tied to the name given in index.html, do not change
export enum HtmlElementId {
    NAME_BOX= '#cutieName',
    TEXT_BOX= '#cutieDialogue',
    BG_IMG= '#cutieBg',
    CUTIE_IMG = '#cutieImage',
    PANE_ID = '#cutie',
}

/**
 * Supported expressions
 */
export enum CutieExpression {
    NEUTRAL = 'neutral',
    HAPPY = 'happy',
    CURIOUS = 'curious'
}

/**
 * Supported background images
 */
export enum BackgroundState {
    ROOM_DAY = 'room_day',
    ROOM_NIGHT = 'room_night'
}

/**
 * Events that are triggered across the application
 *
 * TODO: Decide on what actually needs to be an event
 */
export enum CutieEvent {
    INITIALIZE = 'initialize',
    LOAD_DIALOGUE = 'load_dialogue',
    WORD_COUNT_UPDATE = 'word_count',
    DAILY_WC_GOAL = 'daily_wc_goal',
    TOTAL_WC_GOAL = 'total_wc_goal',
    NEXT_DIALOGUE = 'next_dialogue',
    CG_TRIGGER = 'cg_trigger',
    TIME_UPDATE = 'time_update',
    PANE_CHANGE = 'pane_change',
}

/**
* Times of day
*/
export enum TimeOfDay {
  MORNING = 'morning',
  DAY = 'day',
  EVENING = 'evening',
  MIDNIGHT = 'midnight',
  LATE_NIGHT = 'late_night',
}

/**
 * Custom event codes
 */
export enum CutieEventCode {
    SUCCESSFUL,
    ERROR,
}

export function importAll(r: RequireContext): {[key: string]: string} {
    const keyDict: {[key: string]: string} = {};
    for (const k of r.keys()) {
        if (isDev) {
            keyDict[k] = r(k)['default'];
            console.log(`IN DEV: ${keyDict[k]}`);
        } else {
            // keyDict[k] = path.join('resources/app/.webpack/renderer', r(k)['default']);
            keyDict[k] = r(k)['default'];
            console.log(`IN PROD: ${keyDict[k]}`);
        }
    }

    return keyDict;
}
