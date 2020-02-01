import {BackgroundState, CutieExpression, HtmlElementId} from "../constants";

/**
 * This class houses interfacing with the GUI components on the cutie pane
 */
export class CutieGui {
    constructor(readonly cutieName: string) {};

    /**
     * Modify the text in dialogue box
     *
     * @param text: The new text to set to the box
     * @param name: name of the person speaking
     */
    public changeText(name: string | null, text: string) {
        if (name !== null) {
            // Set the name to the speaking character
            const nameDiv = document.querySelector(HtmlElementId.NAME_BOX);
            nameDiv.innerHTML = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Modify the text
        const textDiv = document.querySelector(HtmlElementId.TEXT_BOX);
        textDiv.innerHTML = text;
    };

    /**
     * Change the cutie image
     * TODO: Throw error if image cannot be found?
     *
     * @param expression: The corresponding expression to load
     */
    public changeExpression(expression: CutieExpression) {
        const img:HTMLImageElement = document.querySelector(HtmlElementId.CUTIE_IMG);
        img.src = `assets/${this.cutieName}/${expression}.png`;
    };

    /**
     * Change the background image
     * TODO: Throw error if image cannot be found?
     *
     * @param background: The background image to use
     */
    public changeBackground(background: BackgroundState) {
        const img:HTMLImageElement = document.querySelector(HtmlElementId.BG_IMG);
        img.src = `assets/backgrounds/${background}.png`;
    };
}
