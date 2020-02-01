// The enums in this file represent constants used throughout the package

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
export enum CutieEvents {
    WORD_COUNT_UPDATE = 'word_count',
    PANE_CHANGE = 'pane_change',
    EXPRESSION_CHANGE = 'expression_change',
    BACKGROUND_CHANGE = 'background_change',
    CG_TRIGGER = 'cg_trigger'
}

/**
 * Custom event codes
 */
export enum CutieEventCodes {
    SUCCESSFUL ,
    ERROR,
}
