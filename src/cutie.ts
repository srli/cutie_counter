import {CutieEvents} from "./monitor";

export interface CutieDelta {
    readonly expression: CutieExpression | null,
    readonly background: BackgroundState | null,
    readonly text: string | null,
}

export enum CutieName {
    RYDER = 'ryder',
    HOLMES = 'holmes',
}

enum CutieExpression {
    NEUTRAL = 'neutral',
    HAPPY = 'happy',
    CURIOUS = 'curious'
}

enum BackgroundState {
    ROOM_DAY = 'room_day',
    ROOM_NIGHT = 'room_night'
}

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

/**
 * This master class encompasses all the cutie related actions
 */
export class CutiePane {
    private container: HTMLElement;

    private readonly cutieBgId: string = 'cutieBg';
    private readonly cutieImgId: string = 'cutieImage';
    private readonly exampleTrigger: {[key: string]: CutieDelta;} = {'10': holmes1, '20': holmes2, '30': holmes3};

    constructor(readonly containerId: string, readonly nameBoxId: string, readonly textBoxId: string, readonly cutieName: CutieName) {
        this.container = document.querySelector(containerId);
        this.initializePane();
    };

    public initializePane() {
        const bg: HTMLImageElement = new Image();
        bg.id = this.cutieBgId;
        bg.src = `assets/backgrounds/${BackgroundState.ROOM_DAY}.png`;
        bg.style.cssText = 'position: absolute; height: 100%; width: 100%; object-fit: cover; z-index: 1';
        this.container.appendChild(bg);

        const cutieImage: HTMLImageElement = new Image();
        cutieImage.id = this.cutieImgId;
        cutieImage.src = `assets/${this.cutieName}/neutral.png`;
        // NOTE: The CSS positioning may change due to image positioning
        cutieImage.style.cssText = 'position: absolute; left: -250px; margin-top: 50px; margin-bottom: 0; height: 100%; width: 100%; object-fit: cover; z-index:2';
        this.container.appendChild(cutieImage);
    }

    public triggerEvent(event: CutieEvents, arg: string) {
        if (event === CutieEvents.WORD_COUNT) {
            if (this.exampleTrigger.hasOwnProperty(arg)) {
                const delta: CutieDelta = this.exampleTrigger[arg];
                if (delta.background !== null) {
                    this.changeBackground(delta.background);
                }

                if (delta.expression !== null) {
                    this.changeExpression(delta.expression);
                }

                if (delta.text !== null) {
                    this.changeText(delta.text);
                }
            }
        }
    }

    private changeText(text: string) {

    }

    private changeExpression(expression: CutieExpression) {
        const img:HTMLImageElement = document.querySelector(`#${this.cutieImgId}`);
        img.src = `assets/${this.cutieName}/${expression}.png`;
    }

    private changeBackground(background: BackgroundState) {
        const img:HTMLImageElement = document.querySelector(`#${this.cutieBgId}`);
        img.src = `assets/backgrounds/${background}.png`;
    }
}
