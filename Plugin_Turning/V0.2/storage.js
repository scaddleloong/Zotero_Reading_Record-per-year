/* storage.js */

const NOTE_MARKER = "Z_READING_TRACKER_DO_NOT_DELETE";

let _cache = [];
let _ready = false;

/* =========================
   获取 / 创建 Note
========================= */

async function _getNote() {

    const libraryID = Zotero.Libraries.userLibraryID;

    const s = new Zotero.Search();
    s.libraryID = libraryID;
    s.addCondition("itemType", "is", "note");

    const ids = await s.search();

    for (const id of ids) {

        const note = await Zotero.Items.getAsync(id);
        if (!note) continue;

        const content = note.getNote() || "";

        if (content.includes(NOTE_MARKER)) {
            return note;
        }
    }

    const note = new Zotero.Item("note");
    note.libraryID = libraryID;

    note.setNote(
`${NOTE_MARKER}

{
  "version": 1,
  "data": []
}`
    );

    await note.saveTx();

    return note;
}

/* =========================
   初始化
========================= */

async function initStorage() {

    const note = await _getNote();

    const raw = note.getNote() || "";

    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
        _cache = [];
        _ready = true;
        return;
    }

    try {
        const parsed = JSON.parse(match[0]);
        _cache = parsed.data || [];
    } catch (e) {
        _cache = [];
    }

    _ready = true;
}

/* =========================
   读取
========================= */

function loadAll() {
    if (!_ready) return [];
    return [..._cache];
}

/* =========================
   保存
========================= */

async function saveAll(data) {

    if (!_ready) return;

    _cache = [...data];

    const note = await _getNote();

    const payload = {
        version: 1,
        data: _cache
    };

    note.setNote(
`${NOTE_MARKER}

${JSON.stringify(payload, null, 2)}`
    );

    await note.saveTx();
}

/* =========================
   逻辑
========================= */

function addSeconds(day, seconds) {

    if (!day) return;

    const data = loadAll();

    let item = data.find(d => d.date === day);

    if (!item) {
        data.push({ date: day, seconds });
    } else {
        item.seconds += seconds;
    }

    saveAll(data);
}