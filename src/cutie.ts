/**
 * This master class encompasses all the cutie related actions
 */
class CutiePane {
    private container: HTMLElement;
    constructor(readonly containerId: string) {
        this.container = document.querySelector(containerId);
    };

    public displayImage() {
        // TODO: Figure out how to overlay background and actual image
        const bg: HTMLImageElement = new Image();
        bg.src = 'assets/mugenpaintover.png';
        bg.style.cssText = 'height: 100%; width: 100%; object-fit: contain; z-index: 1';
        this.container.appendChild(bg);

        const cutieImage: HTMLImageElement = new Image();
        cutieImage.src = 'assets/ryder_normal.png';
        cutieImage.style.cssText = 'height: 100%; width: 100%; object-fit: contain; z-index:5';
        this.container.appendChild(cutieImage);
    }
}

const ryderPane: CutiePane = new CutiePane("#cutie");
ryderPane.displayImage();
