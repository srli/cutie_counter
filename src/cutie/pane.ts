import { BackgroundState, CutieEvent, CutieExpression, CutieName } from '../constants'
import { Delta } from './delta'
import { CutieGui } from './gui'
import { CutieDialogue } from './dialogue'

/**
 * This master class encompasses all the cutie related actions
 */
export class CutiePane {
    private readonly gui: CutieGui;
    private readonly dialogue: CutieDialogue;

    constructor (readonly cutieName: CutieName) {
      this.gui = new CutieGui(this.cutieName);
      this.dialogue = new CutieDialogue(this.cutieName);

      this.initialize()
    }

    /**
     * Modify cutie pane based on the event
     *
     * @param event: The event that was triggered
     * @param args: The argument passed into the event, it is a list of strings   // TODO: Determine required arguments
     */
    public triggerEvent (event: CutieEvent, args: string[]) {
      const delta: Delta = this.dialogue.getDelta(event, args)

      //TODO: change background according to time?
      if (delta.background !== null) { this.gui.changeBackground(delta.background) }
      if (delta.expression !== null) { this.gui.changeExpression(delta.expression) }
      if (delta.text !== null) { this.gui.changeText(delta.character, delta.text) }
    }

    /**
     * Set the UI to some default state
     *
     * TODO: Load this from a delta?
     */
    private initialize () {
      this.gui.changeText(this.cutieName, 'Hello.')
      this.gui.changeExpression(CutieExpression.NEUTRAL)
      this.gui.changeBackground(BackgroundState.ROOM_DAY)
    }
}
