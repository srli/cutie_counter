import {BackgroundState, CutieEvent, CutieExpression, CutieName} from '../constants'
import {Delta, getTriggerCollection, TriggerCollection} from './delta'

export interface DialogueCondition {
    readonly variable: string;
    readonly operator: string;
    readonly value: string;
    readonly ifTrue: DialogueConditionBoolean | undefined;
    readonly ifFalse: DialogueConditionBoolean | undefined;
}

export interface DialogueConditionBoolean {
    readonly delta: Delta | undefined;
    readonly choice: DialogueChoiceGroup | undefined;
}

export interface DialogueChoice {
    readonly id: string;
    readonly choiceText: string;
    readonly delta: Delta;
}

export interface DialogueChoiceGroup {
    readonly choiceIds: string[];
    readonly userText: string | undefined;
    readonly choices: DialogueChoice[];
}

export interface DialogueGroup {
    readonly condition: DialogueCondition | undefined;
    readonly ifTrue: string | undefined;
    readonly ifFalse: string | undefined;
    readonly choice: DialogueChoiceGroup | undefined;
    readonly delta: Delta | undefined;
}

/**
 * This class collects all representation of dialogue.
 * It is meant to house dialogue trees, and return the right delta based on the get function
 */
export class CutieDialogue {
    private cutieTriggerCollection: TriggerCollection;

    constructor(readonly name: CutieName) {
    }

    private convertToJson(inputStr: string): any {
        try {
            return JSON.parse(inputStr)
        } catch (e) {
            return inputStr
        }
    }

    private jsonToChoices(rawStr: string): DialogueChoiceGroup {
        console.log(`Parsing ${JSON.stringify(rawStr)}`);
        const inputStr = this.convertToJson(rawStr)
        const choiceIds: string[] = inputStr.choices
        console.log(`Choices are ${JSON.stringify(inputStr.choices)}, converted to ${choiceIds}`);

        const choices: DialogueChoice[] = []
        for (const id of choiceIds) {
            const choice = inputStr.id
            if (choice == undefined) {
                console.error(`Error parsing JSON, choice ${id} does not exist in ${JSON.stringify(inputStr)}`);
            } else {
                choices.push(
                    {id,
                    choiceText: choice.choice_text,
                    delta: choice.delta} as DialogueChoice
                )
            }
        }

        return {
            choiceIds,
            userText: inputStr.user_text,
            choices
        } as DialogueChoiceGroup
    }

    private jsonToCondition(rawInput: string): DialogueCondition {
        const inputStr = this.convertToJson(rawInput);

        // Process ifTrue
        let ifTrue;
        if (inputStr.if_true != undefined) {
            ifTrue = {
                delta: inputStr.if_true.delta,
                choice: this.jsonToChoices(inputStr.if_true.choice)
            } as DialogueConditionBoolean;
        }

        // Process ifFalse
        let ifFalse;
        if (inputStr.if_true != undefined) {
            ifFalse = {
                delta: inputStr.if_false.delta,
                choice: this.jsonToChoices(inputStr.if_false.choice)
            } as DialogueConditionBoolean;
        }

        return {
            variable: inputStr.variable,
            operator: inputStr.operator,
            value: inputStr.value,
            ifTrue,
            ifFalse
        } as DialogueCondition
    }

    // Dialogue is executed in this order:
    // Delta displayed first
    // Condition is evaluated, if_true/if_false dialogue is displayed
    //      TODO: Implement recursive parsing of condition variable
    //      Condition text is nested, and will be evaluated recursively ie: delta -> condition -> choice
    // Choice text is evaluated
    private jsonToDialogueGroup(jsonStr: string): DialogueGroup {
        try {
            console.log(`ATTEMPTING TO PARSE JSON: ${JSON.stringify(jsonStr)}`)
        } catch {
            console.log(`ATTEMPTING TO PARSE STRING: ${jsonStr}`)
        }

        let condition = undefined;
        let choice = undefined;
        let delta = undefined;

        if (jsonStr != undefined) {
            const asJson = this.convertToJson(jsonStr);

            if (asJson.delta != undefined) {
                delta = asJson.delta
            }

            if (asJson.condition != undefined) {
                condition = this.jsonToCondition(asJson.condition)
            }

            if (asJson.choice != undefined) {
                choice = this.jsonToChoices(asJson.choice)
            }
        }

        return {
            delta,
            choice,
            condition
        } as DialogueGroup
    }

    public async initialize(): Promise<void> {
        this.cutieTriggerCollection = await getTriggerCollection(this.name, 1)
    }

    /**
     * Get the delta based on the event and arguments
     *
     * @param event: The event that triggered this delta
     * @param args: A list of arguments passed in with this event
     */
    public getDialogue(event: CutieEvent, args: string[]): DialogueGroup {
        console.warn(`Trying to get ${event}, ${args[0]}`)
        let strDialogue: string
        if (event === CutieEvent.DAILY_WC_GOAL) {
            strDialogue = this.cutieTriggerCollection.dailyWC[args[0]]
        } else if (event === CutieEvent.TOTAL_WC_GOAL) {
            strDialogue = this.cutieTriggerCollection.totalWC[args[0]]
        } else if (event === CutieEvent.NEXT_DIALOGUE) {
            // do something to continue?
        } else if (event === CutieEvent.TIME_UPDATE) {
            strDialogue = this.cutieTriggerCollection.time[args[0]]
        } else {
            console.warn(`An unsupported event: ${event} was passed to the dialogue engine.`)
            strDialogue = undefined;
        }

        return this.jsonToDialogueGroup(strDialogue)
    }
}
