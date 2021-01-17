import { BackgroundState, CutieEvent, CutieExpression, CutieName } from '../constants'
import { Delta } from './delta'
import { CutieGui } from './gui'
import {CutieDialogue, DialogueGroup} from './dialogue'

/**
 * This master class encompasses all the cutie related actions
 */
export class CutiePane {
    private readonly gui: CutieGui;
    private readonly dialogue: CutieDialogue;
    private initialized: boolean;

    constructor (readonly cutieName: CutieName) {
        this.gui = new CutieGui(this.cutieName);
        this.dialogue = new CutieDialogue(this.cutieName);
        this.initialized = false;
    }

    /**
     * Modify cutie pane based on the event
     *
     * @param event: The event that was triggered
     * @param args: The argument passed into the event, it is a list of strings   // TODO: Determine required arguments
     */
    public triggerEvent (event: CutieEvent, args: string[]): void {
        if (!this.initialized) {
            console.warn('The cutie pane has not been initialized, call the initialize function.');
            return;
        }

        const dialogue: DialogueGroup = this.dialogue.getDialogue(event, args);
        const delta: Delta = dialogue.delta;

        if (delta != undefined) {
            const speaker = delta.character ? delta.character : this.cutieName;
            console.log(`BACKGROUND NULL? ${delta.background == null}; the value is ${delta.background}`);
            //TODO: change background according to time?
            if (delta.background) {
                console.warn(`TRYING TO CHANGE BG: ${delta.background}`);
                this.gui.changeBackground(delta.background);
            }
            if (delta.expression) { this.gui.changeExpression(delta.expression) }
            if (delta.text) { this.gui.changeText(speaker, delta.text) }
        }
    }

    public resetGui (): void {
        this.gui.changeText(this.cutieName, '');
        this.gui.changeExpression(CutieExpression.NEUTRAL);
        this.gui.changeBackground(BackgroundState.ROOM_DAY);
    }

    /**
     * Set the UI to some default state
     *
     * TODO: Load this from a delta?
     */
    public async initialize (): Promise<void> {
        this.gui.changeText(this.cutieName, 'Hello.');
        this.gui.changeExpression(CutieExpression.NEUTRAL);
        this.gui.changeBackground(BackgroundState.ROOM_DAY);
        await this.dialogue.initialize();
        this.initialized = true;
    }

    // public initialize (): void {
    //     this.gui.changeText(this.cutieName, 'Hello.');
    //     this.gui.changeExpression(CutieExpression.NEUTRAL);
    //     this.gui.changeBackground(BackgroundState.ROOM_DAY);
    //     // await this.dialogue.initialize();
    //     this.initialized = true;
    // }
}
