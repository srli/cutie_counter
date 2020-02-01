import {CutieEvent, CutieName} from "../constants";
import {Delta, getTriggerCollection, TriggerCollection} from "./delta";

/**
 * This class collects all representation of dialogue.
 * It is meant to house dialogue trees, and return the right delta based on the get function
 */
export class CutieDialogue {
    private readonly cutieTriggerCollection: TriggerCollection;

    constructor(readonly name: CutieName) {
        this.cutieTriggerCollection = getTriggerCollection(name, 0);
    }

    /**
     * Get the delta based on the event and arguments
     *
     * @param event: The event that triggered this delta
     * @param args: A list of arguments passed in with this event
     */
    public getDelta(event: CutieEvent, args: string[]): Delta {
        console.warn(`Trying to get ${event}, ${args[0]}`);
        if (event === CutieEvent.DAILY_WC_GOAL) {
            return this.cutieTriggerCollection.dailyWC[args[0]];
        } else if (event === CutieEvent.TOTAL_WC_GOAL) {
            return this.cutieTriggerCollection.totalWC[args[0]]
        } else if (event === CutieEvent.NEXT_DIALOGUE) {
            // do something to continue?
        } else if (event === CutieEvent.TIME_UPDATE) {
            return this.cutieTriggerCollection.time['morning'];
        } else {
            console.warn(`An unsupported event: ${event} was passed to the dialogue engine.`);

            // Returning a delta of all nulls will change nothing on the GUI
            return {
                character: null,
                background: null,
                text: null,
                expression: null,
            } as Delta;
        }
    }
}
