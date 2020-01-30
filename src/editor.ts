import Quill from 'quill';
import * as fs from 'fs';

const editor = new Quill('#editor', {
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

// Save and Load files
const dialog = require('electron').remote.require('electron').dialog;

let loadedfs: string | null = null;

async function saveFile() {
    if(!loadedfs) {
        await dialog.showSaveDialog([], { filters: [
                { name: 'txt', extensions: ['txt'] },
                { name: 'html', extensions: ['html'] },
            ]}, function(filename: string) {
            if(filename === undefined) return;
            writeToFile(editor, filename);
        });
    }
    else {
        writeToFile(editor, loadedfs);
    }
}

async function loadFile() {
    await dialog.showOpenDialog([], { filters: [
            { name: 'txt', extensions: ['txt', 'html'] },
            { name: 'html', extensions: ['html', 'txt'] },
        ]}, function(filenames: string[]) {
        if(filenames === undefined) return;
        const filename = filenames[0];
        readFromFile(editor, filename);
        loadedfs = filename;
    })
}

function writeToFile(editor: Quill, filename: string) {
    const html = editor.getText();
    fs.writeFile(filename, html, function(err) {
        if(err) {
            return console.log(err);
        }
    });
}

function readFromFile(editor: Quill, filename: string) {
    fs.readFile(filename, "utf-8", function(err, data) {
        if(err) {
            console.log(err);
        }
        editor.setText(data);
    });
}
