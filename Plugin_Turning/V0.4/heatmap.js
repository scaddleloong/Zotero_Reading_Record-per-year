/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/22 13: 30 PM
heatmap.js V0.4: click cell to show day detail (annotations filtered by date)

Annotation_Information_End */

// Helper: safely get a field from a Zotero item
function _getField(item, field) {
    try {
        if (typeof item.getField === 'function') {
            const v = item.getField(field);
            return v != null ? String(v) : '';
        }
    } catch (e) {}
    try {
        const v = item[field];
        return v != null ? String(v) : '';
    } catch (e) {}
    return '';
}

// Generate heatmap HTML with embedded item details
function generateHeatmapHTML() {

    const rows = loadAll();
    const year = new Date().getFullYear();

    // Build reading-time map (minutes)
    const map = {};
    for (const r of rows) {
        map[r.date] = r.seconds / 60;
    }

    // Statistics
    const totalMinutes =
        rows.reduce((sum, r) => sum + r.seconds / 60, 0);

    const totalHours =
        (totalMinutes / 60).toFixed(1);

    const activeDays =
        rows.filter(r => r.seconds > 0).length;

    const avgMinutes =
        activeDays > 0
            ? (totalMinutes / activeDays).toFixed(1)
            : "0.0";

    // Fetch day details: items read and their today-annotations
    const libraryID = Zotero.Libraries.userLibraryID;
    const dayDetails = {};

    for (const r of rows) {
        if (!r.items || r.items.length === 0) continue;

        const itemDetails = [];
        for (const key of r.items) {
            try {
                const item = Zotero.Items.getByLibraryAndKey(libraryID, key);
                if (!item) continue;

                const detail = {
                    title: item.getDisplayTitle() || "(untitled)",
                    key: item.key,
                    notes: [],
                    annotations: []
                };

                // ---------- child notes created on this day ----------
                try {
                    const notes = item.getNotes();
                    if (notes && notes.length > 0) {
                        for (const noteRef of notes) {
                            const noteItem = Zotero.Items.get(noteRef.id);
                            if (!noteItem) continue;
                            const added = _getField(noteItem, 'dateAdded');
                            if (!added.startsWith(r.date)) continue;
                            const text = noteItem.getNote()
                                .replace(/<[^>]+>/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                            if (text) {
                                detail.notes.push(
                                    text.length > 300
                                        ? text.slice(0, 300) + '...'
                                        : text
                                );
                            }
                        }
                    }
                } catch (e) {
                    Zotero.debug("Heatmap: notes error " + e);
                }

                // ---------- PDF annotations from child attachments ----------
                try {
                    const attachmentIDs = typeof item.getAttachments === 'function'
                        ? item.getAttachments() : [];

                    for (const attID of attachmentIDs) {
                        const att = Zotero.Items.get(attID);
                        if (!att) continue;

                        let annItems = [];

                        // Method 1: getAnnotations() on the attachment item (Zotero 9 API)
                        if (typeof att.getAnnotations === 'function') {
                            try {
                                annItems = att.getAnnotations() || [];
                            } catch (e2) {
                                Zotero.debug("getAnnotations error: " + e2);
                            }
                        }

                        // Method 2: Zotero.Items.getAnnotations() static method
                        if (annItems.length === 0 && typeof Zotero.Items.getAnnotations === 'function') {
                            try {
                                annItems = Zotero.Items.getAnnotations(att.id) || [];
                            } catch (e2) {
                                Zotero.debug("Items.getAnnotations error: " + e2);
                            }
                        }

                        for (const ann of annItems) {
                            // Handle dateAdded - Zotero format is "2026-06-22 HH:MM:SS"
                            let dateStr = '';
                            try { dateStr = String(ann.getField('dateAdded') || ann.dateAdded || ''); } catch (e2) {}
                            if (!dateStr.startsWith(r.date) && !dateStr.includes(r.date)) continue;

                            let type = '';
                            let text = '';
                            let comment = '';

                            try { type = String(ann.getField('annotationType') || ann.annotationType || ''); } catch (e2) {}
                            try { text = String(ann.getField('annotationText') || ann.annotationText || ''); } catch (e2) {}
                            try { comment = String(ann.getField('annotationComment') || ann.annotationComment || ''); } catch (e2) {}

                            if (text.trim() || comment.trim()) {
                                detail.annotations.push({ type, text: text.trim(), comment: comment.trim() });
                            }
                        }
                    }

                    Zotero.debug("Heatmap: item '" + item.getDisplayTitle() + "' atts:" + attachmentIDs.length + " anns:" + detail.annotations.length);
                } catch (e) {
                    Zotero.debug("Heatmap: annotations error " + e);
                }

                itemDetails.push(detail);
            } catch (e) {
                Zotero.debug("Heatmap: item error " + key + " " + e);
            }
        }

        if (itemDetails.length > 0) {
            dayDetails[r.date] = itemDetails;
        }
    }

    // Build heatmap cells
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const anchor = new Date(startDate);
    anchor.setDate(
        anchor.getDate() -
        ((anchor.getDay() + 6) % 7)
    );

    const cells = [];
    let cur = new Date(anchor);

    while (cur <= endDate) {

        const iso =
            cur.getFullYear() +
            "-" +
            String(cur.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(cur.getDate()).padStart(2, "0");

        const minutes = map[iso] || 0;

        let level = 0;

        if (minutes > 15) level = 1;
        if (minutes >= 30) level = 2;
        if (minutes >= 60) level = 3;
        if (minutes >= 120) level = 4;

        cells.push(
            `<div class="cell level-${level}" data-date="${iso}" title="${iso} | ${minutes.toFixed(1)} min"></div>`
        );

        cur.setDate(cur.getDate() + 1);
    }

    // Serialise embedded data (escape </script> sequences)
    const dayDetailsJSON =
        JSON.stringify(dayDetails).replace(/<\/script>/gi, '<\\/script>');
    const mapJSON =
        JSON.stringify(map).replace(/<\/script>/gi, '<\\/script>');

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Reading Heatmap</title>
<style>

html, body {
    background: white;
}
body {
    font-family: Arial, sans-serif;
    margin: 20px;
    color: #24292f;
}
h2 {
    margin-bottom: 10px;
}
.stats {
    margin-bottom: 20px;
    font-size: 14px;
}
.stats div {
    margin-top: 4px;
}

/* -------- heatmap -------- */
.heatmap-wrapper {
    display: flex;
    align-items: flex-start;
}
.weekday-labels {
    display: grid;
    grid-template-rows: repeat(7, 16px);
    gap: 4px;
    margin-right: 10px;
    font-size: 11px;
    color: #666;
    width: 30px;
}
#heatmap {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(7, 16px);
    grid-auto-columns: 16px;
    gap: 4px;
    width: max-content;
}
.cell {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: #ebedf0;
    cursor: pointer;
    transition: outline 0.1s;
}
.cell:hover {
    outline: 2px solid #0969da;
    outline-offset: -1px;
}
.level-0 { background: #ebedf0; }
.level-1 { background: #9be9a8; }
.level-2 { background: #40c463; }
.level-3 { background: #30a14e; }
.level-4 { background: #216e39; }

#months {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    width: 1060px;
    margin-top: 10px;
    margin-left: 40px;
    font-size: 11px;
    color: #666;
}
.legend {
    margin-top: 20px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
}
.legend-box {
    width: 16px;
    height: 16px;
    border-radius: 3px;
}

/* -------- detail panel -------- */
#detail-panel {
    display: none;
    margin-top: 28px;
    border-top: 2px solid #e1e4e8;
    padding-top: 16px;
}
#detail-panel.open {
    display: block;
}
#detail-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 12px;
}
#detail-header h3 {
    margin: 0;
    font-size: 16px;
}
#detail-time {
    font-size: 13px;
    color: #586069;
}
#detail-close {
    margin-left: auto;
    background: none;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 14px;
    color: #57606a;
}
#detail-close:hover {
    background: #f6f8fa;
}
#detail-content {
    max-height: 420px;
    overflow-y: auto;
}
.no-data {
    color: #8b949e;
    font-size: 14px;
}

/* item card */
.detail-item {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f0f0f0;
}
.detail-item:last-child {
    border-bottom: none;
}
.detail-item h4 {
    margin: 0 0 4px 0;
    font-size: 14px;
    color: #0969da;
    cursor: pointer;
}
.detail-item h4:hover {
    text-decoration: underline;
}
.section-label {
    display: inline-block;
    font-size: 11px;
    color: #586069;
    margin-left: 16px;
    margin-bottom: 2px;
    margin-top: 6px;
}

/* child note styling */
.detail-note {
    margin: 3px 0 3px 16px;
    font-size: 13px;
    color: #24292f;
    line-height: 1.5;
    padding: 4px 8px;
    background: #f6f8fa;
    border-radius: 4px;
    border-left: 3px solid #d0d7de;
}

/* annotation card */
.annotation-item {
    margin: 4px 0 4px 16px;
    padding: 6px 10px;
    background: #fefbf3;
    border-radius: 4px;
    border-left: 3px solid #ffd33d;
}
.ann-highlight-text {
    font-size: 13px;
    color: #24292f;
    font-style: italic;
    line-height: 1.5;
}
.ann-comment {
    font-size: 13px;
    color: #24292f;
    line-height: 1.5;
    margin-top: 3px;
    padding-top: 3px;
    border-top: 1px dashed #eee;
}
.ann-type-badge {
    display: inline-block;
    font-size: 10px;
    padding: 0 4px;
    border-radius: 3px;
    margin-bottom: 2px;
}
</style>
</head>
<body>

<div class="stats">
    <h2>Reading Statistics (${year})</h2>
    <div>Total Reading Time: ${totalHours} h</div>
    <div>Active Days: ${activeDays}</div>
    <div>Average: ${avgMinutes} min/day</div>
</div>

<div class="heatmap-wrapper">
    <div class="weekday-labels">
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
        <div>Sun</div>
    </div>
    <div id="heatmap">
        ${cells.join("")}
    </div>
</div>

<div id="months">
    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
    <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
</div>

<div class="legend">
    <span>Less</span>
    <div class="legend-box level-0"></div>
    <div class="legend-box level-1"></div>
    <div class="legend-box level-2"></div>
    <div class="legend-box level-3"></div>
    <div class="legend-box level-4"></div>
    <span>More</span>
</div>

<p style="margin-top:15px;font-size:12px;color:#666;">
Hover over a square to view reading time. Click for daily details.
</p>

<!-- Detail Panel -->
<div id="detail-panel">
    <div id="detail-header">
        <h3>📖 Reading Detail — <span id="detail-date"></span></h3>
        <span id="detail-time"></span>
        <button id="detail-close">✕</button>
    </div>
    <div id="detail-content"></div>
</div>

<script>
const DAY_DETAILS = ${dayDetailsJSON};
const DAY_MAP = ${mapJSON};
const LIBRARY_ID = ${libraryID};

// Click cells to show daily detail
document.querySelectorAll('.cell').forEach(function(cell) {
    cell.addEventListener('click', function() {
        showDetail(this.dataset.date);
    });
});

document.getElementById('detail-close').addEventListener('click', closeDetail);

function showDetail(date) {
    var items = DAY_DETAILS[date] || [];
    var minutes = DAY_MAP[date] || 0;

    document.getElementById('detail-date').textContent = date;
    document.getElementById('detail-time').textContent = minutes.toFixed(1) + ' min';

    var content = document.getElementById('detail-content');

    if (items.length === 0) {
        content.innerHTML = '<p class="no-data">No records for this day.</p>';
    } else {
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            html += '<div class="detail-item">';
            html += '<h4 data-key="' + escapeAttr(item.key) + '">📄 ' + escapeHtml(item.title) + '</h4>';

            // child notes
            if (item.notes && item.notes.length > 0) {
                html += '<div class="section-label">📝 Notes</div>';
                for (var j = 0; j < item.notes.length; j++) {
                    html += '<div class="detail-note">' + escapeHtml(item.notes[j]) + '</div>';
                }
            }

            // PDF annotations
            if (item.annotations && item.annotations.length > 0) {
                html += '<div class="section-label">🔖 PDF Annotations</div>';
                for (var j = 0; j < item.annotations.length; j++) {
                    var ann = item.annotations[j];
                    html += '<div class="annotation-item">';

                    if (ann.type === 'highlight') {
                        if (ann.text) {
                            html += '<div class="ann-highlight-text">🔦 "' + escapeHtml(ann.text) + '"</div>';
                        }
                        if (ann.comment) {
                            html += '<div class="ann-comment">💬 ' + escapeHtml(ann.comment) + '</div>';
                        }
                    } else if (ann.type === 'note') {
                        html += '<div class="ann-comment">📌 Sticky Note: ' + escapeHtml(ann.comment) + '</div>';
                    } else {
                        if (ann.text) {
                            html += '<div class="ann-highlight-text">' + escapeHtml(ann.type || 'mark') + ': "' + escapeHtml(ann.text) + '"</div>';
                        }
                        if (ann.comment) {
                            html += '<div class="ann-comment">💬 ' + escapeHtml(ann.comment) + '</div>';
                        }
                    }

                    html += '</div>';
                }
            }

            // no activity on this item
            if ((!item.notes || item.notes.length === 0) && (!item.annotations || item.annotations.length === 0)) {
                html += '<div style="margin-left:16px;font-size:12px;color:#8b949e;">Opened / read (no new marks today)</div>';
            }

            html += '</div>';
        }
        content.innerHTML = html;

        // Attach click handlers to item titles
        var titles = content.querySelectorAll('h4[data-key]');
        for (var k = 0; k < titles.length; k++) {
            (function(el) {
                el.addEventListener('click', function() {
                    openItemInZotero(el.getAttribute('data-key'));
                });
            })(titles[k]);
        }
    }

    document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
    document.getElementById('detail-panel').classList.remove('open');
}

function openItemInZotero(key) {
    try {
        var mainWin = Services.wm.getMostRecentWindow("navigator:browser");
        if (mainWin && mainWin.Zotero && mainWin.Zotero.Items) {
            var item = mainWin.Zotero.Items.getByLibraryAndKey(LIBRARY_ID, key);
            if (item && mainWin.ZoteroPane) {
                mainWin.ZoteroPane.selectItem(item.getItemID());
                mainWin.focus();
            }
        }
    } catch (e) {
        // silently fail outside Zotero
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(text) {
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
<\/script>

</body>
</html>`;
}

// Open heatmap window
function openHeatmapWindow() {

    const html = generateHeatmapHTML();

    const win = Services.ww.openWindow(
        null,
        "about:blank",
        "_blank",
        "chrome,resizable,scrollbars,width=1200,height=800,left=100,top=100",
        null
    );

    win.addEventListener("load", function() {

        win.resizeTo(1200, 500);
        win.moveTo(100, 200);

        win.document.open();
        win.document.write(html);
        win.document.close();
    });
}
