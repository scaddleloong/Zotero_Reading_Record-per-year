/* heatmap.js */

function generateHeatmapHTML() {

    const rows = loadAll();
    const year = new Date().getFullYear();

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const map = {};

    for (const r of rows) {
        map[r.date] = r.seconds / 60;
    }

    const anchor = new Date(startDate);

    // 周一作为第一列起点
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

        if (minutes > 0) level = 1;
        if (minutes >= 10) level = 2;
        if (minutes >= 30) level = 3;
        if (minutes >= 60) level = 4;

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

body{
    font-family: Arial, sans-serif;
    margin:20px;
}

h2{
    margin-bottom:20px;
}

#heatmap{
    display:grid;

    grid-auto-flow:column;

    grid-template-rows:
        repeat(7,12px);

    grid-auto-columns:12px;

    gap:3px;

    width:max-content;
}

.cell{
    width:12px;
    height:12px;
    border-radius:2px;
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

.legend{
    margin-top:15px;
    display:flex;
    align-items:center;
    gap:5px;
    font-size:12px;
}

.legend-box{
    width:12px;
    height:12px;
    border-radius:2px;
}

</style>
</head>

<body>

<h2>Reading Heatmap (${year})</h2>

<div id="heatmap">
${cells.join("")}
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


/**
 * 打开热图窗口
 */
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