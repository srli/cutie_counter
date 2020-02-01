import Quill from 'quill';
import * as fs from 'fs';
import { ipcRenderer } from "electron";
import {CutieEvent} from "./constants";

const dialog = require('electron').remote.require('electron').dialog;

// ---- Custom module that will call an input callback every word change
const Counter = function(quill: Quill, options: any) {
    this.quill = quill;
    this.options = options;
    quill.on('text-change', this.update.bind(this));
    this.update();  // Account for initial contents
};

Counter.prototype.calculate = function() {
    let text = this.quill.getText();
    if (this.options.unit === 'word') {
        text = text.trim();
        // Splitting empty text returns a non-empty array
        return text.length > 0 ? text.split(/\s+/).length : 0;
    } else {
        return text.length;
    }
};

Counter.prototype.update = function() {
    const length = this.calculate();
    this.options.callback(length);
};

Quill.register('modules/counter', Counter);

/**
 * This class handles the quill pane in its entirety
 */
export class QuillPane {
    private readonly editor: Quill;
    private loadedfs: string | null = null;

    constructor() {
        const wordCallback = (numWords: number) => {
            ipcRenderer.send(CutieEvent.WORD_COUNT_UPDATE, numWords);
        };

        this.editor = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    ['image', 'code-block']
                ],
                counter: {
                    unit: "word",
                    callback: wordCallback,
                }
            },
            placeholder: 'Jot down a thought...',
        });

    }

    public async saveFile() {
        console.warn('Save file has not been implemented');
        // if(!this.loadedfs) {
        //     await dialog.showSaveDialog([], { filters: [
        //             { name: 'txt', extensions: ['txt'] },
        //             { name: 'html', extensions: ['html'] },
        //         ]}, function(filename: string) {
        //         if(filename === undefined) return;
        //         writeToFile(this.editor, filename);
        //     });
        // }
        // else {
        //     writeToFile(this.editor, this.loadedfs);
        // }
    }

    public async loadFile() {
        console.warn('Load file has not been implemented');
        // await dialog.showOpenDialog([], { filters: [
        //         { name: 'txt', extensions: ['txt', 'html'] },
        //         { name: 'html', extensions: ['html', 'txt'] },
        //     ]}, function(filenames: string[]) {
        //     if(filenames === undefined) return;
        //     const filename = filenames[0];
        //     readFromFile(this.editor, filename);
        //     this.loadedfs = filename;
        // })
    }

    public writeToFile(filename: string) {
        const html = this.editor.getText();
        fs.writeFile(filename, html, function(err) {
            if(err) {
                return console.log(err);
            }
        });
    }

    public readFromFile(filename: string) {
        fs.readFile(filename, "utf-8", function(err, data) {
            if(err) {
                console.log(err);
            }
            this.editor.setText(data);
        });
    }
}
