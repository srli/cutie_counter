import { BackgroundState, CutieExpression, HtmlElementId, importAll } from '../constants'
import fs from 'fs'

const images = importAll(require.context('../static', true, /\.(png|jpe?g|svg)$/));

/**
 * This class houses interfacing with the GUI components on the cutie pane
 */
export class CutieGui {
  private directory = "../";

  constructor (readonly cutieName: string) {
    const img: HTMLImageElement = document.querySelector('#textboxImage');
    img.src = images[`./ui/textbox.png`];

    fs.readdirSync(this.directory).forEach(file => {
      console.log(file);
    });
  }

  /**
     * Modify the text in dialogue box
     *
     * @param text: The new text to set to the box
     * @param name: name of the person speaking
     */
  public changeText (name: string | null, text: string) {
    if (name !== null) {
      // Set the name to the speaking character
      const nameDiv = document.querySelector(HtmlElementId.NAME_BOX);
      nameDiv.innerHTML = name.charAt(0).toUpperCase() + name.slice(1)
    }

    // Modify the text
    const textDiv = document.querySelector(HtmlElementId.TEXT_BOX);
    textDiv.innerHTML = text
  }

  /**
     * Change the cutie image
     * TODO: Throw error if image cannot be found?
     *
     * @param expression: The corresponding expression to load
     */
  public changeExpression (expression: CutieExpression) {
    console.log(images);
    console.log(`./cutie_images/${this.cutieName}/${expression}.png`);
    const img: HTMLImageElement = document.querySelector(HtmlElementId.CUTIE_IMG);
    img.src = images[`./cutie_images/${this.cutieName}/${expression}.png`];
  }

  /**
     * Change the background image
     * TODO: Throw error if image cannot be found?
     *
     * @param background: The background image to use
     */
  public changeBackground (background: BackgroundState) {
    const img: HTMLImageElement = document.querySelector(HtmlElementId.BG_IMG);
    img.src = images[`./backgrounds/${background}.png`]
  }
}
