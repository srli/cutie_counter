import { BackgroundState, CutieEvents, CutieExpression, CutieName } from "./constants";
import { cutieToContent, CutieDelta, Trigger } from "./cutie_delta";

/**
 * This master class encompasses all the cutie related actions
 */
export class CutiePane {
    private container: HTMLElement;

    // Container IDs are tied to the name given in index.html, do not change
    private readonly cutieBgId: string = 'cutieBg';
    private readonly cutieImgId: string = 'cutieImage';

    private readonly eventTriggers: Trigger; // TODO: Figure out a better name for this

    constructor(readonly containerId: string, readonly nameBoxId: string, readonly textBoxId: string, readonly cutieName: CutieName) {
        this.container = document.querySelector(containerId);
        this.eventTriggers = cutieToContent[this.cutieName];
        this.initializePane();
    };

    public initializePane() {
        // Create BG image element
        const bg: HTMLImageElement = new Image();
        bg.id = this.cutieBgId;
        bg.src = `assets/backgrounds/${BackgroundState.ROOM_DAY}.png`;
        bg.style.cssText = 'position: absolute; height: 100%; width: 100%; object-fit: cover; z-index: 1';
        this.container.appendChild(bg);

        // Create cutie image element
        const cutieImage: HTMLImageElement = new Image();
        cutieImage.id = this.cutieImgId;
        cutieImage.src = `assets/${this.cutieName}/neutral.png`;
        // NOTE: The CSS positioning may change due to image positioning
        //       If the images are the same size, then this CSS should need to only be changed once
        cutieImage.style.cssText = 'position: absolute; left: -250px; margin-top: 50px; margin-bottom: 0; height: 100%; width: 100%; object-fit: cover; z-index:2';
        this.container.appendChild(cutieImage);

        // Set the name to the cutie loaded
        const nameDiv = document.querySelector(this.nameBoxId);
        nameDiv.innerHTML = this.cutieName.charAt(0).toUpperCase() + this.cutieName.slice(1);

        // Set welcome text
        const textDiv = document.querySelector(this.textBoxId);
        textDiv.innerHTML = 'Welcome, welcome.';    // TODO: Load this from eventTrigger at 'welcome'?
    }

    /**
     * Modify cutie pane based on the event
     *
     * @param event: The event that was triggered
     * @param arg: The argument passed into the event   // TODO: Determine required arguments
     */
    public triggerEvent(event: CutieEvents, arg: string) {
        if (event === CutieEvents.WORD_COUNT_UPDATE) {
            if (this.eventTriggers.hasOwnProperty(arg)) {
                const delta: CutieDelta = this.eventTriggers[arg];
                if (delta.background !== null) { this.changeBackground(delta.background); }
                if (delta.expression !== null) { this.changeExpression(delta.expression); }
                if (delta.text !== null) { this.changeText(delta.text); }
            }
        }
    }

    /**
     * Modify the text in dialogue box
     *
     * @param text: The new text to set to the box
     */
    private changeText(text: string) {
        const textDiv = document.querySelector(this.textBoxId);
        textDiv.innerHTML = text;
    }

    /**
     * Change the cutie image
     * TODO: Throw error if image cannot be found?
     *
     * @param expression: The corresponding expression to load
     */
    private changeExpression(expression: CutieExpression) {
        const img:HTMLImageElement = document.querySelector(`#${this.cutieImgId}`);
        img.src = `assets/${this.cutieName}/${expression}.png`;
    }

    /**
     * Change the background image
     * TODO: Throw error if image cannot be found?
     *
     * @param background: The background image to use
     */
    private changeBackground(background: BackgroundState) {
        const img:HTMLImageElement = document.querySelector(`#${this.cutieBgId}`);
        img.src = `assets/backgrounds/${background}.png`;
    }
}
