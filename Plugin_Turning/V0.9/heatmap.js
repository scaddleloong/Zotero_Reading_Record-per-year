/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/23
heatmap.js V0.9: AI article summary in detail panel

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

// Generate heatmap HTML with year selector and client-side rendering
function generateHeatmapHTML() {

    const rows = loadAll();
    const currentYear = new Date().getFullYear();

    // Build reading-time map (minutes) — ALL dates
    const map = {};
    for (const r of rows) {
        map[r.date] = r.seconds / 60;
    }

    // ------- Fetch day details for ALL dates (items + notes + annotations) -------
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

                // child notes created on this day
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

                // PDF annotations from child attachments
                try {
                    const attachmentIDs = typeof item.getAttachments === 'function'
                        ? item.getAttachments() : [];

                    for (const attID of attachmentIDs) {
                        const att = Zotero.Items.get(attID);
                        if (!att) continue;

                        let annItems = [];

                        if (typeof att.getAnnotations === 'function') {
                            try {
                                annItems = att.getAnnotations() || [];
                            } catch (e2) {
                                Zotero.debug("getAnnotations error: " + e2);
                            }
                        }

                        if (annItems.length === 0 && typeof Zotero.Items.getAnnotations === 'function') {
                            try {
                                annItems = Zotero.Items.getAnnotations(att.id) || [];
                            } catch (e2) {
                                Zotero.debug("Items.getAnnotations error: " + e2);
                            }
                        }

                        for (const ann of annItems) {
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

    // ------- Count annotations per day for trend chart -------
    const dayAnnotations = {};
    for (const [date, items] of Object.entries(dayDetails)) {
        let annCount = 0;
        for (const item of items) {
            annCount += item.annotations ? item.annotations.length : 0;
        }
        if (annCount > 0) dayAnnotations[date] = annCount;
    }

    // ------- Collect available years -------
    const yearsSet = new Set(rows.map(r => r.date.slice(0, 4)));
    yearsSet.add(String(currentYear)); // always include current year
    const years = Array.from(yearsSet).sort();
    const defaultYear = years[years.length - 1]; // most recent year

    // ------- Serialise embedded data -------
    const dayDetailsJSON =
        JSON.stringify(dayDetails).replace(/<\/script>/gi, '<\\/script>');
    const dayAnnotationsJSON =
        JSON.stringify(dayAnnotations).replace(/<\/script>/gi, '<\\/script>');
    const mapJSON =
        JSON.stringify(map).replace(/<\/script>/gi, '<\\/script>');
    const yearsJSON =
        JSON.stringify(years);
    const yearsTabsHTML =
        years.map(y =>
            `<span class="year-tab${y === defaultYear ? ' active' : ''}" data-year="${y}">${y}</span>`
        ).join('');

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

/* -------- year navigation -------- */
.year-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}
.year-tabs {
    display: flex;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    overflow: hidden;
}
.year-tab {
    padding: 3px 14px;
    font-size: 13px;
    cursor: pointer;
    color: #57606a;
    background: #fff;
    border-right: 1px solid #d0d7de;
    transition: all 0.1s;
    user-select: none;
}
.year-tab:last-child {
    border-right: none;
}
.year-tab:hover {
    background: #f0f2f4;
}
.year-tab.active {
    background: #0969da;
    color: #fff;
}
.settings-btn {
    margin-left: auto;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 18px;
    cursor: pointer;
    color: #57606a;
    line-height: 1;
    transition: all 0.1s;
}
.settings-btn:hover {
    background: #f0f2f4;
    border-color: #d0d7de;
}

/* -------- stats -------- */
.stats {
    margin-bottom: 20px;
    font-size: 14px;
}
.stats h2 {
    margin-bottom: 10px;
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
    position: relative;
    height: 16px;
    margin-bottom: 2px;
    font-size: 11px;
    color: #666;
    overflow: visible;
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

/* -------- AI summary panel -------- */
.ai-panel {
    margin: 6px 0 6px 16px;
    padding: 10px 14px;
    background: #f0f6ff;
    border-radius: 6px;
    border-left: 3px solid #0969da;
    font-size: 13px;
    line-height: 1.6;
    color: #24292f;
}
.ai-loading {
    color: #586069;
    font-style: italic;
}
.ai-body {
    white-space: pre-wrap;
}
.ai-error {
    color: #cf222e;
    background: #ffebe9;
    border: 1px solid #ffc1c0;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 12px;
}
.ai-icon {
    display: inline-block;
    width: 14px;
    font-size: 11px;
    color: #8b949e;
}
.ai-title {
    cursor: pointer;
}

/* -------- trend chart -------- */
#chart-container {
    margin-top: 24px;
    overflow-x: auto;
}
#chart-tooltip {
    position: fixed;
    display: none;
    background: rgba(0,0,0,0.8);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    z-index: 9999;
    pointer-events: none;
    white-space: nowrap;
}
</style>
</head>
<body>

<!-- Year Navigation -->
<div class="year-nav" id="year-nav">
    <div class="year-tabs" id="year-tabs">
        ${yearsTabsHTML}
    </div>
    <button class="settings-btn" id="settings-btn" title="AI Settings">&#x2699;&#xFE0F;</button>
</div>

<!-- Statistics -->
<div class="stats" id="stats">
    <h2>Reading Statistics — <span id="display-year">${defaultYear}</span></h2>
    <div>Total Reading Time: <span id="stat-total">0</span> h</div>
    <div>Active Days: <span id="stat-days">0</span></div>
    <div>Average: <span id="stat-avg">0.0</span> min/day</div>
</div>

<!-- Heatmap -->
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
    <div>
        <div id="months"></div>
        <div id="heatmap"></div>
    </div>
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

<!-- Trend Chart -->
<div id="chart-tooltip"></div>
<div id="chart-container"></div>
<p style="margin-top:8px;font-size:12px;color:#666;">
Hover over chart points for details. Click to view daily reading log.
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
window.onerror = function(msg, url, line) {
    document.body.innerHTML = '<h3>JS Error</h3><pre>' + msg + ' (line ' + line + ')</pre>';
};

const DAY_DETAILS = ${dayDetailsJSON};
const DAY_MAP = ${mapJSON};
const DAY_ANNOTATIONS = ${dayAnnotationsJSON};
const ALL_YEARS = ${yearsJSON};
const LIBRARY_ID = ${libraryID};

const CELL_SIZE = 16;
const CELL_GAP = 4;
const COL_WIDTH = CELL_SIZE + CELL_GAP;

let currentYear = ${defaultYear};

// ============= RENDER HEATMAP FOR A GIVEN YEAR =============
function renderYear(year) {

    currentYear = year;
    document.getElementById('display-year').textContent = year;

    // Update active tab
    document.querySelectorAll('.year-tab').forEach(function(t) {
        var y = parseInt(t.getAttribute('data-year'), 10);
        t.classList.toggle('active', y === year);
    });

    // ---- compute stats for this year ----
    let totalMinutes = 0;
    let activeDays = 0;
    var dateStr;
    for (dateStr in DAY_MAP) {
        if (DAY_MAP.hasOwnProperty(dateStr) && dateStr.indexOf(String(year)) === 0) {
            var m = DAY_MAP[dateStr];
            totalMinutes += m;
            if (m > 0) activeDays++;
        }
    }
    var totalHours = (totalMinutes / 60).toFixed(1);
    var avgMinutes = activeDays > 0 ? (totalMinutes / activeDays).toFixed(1) : '0.0';
    document.getElementById('stat-total').textContent = totalHours;
    document.getElementById('stat-days').textContent = activeDays;
    document.getElementById('stat-avg').textContent = avgMinutes;

    // ---- build heatmap grid ----
    var startDate = new Date(year, 0, 1);
    var endDate = new Date(year, 11, 31);

    // Anchor: Monday on or before Jan 1
    var anchor = new Date(startDate);
    anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));

    var heatmap = document.getElementById('heatmap');
    heatmap.innerHTML = '';

    var frag = document.createDocumentFragment();
    var cur = new Date(anchor);
    var totalDays = 0;

    while (cur <= endDate) {
        var iso = cur.getFullYear() + '-' +
            String(cur.getMonth() + 1).padStart(2, '0') + '-' +
            String(cur.getDate()).padStart(2, '0');

        var minutes = DAY_MAP[iso] || 0;
        var level = 0;
        if (minutes > 15) level = 1;
        if (minutes >= 30) level = 2;
        if (minutes >= 60) level = 3;
        if (minutes >= 120) level = 4;

        var cell = document.createElement('div');
        cell.className = 'cell level-' + level;
        cell.setAttribute('data-date', iso);
        cell.title = iso + ' | ' + minutes.toFixed(1) + ' min';
        cell.addEventListener('click', function() {
            showDetail(this.getAttribute('data-date'));
        });
        frag.appendChild(cell);

        cur.setDate(cur.getDate() + 1);
        totalDays++;
    }

    heatmap.appendChild(frag);

    // ---- generate month labels ----
    var numCols = Math.ceil(totalDays / 7);
    var gridWidth = numCols * COL_WIDTH;

    var monthsEl = document.getElementById('months');
    monthsEl.innerHTML = '';
    monthsEl.style.width = gridWidth + 'px';

    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    for (var m = 0; m < 12; m++) {
        var firstDay = new Date(year, m, 1);
        if (firstDay < anchor) continue;

        var diffMs = firstDay - anchor;
        var col = Math.floor(diffMs / (86400000 * 7));

        var label = document.createElement('span');
        label.textContent = monthNames[m];
        label.style.position = 'absolute';
        label.style.left = (col * COL_WIDTH) + 'px';
        label.style.top = '0';
        label.style.whiteSpace = 'nowrap';
        monthsEl.appendChild(label);
    }

    // Close detail panel when switching years
    closeDetail();

    // Render trend chart
    try {
        renderTrendChart(year, gridWidth);
    } catch (e) {
        // fallback - heatmap still works
    }
}

// ============= TREND CHART (DOM-based SVG, smoother) =============
function renderTrendChart(year, gridWidth) {

    var container = document.getElementById('chart-container');

    // ---- data preparation ----
    var leftMargin = 60;
    var rightMargin = 50;
    var topMargin = 30;
    var bottomMargin = 40;
    var chartHeight = 240;
    var plotTop = topMargin;
    var plotBottom = chartHeight - bottomMargin;
    var plotLeft = leftMargin;
    var plotRight = leftMargin + gridWidth;

    var COLOR_READING = '#7BA7D4';   // low-saturation blue
    var COLOR_ANNOT   = '#7DB87D';   // low-saturation green
    var LINE_W = 1;                  // thinner lines

    function dayOfYear(d) {
        var start = new Date(d.getFullYear(), 0, 0);
        return Math.floor((d - start) / 86400000);
    }

    var isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    var totalDaysInYear = isLeap ? 366 : 365;

    var readingPoints = [];
    var annotationPoints = [];
    var hasData = false;
    var cumMinutes = 0;
    var cumAnns = 0;

    var todayStr = new Date().toISOString().slice(0, 10);
    var maxDoy = 365; // fallback

    // Compute cumulative values — running total from Jan 1 to each day (up to today)
    loopYear:
    for (var m = 0; m < 12; m++) {
        var daysInMonth = new Date(year, m + 1, 0).getDate();
        for (var d = 1; d <= daysInMonth; d++) {
            var dateStr = year + '-' +
                String(m + 1).padStart(2, '0') + '-' +
                String(d).padStart(2, '0');

            // Stop at today (for current year) or Dec 31 (for past years)
            if (year == new Date().getFullYear() && dateStr > todayStr) break loopYear;

            var dateObj = new Date(year, m, d);
            var doy = dayOfYear(dateObj);

            cumMinutes += DAY_MAP[dateStr] || 0;
            cumAnns    += DAY_ANNOTATIONS[dateStr] || 0;

            var x = plotLeft + (doy / totalDaysInYear) * gridWidth;
            readingPoints.push({x: x, y: cumMinutes, date: dateStr, cum: cumMinutes, cumAnn: cumAnns});
            annotationPoints.push({x: x, y: cumAnns, date: dateStr, cum: cumMinutes, cumAnn: cumAnns});
            if (cumMinutes > 0 || cumAnns > 0) hasData = true;
            maxDoy = doy;
        }
    }

    // Clear container
    container.innerHTML = '';

    if (!hasData) {
        var emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align:center;color:#8b949e;padding:30px 0;';
        emptyMsg.textContent = 'No reading or annotation data for ' + year;
        container.appendChild(emptyMsg);
        return;
    }

    var maxMinutes = cumMinutes;
    var maxAnnotations = cumAnns;
    if (maxMinutes <= 0) maxMinutes = 60;
    var yMaxMinutes = Math.ceil(maxMinutes / 200) * 200;
    if (yMaxMinutes < 60) yMaxMinutes = 60;

    if (maxAnnotations <= 0) maxAnnotations = 5;
    var yMaxAnns = Math.ceil(maxAnnotations / 10) * 10;
    if (yMaxAnns < 5) yMaxAnns = 5;

    function yScaleMin(mVal) {
        return plotBottom - (mVal / yMaxMinutes) * (plotBottom - plotTop);
    }
    function yScaleAnn(aVal) {
        return plotBottom - (aVal / yMaxAnns) * (plotBottom - plotTop);
    }

    // Catmull-Rom → cubic Bezier smooth path
    function smoothPath(points, yScale) {
        if (points.length < 2) return '';
        var n = points.length;
        var tension = 0.3;
        var d = 'M' + points[0].x.toFixed(1) + ',' + yScale(points[0].y).toFixed(1);

        for (var i = 0; i < n - 1; i++) {
            var p0 = points[Math.max(0, i - 1)];
            var p1 = points[i];
            var p2 = points[i + 1];
            var p3 = points[Math.min(n - 1, i + 2)];

            var cp1x = p1.x + (p2.x - p0.x) * tension;
            var cp1y = p1.y + (p2.y - p0.y) * tension;
            var cp2x = p2.x - (p3.x - p1.x) * tension;
            var cp2y = p2.y - (p3.y - p1.y) * tension;

            d += 'C' + cp1x.toFixed(1) + ',' + yScale(cp1y).toFixed(1) + ' ' +
                       cp2x.toFixed(1) + ',' + yScale(cp2y).toFixed(1) + ' ' +
                       p2.x.toFixed(1) + ',' + yScale(p2.y).toFixed(1);
        }
        return d;
    }

    // ---- DOM SVG creation ----
    var SVG_NS = 'http://www.w3.org/2000/svg';

    function makeSVG(tag, attrs) {
        var el = document.createElementNS(SVG_NS, tag);
        if (attrs) {
            for (var k in attrs) {
                if (attrs.hasOwnProperty(k)) {
                    el.setAttribute(k, attrs[k]);
                }
            }
        }
        return el;
    }

    var svgWidth = leftMargin + gridWidth + rightMargin;
    var svg = makeSVG('svg', {
        width: svgWidth,
        height: chartHeight,
        style: 'display:block;font-family:Arial,sans-serif;'
    });
    container.appendChild(svg);

    // Background
    svg.appendChild(makeSVG('rect', {
        x: 0, y: 0, width: svgWidth, height: chartHeight, fill: '#fff'
    }));

    var i, y, val, x;
    var yTicks = [];
    for (i = 0; i <= 4; i++) yTicks.push(i / 4);

    // Horizontal grid + left Y labels
    for (i = 0; i < yTicks.length; i++) {
        y = plotBottom - yTicks[i] * (plotBottom - plotTop);
        val = Math.round(yTicks[i] * yMaxMinutes);
        svg.appendChild(makeSVG('line', {
            x1: plotLeft, y1: y, x2: plotRight, y2: y,
            stroke: '#eee', 'stroke-width': 1
        }));
        var lblL = makeSVG('text', {
            x: plotLeft - 8, y: y + 4,
            'text-anchor': 'end', 'font-size': 11, fill: '#666'
        });
        lblL.textContent = val;
        svg.appendChild(lblL);
    }

    // Right Y labels
    for (i = 0; i < yTicks.length; i++) {
        y = plotBottom - yTicks[i] * (plotBottom - plotTop);
        val = Math.round(yTicks[i] * yMaxAnns);
        var lblR = makeSVG('text', {
            x: plotRight + 8, y: y + 4,
            'text-anchor': 'start', 'font-size': 11, fill: '#666'
        });
        lblR.textContent = val;
        svg.appendChild(lblR);
    }

    // Month dividers + labels (show all 12 months regardless)
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (var mIdx = 0; mIdx < 12; mIdx++) {
        var firstDay = new Date(year, mIdx, 1);
        var doy = dayOfYear(firstDay);
        x = plotLeft + (doy / totalDaysInYear) * gridWidth;
        svg.appendChild(makeSVG('line', {
            x1: x, y1: plotTop, x2: x, y2: plotBottom,
            stroke: '#eee', 'stroke-width': 1, 'stroke-dasharray': '3,3'
        }));
        var mlbl = makeSVG('text', {
            x: x, y: chartHeight - 8,
            'text-anchor': 'middle', 'font-size': 11, fill: '#666'
        });
        mlbl.textContent = monthNames[mIdx];
        svg.appendChild(mlbl);
    }

    // Axes
    svg.appendChild(makeSVG('line', { x1: plotLeft, y1: plotTop, x2: plotLeft, y2: plotBottom, stroke: '#ccc', 'stroke-width': 1 }));
    svg.appendChild(makeSVG('line', { x1: plotLeft, y1: plotBottom, x2: plotRight, y2: plotBottom, stroke: '#ccc', 'stroke-width': 1 }));
    svg.appendChild(makeSVG('line', { x1: plotRight, y1: plotTop, x2: plotRight, y2: plotBottom, stroke: '#ccc', 'stroke-width': 1 }));

    // ---- Axis titles (rotated 90° clockwise) ----
    var titleL = makeSVG('text', {
        x: 14, y: (plotTop + plotBottom) / 2,
        'text-anchor': 'middle', 'font-size': 11, fill: '#666',
        transform: 'rotate(90,14,' + ((plotTop + plotBottom) / 2) + ')'
    });
    titleL.textContent = 'Time';
    svg.appendChild(titleL);
    var titleR = makeSVG('text', {
        x: svgWidth - 14, y: (plotTop + plotBottom) / 2,
        'text-anchor': 'middle', 'font-size': 11, fill: '#666',
        transform: 'rotate(90,' + (svgWidth - 14) + ',' + ((plotTop + plotBottom) / 2) + ')'
    });
    titleR.textContent = 'Annotations';
    svg.appendChild(titleR);

    // Legend
    svg.appendChild(makeSVG('line', { x1: plotRight - 170, y1: topMargin - 10, x2: plotRight - 150, y2: topMargin - 10, stroke: COLOR_READING, 'stroke-width': LINE_W }));
    svg.appendChild(makeSVG('circle', { cx: plotRight - 160, cy: topMargin - 10, r: 2, fill: COLOR_READING }));
    var legL = makeSVG('text', { x: plotRight - 143, y: topMargin - 6, 'font-size': 11, fill: '#666' });
    legL.textContent = 'Reading Time';
    svg.appendChild(legL);
    svg.appendChild(makeSVG('circle', { cx: plotRight - 50, cy: topMargin - 10, r: 2, fill: 'none', stroke: COLOR_ANNOT, 'stroke-width': LINE_W }));
    var legR = makeSVG('text', { x: plotRight - 35, y: topMargin - 6, 'font-size': 11, fill: '#666' });
    legR.textContent = 'Annotations';
    svg.appendChild(legR);

    // Total badge
    var totH = (cumMinutes / 60).toFixed(1);
    var totalLabel = makeSVG('text', { x: plotLeft, y: topMargin - 6, 'font-size': 11, fill: '#888' });
    totalLabel.textContent = 'Total: ' + totH + ' h / ' + cumAnns + ' annotations';
    svg.appendChild(totalLabel);

    // ---- Reading time line (smooth) ----
    var readPath = makeSVG('path', {
        d: smoothPath(readingPoints, yScaleMin),
        fill: 'none', stroke: COLOR_READING,
        'stroke-width': LINE_W, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    });
    svg.appendChild(readPath);

    // Small dots for reading time
    for (i = 0; i < readingPoints.length; i++) {
        var p = readingPoints[i];
        if (p.y === 0) continue;
        var py = yScaleMin(p.y);
        var dot = makeSVG('circle', {
            cx: p.x.toFixed(1), cy: py.toFixed(1),
            r: 2, fill: COLOR_READING, stroke: '#fff', 'stroke-width': 0.5
        });
        dot.setAttribute('data-date', p.date);
        dot.setAttribute('data-cum-min', p.y.toFixed(0));
        dot.setAttribute('data-cum-ann', p.cumAnn ? p.cumAnn.toFixed(0) : '0');
        dot.classList.add('chart-point');
        dot.style.cursor = 'pointer';
        svg.appendChild(dot);
    }

    // ---- Annotation count line (smooth) ----
    var annPath = makeSVG('path', {
        d: smoothPath(annotationPoints, yScaleAnn),
        fill: 'none', stroke: COLOR_ANNOT,
        'stroke-width': LINE_W, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': '3,2'
    });
    svg.appendChild(annPath);

    for (i = 0; i < annotationPoints.length; i++) {
        var p = annotationPoints[i];
        if (p.y === 0) continue;
        var py = yScaleAnn(p.y);
        var dot = makeSVG('circle', {
            cx: p.x.toFixed(1), cy: py.toFixed(1),
            r: 2, fill: 'none', stroke: COLOR_ANNOT, 'stroke-width': LINE_W
        });
        dot.setAttribute('data-date', p.date);
        dot.setAttribute('data-cum-ann', p.y.toFixed(0));
        dot.setAttribute('data-cum-min', p.cum ? p.cum.toFixed(0) : '0');
        dot.classList.add('chart-point');
        dot.style.cursor = 'pointer';
        svg.appendChild(dot);
    }

    // ---- event listeners ----
    var points = container.querySelectorAll('.chart-point');
    for (i = 0; i < points.length; i++) {
        (function(el) {
            el.addEventListener('mouseenter', function(e) {
                var date = el.getAttribute('data-date');
                var cumMin = parseFloat(el.getAttribute('data-cum-min')) || 0;
                var cumAnn = parseFloat(el.getAttribute('data-cum-ann')) || 0;
                var tip = document.getElementById('chart-tooltip');
                tip.innerHTML = '📅 ' + date + '<br>📖 Cumulative: ' + cumMin.toFixed(0) + ' min<br>🔖 Cumulative: ' + cumAnn.toFixed(0) + ' annotation' + (cumAnn !== 1 ? 's' : '');
                tip.style.display = 'block';
                tip.style.left = (e.clientX + 12) + 'px';
                tip.style.top = (e.clientY - 40) + 'px';
            });
            el.addEventListener('mousemove', function(e) {
                var tip = document.getElementById('chart-tooltip');
                tip.style.left = (e.clientX + 12) + 'px';
                tip.style.top = (e.clientY - 40) + 'px';
            });
            el.addEventListener('mouseleave', function() {
                document.getElementById('chart-tooltip').style.display = 'none';
            });
            el.addEventListener('click', function() {
                showDetail(el.getAttribute('data-date'));
            });
        })(points[i]);
    }
}

// ============= SHOW / CLOSE DETAIL (unchanged logic) =============
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
            html += '<h4 data-key="' + escapeAttr(item.key) + '" class="ai-title"><span class="ai-icon">▶</span> 📄 ' + escapeHtml(item.title) + '</h4>';
            html += '<div class="ai-panel" id="ais-' + escapeAttr(item.key) + '" style="display:none"><div class="ai-loading">🤖 AI 生成中...</div><div class="ai-body"></div><div class="ai-error" style="display:none"></div></div>';

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

            if ((!item.notes || item.notes.length === 0) && (!item.annotations || item.annotations.length === 0)) {
                html += '<div style="margin-left:16px;font-size:12px;color:#8b949e;">Opened / read (no new marks today)</div>';
            }

            html += '</div>';
        }
        content.innerHTML = html;

        var titles = content.querySelectorAll('h4[data-key]');
        for (var k = 0; k < titles.length; k++) {
            (function(el) {
                el.addEventListener('click', async function() {
                    var key = el.getAttribute('data-key');
                    var panel = document.getElementById('ais-' + key);
                    if (!panel) return;
                    var icon = el.querySelector('.ai-icon');
                    // Toggle: collapse if already open
                    if (panel.style.display !== 'none') {
                        panel.style.display = 'none';
                        if (icon) icon.textContent = '▶';
                        return;
                    }
                    panel.style.display = 'block';
                    if (icon) icon.textContent = '▼';
                    // Already loaded content → just show
                    var body = panel.querySelector('.ai-body');
                    var loading = panel.querySelector('.ai-loading');
                    var error = panel.querySelector('.ai-error');
                    if (body.textContent || error.textContent) return;
                    // First time → call AI
                    if (typeof window._generateAISummary !== 'function') {
                        loading.style.display = 'none';
                        error.textContent = 'AI function unavailable. Restart Zotero.';
                        error.style.display = 'block';
                        return;
                    }
                    loading.style.display = 'block';
                    try {
                        var text = await window._generateAISummary(key);
                        loading.style.display = 'none';
                        if (text.indexOf('⚠') === 0 ||
                            text.indexOf('API') === 0 ||
                            text.indexOf('Error') === 0 ||
                            text.indexOf('Unexpected') === 0) {
                            error.textContent = text;
                            error.style.display = 'block';
                        } else {
                            body.textContent = text;
                        }
                    } catch (e) {
                        loading.style.display = 'none';
                        error.textContent = 'Error: ' + (e.message || e);
                        error.style.display = 'block';
                    }
                });
            })(titles[k]);
        }
    }

    document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
    document.getElementById('detail-panel').classList.remove('open');
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

// ============= YEAR NAVIGATION =============
document.querySelectorAll('.year-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
        renderYear(parseInt(this.getAttribute('data-year'), 10));
    });
});

document.getElementById('detail-close').addEventListener('click', closeDetail);

document.getElementById('settings-btn').addEventListener('click', function() {
    if (window.openSettingsWindow) {
        window.openSettingsWindow();
    }
});

// Initial render
renderYear(${defaultYear});
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
        "chrome,resizable,scrollbars,width=1500,height=800,left=50,top=100",
        null
    );

    // Expose functions to the heatmap content
    win.openSettingsWindow = openSettingsWindow;
    win._generateAISummary = generateArticleSummary;

    win.addEventListener("load", function() {

        win.document.open();
        win.document.write(html);
        win.document.close();
    });
}

Zotero.debug("Reading Tracker: heatmap.js loaded");
