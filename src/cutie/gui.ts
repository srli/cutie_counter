import { BackgroundState, CutieExpression, HtmlElementId, importAll } from '../constants'
import fs from 'fs'
import {EventFlags} from "../event_flags";

const images = importAll(require.context('../static', true, /\.(png|jpe?g|svg)$/));

/**
 * This class houses interfacing with the GUI components on the cutie pane
 */
export class CutieGui {
  private directory = "../";
  // private directory = "./resources/app/.webpack/renderer";
  private dailyWcText: HTMLDivElement;
  private dailyProgressBar: HTMLImageElement;

  private totalWcText: HTMLDivElement;
  private totalProgressBar: HTMLImageElement;

  private eventFlags: EventFlags;
  private progressBarWidth = 266;

  constructor (readonly cutieName: string) {
    // Load in static elements
    (document.querySelector('#textboxImage') as HTMLImageElement).src = images[`./ui/textbox.png`];

    // Progress bar elements
    (document.querySelector('#dailyCountBtn') as HTMLImageElement).src = images[`./ui/showdailycount_normal.png`];
    (document.querySelector('#dailyCountEmptyBar') as HTMLImageElement).src = images[`./ui/dailycountmeter_empty.png`];
    this.dailyWcText = document.querySelector('#dailyWordcountText');
    this.dailyProgressBar = document.querySelector('#dailyCountFullBar');
    this.dailyProgressBar.src = images[`./ui/dailycountmeter_full.png`];
    this.dailyProgressBar.width = 0;

    (document.querySelector('#totalCountBtn') as HTMLImageElement).src = images[`./ui/showtotalcount_normal.png`];
    (document.querySelector('#totalCountEmptyBar') as HTMLImageElement).src = images[`./ui/totalcountmeter_empty.png`];
    this.totalProgressBar = document.querySelector('#totalCountFullBar');
    this.totalProgressBar.src = images[`./ui/totalcountmeter_full.png`];
    this.totalProgressBar.width = 0;
    this.totalWcText = document.querySelector('#totalWordcountText');

    // TODO: Delete log line
    fs.readdirSync(this.directory).forEach(file => {
      console.log(file);
    });
  }

  /**
   * Initialize the progress bars based on event flags
   *
   * @param flags: flags to set for this gui instance
   */
  public setFlags(flags: EventFlags): void {
    this.eventFlags = flags;

    this.changeWordCount(this.eventFlags.initialWordCount);
  }

  /**
   * Change the word count displayed in progress bars
   *
   * @param count: the number to update
   */
  public changeWordCount(count: number): void {
    let dailyPercentage = ((count - this.eventFlags.initialWordCount) / this.eventFlags.dailyWordGoal);
    dailyPercentage = (dailyPercentage > 1) ? 1 : dailyPercentage;
    this.dailyProgressBar.width = Math.round(this.progressBarWidth * dailyPercentage);
    this.dailyWcText.innerHTML = `${count}/${this.eventFlags.dailyWordGoal}`;

    let totalPercentage = count / this.eventFlags.totalWordGoal;
    totalPercentage = (totalPercentage > 1) ? 1 : totalPercentage;
    this.totalProgressBar.width = Math.round(this.progressBarWidth * totalPercentage);
    this.totalWcText.innerHTML = `${count}/${this.eventFlags.totalWordGoal}`;
  }

  /**
     * Modify the text in dialogue box
     *
     * @param text: The new text to set to the box
     * @param name: name of the person speaking
     */
  public changeText (name: string | null, text: string): void {
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
  public changeExpression (expression: CutieExpression): void {
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
  public changeBackground (background: BackgroundState): void {
    const img: HTMLImageElement = document.querySelector(HtmlElementId.BG_IMG);
    img.src = images[`./backgrounds/${background}.png`]
  }
}
