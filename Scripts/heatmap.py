import datetime as dt
import plotly.graph_objects as go

from database import load_all

current_year = dt.date.today().year
HEATMAP_PATH = f"../Output/Daily_Heatmap-{current_year}.html"

def generate_heatmap():

    rows = load_all()
    if not rows:
        return

    # =========================
    # 1. 固定 2026 年
    # =========================

    today = dt.date.today()  # 获取今天日期
    current_year = today.year  # 提取当前年份
    start_date = dt.date(current_year, 1, 1)  # 当年 1月1日
    end_date = dt.date(current_year, 12, 31)  # 当年 12月31日

    # =========================
    # 2. 数据
    # =========================
    data = {
        dt.datetime.strptime(d, "%Y-%m-%d").date(): s / 60
        for d, s in rows
    }

    # =========================
    # 3. 找到“周一对齐起点”
    # =========================
    # 让 2026-01-01 所在周从周一开始
    anchor = start_date - dt.timedelta(days=start_date.weekday())

    total_days = (end_date - anchor).days + 1
    total_weeks = (total_days // 7) + 1

    # =========================
    # 4. heatmap matrix
    # =========================
    z = [[0 for _ in range(total_weeks)] for _ in range(7)]
    text = [["" for _ in range(total_weeks)] for _ in range(7)]

    # =========================
    # 5. 逐日填充（关键）
    # =========================
    current = start_date
    while current <= end_date:

        day_index = (current - anchor).days
        week_index = day_index // 7
        weekday = current.weekday()

        minutes = round(data.get(current, 0), 1)

        z[weekday][week_index] = minutes
        text[weekday][week_index] = (
            f"{current}<br>"
            f"Reading Time: {minutes:.1f} minutes"
        )

        current += dt.timedelta(days=1)

    # =========================
    # 6. 月份标记（可选）
    # =========================
    month_positions = []
    month_labels = []

    current = start_date
    while current <= end_date:
        if current.day == 1:
            week_index = (current - anchor).days // 7
            month_positions.append(week_index)
            month_labels.append(current.strftime("%Y-%m"))
        current += dt.timedelta(days=1)

    # =========================
    # 7. 画图
    # =========================
    fig = go.Figure(
        data=go.Heatmap(
            z=z,
            text=text,
            hoverinfo="text",
            xgap=2,
            ygap=2,

            zmin=0,
            zmax=240,

            colorscale=[
                [0.00, "#ebedf0"],
                [0.20, "#9be9a8"],
                [0.40, "#40c463"],
                [0.60, "#30a14e"],
                [0.80, "#216e39"],
                [1.00, "#0e4429"]
            ],

            showscale=False,
        )
    )

    fig.update_layout(
        title="Zotero Reading Record (2026)",
        height=300,
        width=max(1400, total_weeks * 25),

        plot_bgcolor="white",
        paper_bgcolor="white",

        margin=dict(l=60, r=30, t=70, b=40),

        yaxis=dict(
            tickmode="array",
            tickvals=list(range(7)),
            ticktext=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            autorange="reversed",
            showgrid=False,
            zeroline=False
        ),

        xaxis=dict(
            tickmode="array",
            tickvals=month_positions,
            ticktext=month_labels,
            side="top",
            showgrid=False,
            zeroline=False
        )
    )

    fig.write_html(HEATMAP_PATH, include_plotlyjs="cdn")

    print(f"[{dt.datetime.now()}] Heatmap Updated: {HEATMAP_PATH}")