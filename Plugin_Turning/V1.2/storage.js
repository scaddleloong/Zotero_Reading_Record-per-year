
/* storage.js - V1.2 Stable Fixed Version */

const NOTE_TITLE = "Reading Tracker Data (DO NOT DELETE)";

/* =========================
   内部状态
========================= */

let _cache = null;
let _ready = false;

/* =========================
   获取 or 创建 Note（唯一入口）
========================= */

async function _getNote() {

    const libraryID = Zotero.Libraries.userLibraryID;

    const s = new Zotero.Search();
    s.libraryID = libraryID;

    s.addCondition('title', 'is', NOTE_TITLE);
    s.addCondition('itemType', 'note');

    const ids = await s.search();

    let note = null;

    if (ids.length > 0) {
        note = Zotero.Items.get(ids[0]);
        Zotero.debug("NOTE FOUND ID = " + note.id);
        return note;
    }

    // ⭐ 正确创建（绑定 library）
    const newNote = new Zotero.Item("note", libraryID);

    newNote.setNoteTitle(NOTE_TITLE);
    newNote.setNote(JSON.stringify({ version: 1, data: [] }));

    await newNote.saveTx();

    Zotero.debug("NOTE CREATED ID = " + newNote.id);

    return newNote;
}

/* =========================
   初始化（必须在启动时调用）
========================= */

async function initStorage() {

    try {
        const note = await _getNote();

        const raw = note.getNote ? note.getNote() : "";

        if (!raw) {
            _cache = [];
            _ready = true;
            return;
        }

        const parsed = JSON.parse(raw);
        _cache = parsed.data || [];

        _ready = true;

    } catch (e) {
        Zotero.debug("initStorage error: " + e);
        _cache = [];
        _ready = true;
    }
}

/* =========================
   读取（同步 API）
========================= */

function loadAll() {
    return _cache || [];
}

/* =========================
   写入（异步后台执行）
========================= */

function saveAll(data) {

    _cache = data;

    (async () => {
        try {
            const note = await _getNote();

            if (!note) return;

            const payload = {
                version: 1,
                data
            };

            note.setNote(JSON.stringify(payload, null, 2));
            await note.saveTx();

        } catch (e) {
            Zotero.debug("saveAll error: " + e);
        }
    })();
}

/* =========================
   写入累计逻辑
========================= */

function addSeconds(day, seconds) {

    const data = loadAll();

    let item = data.find(d => d.date === day);

    if (!item) {
        data.push({ date: day, seconds });
    } else {
        item.seconds += seconds;
    }

    saveAll(data);
}