/* tracker.js */

let timer = null;

function startReadingTimer() {

    if (timer) return;

    timer = setInterval(() => {

        const win = Services.wm.getMostRecentWindow("navigator:browser");
        if (!win) return;

        if (!win.document.hasFocus()) return;

        const today = new Date().toISOString().slice(0, 10);

        addSeconds(today, 5);

    }, 5000);
}

function stopReadingTimer() {

    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}