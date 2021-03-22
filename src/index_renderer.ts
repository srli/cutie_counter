import './css/common.css';
import './css/menu.css';
import fs from 'fs';
const { dialog } = require('electron').remote;
import isDev from "electron-is-dev";

async function loadProject() {
    try {
        const loadPromise = dialog.showOpenDialog({ properties: ['openFile'],   filters: [
                { name: 'Counter Project', extensions: ['cwp'] }, // cwp: counter word project
                { name: 'All Files', extensions: ['*'] }
            ] });
        const chosenFiles = await loadPromise;
        if (chosenFiles) {
            console.log(`FILES ${JSON.stringify(chosenFiles)}`);

            const filepath = chosenFiles.filePaths[0];
            fs.readFile(filepath, 'utf-8', (err, data) => {
                if(err){
                    alert("An error occurred reading the file :" + err.message);
                    return;
                }

                // TODO: Handle file content
                console.log("The file content is : " + data);
                if (isDev) {
                    location.assign("/app");
                } else {
                    location.assign("../app/index.html");
                }
            });
        }
    } catch (err) {
        console.log(`ERR ${err}`);
    }
}

async function continueProject() {
    if (isDev) {
        location.assign("/app");
    } else {
        location.assign("../app/index.html");
    }
}

async function newStory() {
    if (isDev) {
        location.assign("/setup");
    } else {
        location.assign("../setup/index.html");
    }
}

document
    .querySelector('#loadStory')
    .addEventListener('click', () => {
        loadProject();
    });

document
    .querySelector('#continueStory')
    .addEventListener('click', () => {
        continueProject();
    });

document
    .querySelector('#newStory')
    .addEventListener('click', () => {
        newStory();
    });

document
    .querySelector('#devOpen')
    .addEventListener('click', () => {
        continueProject();
    });
