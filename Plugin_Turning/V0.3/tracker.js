/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/09 09: 21 AM
Tracker.js V0.3: update Note per 5 minutes

Annotation_Information_End */

let timer = null;

// Calculation Function of Reading Time 
function startReadingTimer() {

    if (timer) return;

    timer = setInterval(() => {

        const win = Services.wm.getMostRecentWindow("navigator:browser");
        if (!win) return;

        if (!win.document.hasFocus()) return;

        const today = new Date().toISOString().slice(0, 10);

        addSeconds(today, 300); // addSeconds is a function in storage.js for save DATA.

    }, 300000); // 300000ms == 300s, which could run only when you reading continue more than 300s
}

// Stop Calculation Function
function stopReadingTimer() {

    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}