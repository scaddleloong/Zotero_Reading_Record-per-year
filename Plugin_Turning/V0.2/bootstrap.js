/* bootstrap.js */

function install() {
    Zotero.debug("Reading Tracker installed");
}

function uninstall() {
    Zotero.debug("Reading Tracker uninstalled");
}

async function startup({ id, version, rootURI }) {

    Zotero.debug("Reading Tracker startup");

    Services.scriptloader.loadSubScript(rootURI + "storage.js");
    Services.scriptloader.loadSubScript(rootURI + "tracker.js");
    Services.scriptloader.loadSubScript(rootURI + "heatmap.js");

    // =========================
    // UI：必须立即执行（不能延迟）
    // =========================
    try {
        for (const win of Services.wm.getEnumerator("navigator:browser")) {
            addMenuToWindow(win);
        }

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

    // =========================
    // storage 延迟初始化（避免卡启动）
    // =========================
    setTimeout(async () => {
        try {
            await initStorage();
            startReadingTimer();
            Zotero.debug("Reading Tracker ready");
        } catch (e) {
            Zotero.debug("init error: " + e);
        }
    }, 300000);
}

function shutdown() {
    stopReadingTimer();
}

function addMenuToWindow(win) {

    try {
        const doc = win.document;
        const menu = doc.getElementById("menu_ToolsPopup");

        if (!menu) return;

        if (doc.getElementById("readingTrackerMenu")) return;

        const item = doc.createXULElement("menuitem");

        item.id = "readingTrackerMenu";
        item.setAttribute("label", "Open Heatmap");

        item.addEventListener("command", () => {
            openHeatmapWindow();
        });

        menu.appendChild(item);

    } catch (e) {
        Zotero.debug("addMenuToWindow error: " + e);
    }
}