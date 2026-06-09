/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/09 11: 17 AM
heatmap.js V0.3

Annotation_Information_End */

// generate heatmap function
function generateHeatmapHTML() {

    const rows = loadAll(); // function from storage

    const year = new Date().getFullYear();

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const map = {};

    for (const r of rows) {
        map[r.date] = r.seconds / 60; // change to minutes
    }

    // statistics
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

    const anchor = new Date(startDate);

    // start from monday
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

        // color levels
        if (minutes > 15) level = 1;
        if (minutes >= 30) level = 2;
        if (minutes >= 60) level = 3;
        if (minutes >= 120) level = 4;

        cells.push(`
            <div
                class="cell level-${level}"
                title="${iso} | ${minutes.toFixed(1)} min"
            ></div>
        `);

        cur.setDate(cur.getDate() + 1);
    }

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<title>Reading Heatmap</title>

<style>

html,
body{
    background:white;
}

body{
    font-family:Arial,sans-serif;
    margin:20px;
    color:#24292f;
}

h2{
    margin-bottom:10px;
}

.stats{
    margin-bottom:20px;
    font-size:14px;
}

.stats div{
    margin-top:4px;
}

.heatmap-wrapper{
    display:flex;
    align-items:flex-start;
}

.weekday-labels{

    display:grid;

    grid-template-rows:
        repeat(7,16px);

    gap:4px;

    margin-right:10px;

    font-size:11px;

    color:#666;

    width:30px;
}

#heatmap{

    display:grid;

    grid-auto-flow:column;

    grid-template-rows:
        repeat(7,16px);

    grid-auto-columns:16px;

    gap:4px;

    width:max-content;
}

.cell{
    width:16px;
    height:16px;

    border-radius:3px;

    background:#ebedf0;
}

.level-0{
    background:#ebedf0;
}

.level-1{
    background:#9be9a8;
}

.level-2{
    background:#40c463;
}

.level-3{
    background:#30a14e;
}

.level-4{
    background:#216e39;
}

#months{

    display:grid;

    grid-template-columns:
        repeat(12,1fr);

    width:1060px;

    margin-top:10px;

    margin-left:40px;

    font-size:11px;

    color:#666;
}

.legend{
    margin-top:20px;

    display:flex;
    align-items:center;

    gap:5px;

    font-size:12px;
}

.legend-box{
    width:16px;
    height:16px;
    border-radius:3px;
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

    <span>Jan</span>
    <span>Feb</span>
    <span>Mar</span>
    <span>Apr</span>
    <span>May</span>
    <span>Jun</span>
    <span>Jul</span>
    <span>Aug</span>
    <span>Sep</span>
    <span>Oct</span>
    <span>Nov</span>
    <span>Dec</span>

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
Hover over a square to view reading time.
</p>

</body>
</html>
`;
}

// open heatmap window in new window
function openHeatmapWindow() {

    const html = generateHeatmapHTML();

    const win = Services.ww.openWindow(
    null,
    "about:blank",
    "_blank",
    "chrome,resizable,scrollbars,width=1200,height=800,left=100,top=100",
    null
);

win.addEventListener("load", () => {

    win.resizeTo(1200, 500);
    win.moveTo(100, 200);

    win.document.open();
    win.document.write(html);
    win.document.close();
});
}