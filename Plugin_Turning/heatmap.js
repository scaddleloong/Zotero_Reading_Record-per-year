/* heatmap.js */

async function loadPlotly(win, rootURI) {
    const url = rootURI + "plotly.min.js";

    return new Promise((resolve, reject) => {
        const script = win.document.createElement("script");
        script.src = url;

        script.onload = resolve;
        script.onerror = reject;

        win.document.head.appendChild(script);
    });
}

/**
 * 生成 heatmap 数据和 HTML
 */
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
    anchor.setDate(anchor.getDate() - anchor.getDay() + 1);

    const totalDays = Math.ceil((endDate - anchor) / 86400000) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);

    const z = Array.from({ length: 7 }, () => Array(totalWeeks).fill(0));

    let cur = new Date(startDate);
    while (cur <= endDate) {
        const dayIndex = Math.floor((cur - anchor) / 86400000);
        const weekIndex = Math.floor(dayIndex / 7);
        const weekday = (cur.getDay() + 6) % 7;

        const iso = cur.toISOString().slice(0, 10);
        z[weekday][weekIndex] = map[iso] || 0;

        cur.setDate(cur.getDate() + 1);
    }

    // HTML 只包含数据和 div，不再包含 Plotly
    return {
        html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Heatmap</title>
</head>
<body>
<h3>Reading Heatmap (${year})</h3>
<div id="h" style="width:100%;height:90vh"></div>

<script>
window.__HEATMAP_DATA__ = ${JSON.stringify(z)};
</script>
</body>
</html>
        `,
        year
    };
}

/**
 * 打开 heatmap 弹窗
 */
async function openHeatmapWindow(winRef, rootURI) {
    const { html } = generateHeatmapHTML();

    const win = Services.ww.openWindow(
        null,
        "about:blank",
        "_blank",
        "chrome,resizable,scrollbars",
        null
    );

    win.addEventListener("load", async () => {
        const doc = win.document;

        doc.open();
        doc.write(html);
        doc.close();

        // 🔥 正确加载 Plotly
        await loadPlotly(win, rootURI);

        win.setTimeout(() => {
            win.eval(`
                    const z = window.__HEATMAP_DATA__;

                    // 强制清洗数据（关键）
                    for (let i = 0; i < z.length; i++) {
                        for (let j = 0; j < z[i].length; j++) {
                            const v = z[i][j];
                            z[i][j] = (typeof v === "number" && isFinite(v)) ? v : 0;
                        }
                    }

                    Plotly.newPlot("h", [{
                    z: z,
                    type: "heatmap",
                    colorscale: [[0,"#ebedf0"],[1,"#216e39"]]
                    }], {
                    margin: { t: 30, r: 10, b: 30, l: 30 },
                    xaxis: { fixedrange: true },
                    yaxis: { fixedrange: true },
                    yaxis: { tickvals: [0,1,2,3,4,5,6], ticktext: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] }
                    });
                `);
        }, 50);
    });
}