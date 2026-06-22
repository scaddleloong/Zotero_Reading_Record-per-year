/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/22 13: 30 PM
Tracker.js V0.4: track items & time per 5 minutes (activity-based)

Annotation_Information_End */

let timer = null;
let _lastActivity = 0;
let _activeSeconds = 0;
let _listenersAttached = false;

// Attach user-activity listeners to the Zotero window
function _attachActivityListeners() {

    if (_listenersAttached) return;

    const win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win) return;

    const update = () => { _lastActivity = Date.now(); };

    win.addEventListener("mousemove", update, { capture: true });
    win.addEventListener("mousedown", update, { capture: true });
    win.addEventListener("keydown", update, { capture: true });
    win.addEventListener("scroll", update, { capture: true });

    _listenersAttached = true;
    Zotero.debug("Reading Tracker: activity listeners attached");
}

// Calculation Function of Reading Time
function startReadingTimer() {

    if (timer) return;

    _attachActivityListeners();

    // Every 10 seconds, accumulate active time
    timer = setInterval(() => {

        const win = Services.wm.getMostRecentWindow("navigator:browser");
        if (!win) return;

        if (!win.document.hasFocus()) return;

        const idleSec = (Date.now() - _lastActivity) / 1000;
        if (idleSec >= 60) return;

        // Accumulate 10 seconds of active reading
        _activeSeconds += 10;

        // Every time we accumulate a full 5-minute block (300 seconds), save it
        while (_activeSeconds >= 300) {
            _activeSeconds -= 300;

            const today = new Date().toISOString().slice(0, 10);

            addSeconds(today, 300);

            // Track which items are currently selected in Zotero
            try {
                if (win.ZoteroPane) {
                    const items = win.ZoteroPane.getSelectedItems();
                    if (items && items.length > 0) {
                        const limit = Math.min(items.length, 10);
                        for (let i = 0; i < limit; i++) {
                            addItemToDay(today, items[i].key);
                        }
                    }
                }
            } catch (e) {
                Zotero.debug("trackItem error: " + e);
            }
        }

    }, 10000); // check every 10 seconds
}

// Stop Calculation Function
function stopReadingTimer() {

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    _activeSeconds = 0;
    _listenersAttached = false;
}