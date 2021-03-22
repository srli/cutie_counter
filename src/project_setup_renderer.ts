import './css/common.css';
import './css/setup.css';
import {importAll, CutieName, CutieIntroduction} from './constants'
import isDev from "electron-is-dev";

const images = importAll(require.context('./static', true, /\.(png|jpe?g|svg)$/));

const cutieDescriptionDiv = document.querySelector('#cutie-selection-text');
function cutieSelected(name: string): void {
    switch (name) {
        case "ryder":
            cutieDescriptionDiv.innerHTML = CutieIntroduction.RYDER;
            break;
        case "ember":
            cutieDescriptionDiv.innerHTML = CutieIntroduction.EMBER;
            break;
        default:
            console.warn(`No introduction found for: ${name}`);
    }
}

const carouselDiv = document.querySelector('#cutie-selection-carousel');
const cuties = Object.values(CutieName).filter(value => typeof value === 'string') as string[]
for (const cutie of cuties) {
    const cutiePane: HTMLDivElement = document.createElement("div")
    cutiePane.className = "cutie-selection-pane";
    cutiePane.addEventListener("mouseenter", function(event) {cutieSelected(cutie)})
    const paneImg: HTMLImageElement = document.createElement("img");
    paneImg.src = images[`./cutie_images/${cutie}/select.png`];
    cutiePane.appendChild(paneImg);
    carouselDiv.appendChild(cutiePane);
    cutieSelected("ryder");
}

const startButton = document.querySelector('#confirmation-button');
startButton.addEventListener("click", function () {
    if (isDev) {
        location.assign("/app");
    } else {
        location.assign("../app/index.html");
    }
})
