# Reading Tracker

Zotero plugin for automatic reading time tracking, heatmap visualization, daily reading log, and AI-powered article summaries.

---

## Compatibility

- Zotero **10.0.1** (tested, V1.4+)

- Zotero **9.0.4** (tested, V1.3 and earlier)

- Other versions: unverified

> Note: the plugin no longer declares a `strict_max_version`, so it stays enabled across Zotero major-version upgrades (Zotero 7 introduced this behaviour).

---

## Features

**Core**

- Automatic reading time tracking (records every Zotero item you open)
- Storage via Zotero_Note_Sync — data persists across devices via Zotero Sync
- GitHub-style yearly heatmap with 5-level color intensity
- Year navigation tabs for browsing historical data
- Daily reading statistics (total hours / active days / average min/day)
- Hover tooltip & click for per-day detail panel (items, notes, PDF annotations)
- Trend chart: dual-axis line chart (reading time vs. annotations count)

**AI Article Analysis** (V1.2+)

- One-click structured analysis for any article in the detail panel
- 9-field summary: Background, Research Question, Methodology, Results, Innovation, Limitations & Future Work, Significance, Core Insights, Keywords
- Compatible with any OpenAI-compatible API provider
- Configurable API endpoint, key, and model via inline settings panel (⚙️)

**Multi-Language** (V1.1+)

- Full UI localization in 10 languages
- Automatically follows Zotero's locale setting
- Supported: English, Chinese, Spanish, French, Portuguese, Russian, German, Japanese, Arabic, Hindi

---

## Installation

1. Download the latest `.xpi` release from the [Releases](https://github.com/scaddleloong/Zotero_Reading_Record-per-year/releases) page
2. In Zotero, go to **Tools → Add-ons** (or **Extensions**)
3. Drag the `.xpi` file into the Add-ons window to install
4. Click the toolbar button **"Reading Time Log"** to open the heatmap

---

## Usage

### Reading Heatmap

- **Hover** any cell to see reading time for that day
- **Click** a cell to open the detail panel (items read, notes, PDF annotations)
- **Click year tabs** to switch between years
- Hover the trend chart for cumulative time and annotation counts

### AI Summary Setup

1. Open the heatmap and click the **⚙️** button
2. Enter your API endpoint URL, API key, and model name
3. Click **Save**, then **Test Connection** to verify
4. In the detail panel, click **AI Analysis** on any article

---

## Output

- Yearly heatmap view with reading intensity per day
- Aggregated statistics panel (total, active days, average)
- Trend chart with dual-axis (time & annotations)

<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/b0bd5747-4a7f-4b1e-a8c2-9be2b85c3101" />

<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/9d1e1164-824a-4294-bed3-51080643e313" />

<img width="1913" height="812" alt="image" src="https://github.com/user-attachments/assets/a33f1f36-d145-4d72-b71e-5efea49a8598" />


---

## Data Storage

- Data is stored in a Zotero note prefixed with `Z_READING_TRACKER_DO_NOT_DELETE`
- The note syncs automatically via Zotero Sync to all your devices
- **Do not modify or delete this note** — it contains the plugin's database
- For advanced users: the raw data can be exported to a local database via the companion Python scripts in the `Scripts/` directory

---

## Notes

- Designed for lightweight academic reading tracking
- Reading time is measured as the duration you have a Zotero item open (not annotation count)

---

## License

MIT
