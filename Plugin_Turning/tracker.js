/* global Zotero, addSeconds */

let readingTimer = null;
const CHECK_INTERVAL_SECONDS = 5;
const HEATMAP_REFRESH_MINUTES = 1;
let lastRefresh = Date.now();

function startReadingTimer() {
    readingTimer = setInterval(() => {
        const win = Services.wm.getMostRecentWindow("navigator:browser");
        if (!win) return;

        if (isZoteroForeground(win)) {
            const today = new Date().toISOString().slice(0, 10);
            addSeconds(today, CHECK_INTERVAL_SECONDS);
            Zotero.debug(`Zotero Active at ${today}`);
        }

        // 自动刷新 Heatmap
        if ((Date.now() - lastRefresh) >= HEATMAP_REFRESH_MINUTES * 60 * 1000) {
            openHeatmapWindow();
            lastRefresh = Date.now();
        }
    }, CHECK_INTERVAL_SECONDS * 1000);
}

function stopReadingTimer() {
    if (readingTimer) {
        clearInterval(readingTimer);
        readingTimer = null;
    }
}

function isZoteroForeground(win) {
    try {
        return win.document.hasFocus();
    } catch (e) {
        return false;
    }
}