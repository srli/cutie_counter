// The enums in this file represent constants used throughout the package

// Container IDs are tied to the name given in index.html, do not change
export enum HtmlElementId {
    NAME_BOX= '#cutieName',
    TEXT_BOX= '#cutieDialogue',
    BG_IMG= '#cutieBg',
    CUTIE_IMG = '#cutieImage',
    PANE_ID = '#cutie',
}

/**
 * Currently available cuties
 */
export enum CutieName {
    RYDER = 'ryder',
    HOLMES = 'holmes',
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
    WORD_COUNT_UPDATE = 'word_count',
    DAILY_WC_GOAL = 'daily_wc_goal',
    TOTAL_WC_GOAL = 'total_wc_goal',
    NEXT_DIALOGUE = 'next_dialogue',
    CG_TRIGGER = 'cg_trigger',
    TIME_UPDATE = 'time_update',
    PANE_CHANGE = 'pane_change',
}

/**
 * Custom event codes
 */
export enum CutieEventCode {
    SUCCESSFUL ,
    ERROR,
}
