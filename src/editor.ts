import Quill from 'quill';
import * as fs from 'fs';
const dialog = require('electron').remote.require('electron').dialog;

export class QuillPane {
    private readonly editor: Quill;
    private loadedfs: string | null = null;

    constructor() {
        this.editor = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    ['image', 'code-block']
                ]
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
