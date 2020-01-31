export enum CutieName {
    RYDER = 'ryder',
    HOLMES = 'holmes',
}

export enum CutieExpression {
    NEUTRAL = 'neutral',
    HAPPY = 'happy',
    CURIOUS = 'curious'
}

export enum BackgroundState {
    ROOM_DAYTIME = 'room_daytime'
}

/**
 * This master class encompasses all the cutie related actions
 */
class CutiePane {
    private container: HTMLElement;

    private readonly cutieBgId: string = 'cutieBg';
    private readonly cutieImgId: string = 'cutieImage';

    constructor(readonly containerId: string, readonly cutieName: CutieName) {
        this.container = document.querySelector(containerId);
        this.initializePane();
    };

    public initializePane() {
        // TODO: Figure out how to overlay background and actual image
        const bg: HTMLImageElement = new Image();
        bg.id = this.cutieBgId;
        bg.src = `assets/backgrounds/${BackgroundState.ROOM_DAYTIME}.png`;
        bg.style.cssText = 'position: absolute; height: 100%; width: 100%; object-fit: cover; z-index: 1';
        this.container.appendChild(bg);

        const cutieImage: HTMLImageElement = new Image();
        cutieImage.id = this.cutieImgId;
        cutieImage.src = `assets/${this.cutieName}/neutral.png`;
        cutieImage.style.cssText = 'position: absolute; margin-top: 50px; margin-bottom: 0; height: 100%; width: 100%; object-fit: cover; z-index:5';
        this.container.appendChild(cutieImage);
    }

    public changeExpression(expression: CutieExpression) {
        const img:HTMLImageElement = document.querySelector(`#${this.cutieImgId}`);
        img.src = `assets/${this.cutieName}/${expression}.png`;
    }
}

const pane: CutiePane = new CutiePane("#cutie", CutieName.HOLMES);
