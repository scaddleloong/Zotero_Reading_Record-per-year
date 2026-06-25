/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/24
bootstrap.js V1.2: structured AI paper analysis prompt

Annotation_Information_End */

// Global for settings window rootURI (shared across loadSubScript sandboxes)
var _readingTrackerRootURI = null;

// Defult Function of install
function install() {
    Zotero.debug("Reading Tracker installed");
}

// Defult Function of uninstall
function uninstall() {
    Zotero.debug("Reading Tracker uninstalled");
}

// Add Bottom function
function addMenuToWindow(win) {

    try {

        const doc = win.document;
        const menu = doc.getElementById("menu_ToolsPopup");

        if (!menu) return;

        if (doc.getElementById("readingTrackerMenu")) return;

        const item = doc.createXULElement("menuitem");

        item.id = "readingTrackerMenu";
        item.setAttribute("label", _loc("menu.label"));

        item.addEventListener("command", () => {
            openHeatmapWindow(); // function in heatmap.js for create a heatmap
        });

        menu.appendChild(item);

    } catch (e) {
        Zotero.debug("addMenuToWindow error: " + e);
    }
}

// start function
async function startup({ id, version, rootURI }) {

    Zotero.debug("Reading Tracker startup");

    // Store rootURI globally for settings window
    _readingTrackerRootURI = rootURI;

    // Load Scripts at same filefolder (locale.js must be first)
    Services.scriptloader.loadSubScript(rootURI + "locale.js");
    Services.scriptloader.loadSubScript(rootURI + "storage.js");
    Services.scriptloader.loadSubScript(rootURI + "tracker.js");
    Services.scriptloader.loadSubScript(rootURI + "heatmap.js");
    Services.scriptloader.loadSubScript(rootURI + "ai.js");
    Services.scriptloader.loadSubScript(rootURI + "config.js");

    // Iterate through all already opened windows and add a menu to each window
    try {

        for (const win of Services.wm.getEnumerator("navigator:browser")) {
            addMenuToWindow(win);
        }

        // Monitor newly opened windows and automatically add the menu upon loading
        Services.ww.registerNotification({
            observe(subject, topic) {
                if (topic === "domwindowopened") {
                    subject.addEventListener("load", () => {
                        addMenuToWindow(subject);
                    });
                }
            }
        });

    } catch (e) {
        Zotero.debug("UI init error: " + e);
    }

    // Delay for 3 seconds before initializing (to avoid conflicts when Zotero starts)
    setTimeout(async () => {
        try {
            await initStorage();
            await backfillReadingData();
            startReadingTimer();
            Zotero.debug("Reading Tracker ready");
        } catch (e) {
            Zotero.debug("init error: " + e);
        }
    }, 3000);
}

// Defult Function of shutdown
function shutdown() {
    stopReadingTimer();
}
