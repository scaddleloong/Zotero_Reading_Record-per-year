/* bootstrap.js - Zotero V2 stable */

function install() {
    Zotero.debug("Reading Tracker V2 installed");
}

function uninstall() {
    Zotero.debug("Reading Tracker V2 uninstalled");
}

function startup({ id, version, rootURI }, reason) {

    Zotero.debug("Reading Tracker V1.2 startup");

    try {
        Services.scriptloader.loadSubScript(rootURI + "storage.js");
        Services.scriptloader.loadSubScript(rootURI + "tracker.js");
        Services.scriptloader.loadSubScript(rootURI + "heatmap.js");

        Zotero.debug("scripts loaded");

        // ⭐⭐⭐关键修复：先初始化 storage
        initStorage();

        const windowMediator = Services.wm;

        for (const win of windowMediator.getEnumerator("navigator:browser")) {
            addMenuToWindow(win, rootURI);
        }

        Services.ww.registerNotification({
            observe(subject, topic) {
                if (topic === "domwindowopened") {
                    subject.addEventListener("load", function () {
                        addMenuToWindow(subject, rootURI);
                    });
                }
            }
        });

        startReadingTimer();

    } catch (e) {
        Zotero.debug("STARTUP ERROR: " + e);
    }
}

function shutdown({ id, version, rootURI }, reason) {
    stopReadingTimer();
    Zotero.debug("Reading Tracker V2 stopped");
}

function addMenuToWindow(win, rootURI) {
    try {
        const doc = win.document;
        const toolsMenu = doc.getElementById("menu_ToolsPopup");
        if (!toolsMenu) return;

        if (doc.getElementById("readingTrackerMenu")) return;

        const menuitem = doc.createXULElement("menuitem");
        menuitem.setAttribute("id", "readingTrackerMenu");
        menuitem.setAttribute("label", "Open Heatmap");
        menuitem.addEventListener("command", () => {
            openHeatmapWindow();
        });

        toolsMenu.appendChild(menuitem);
    } catch (e) {
        Zotero.debug("Failed to add menu: " + e);
    }
}