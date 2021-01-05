import './css/common.css';
import './css/menu.css';
import fs from 'fs';
const { dialog } = require('electron').remote;

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
            });
        }
    } catch (err) {
        console.log(`ERR ${err}`);
    }
}

document
    .querySelector('#loadStory')
    .addEventListener('click', () => {
        loadProject();
    });