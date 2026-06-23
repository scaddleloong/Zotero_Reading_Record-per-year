/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/23
storage.js V0.6: annotation backfill, _meta persistence

Annotation_Information_End */

const NOTE_MARKER = "Z_READING_TRACKER_DO_NOT_DELETE";

let _cache = [];
let _meta = {};
let _ready = false;

// Use zotero sync function to automatically sync reading data of one zotero account

// Create or find sync note to save or read data
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
  "_meta": {},
  "data": []
}`
    );

    await note.saveTx();

    return note;
}

// init storage
async function initStorage() {

    const note = await _getNote();

    const raw = note.getNote() || "";

    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
        _cache = [];
        _meta = {};
        _ready = true;
        return;
    }

    try {
        const parsed = JSON.parse(match[0]);
        _cache = parsed.data || [];
        _meta = parsed._meta || {};
    } catch (e) {
        _cache = [];
        _meta = {};
    }

    _ready = true;
}

// Read Note
function loadAll() {
    if (!_ready) return [];
    return [..._cache];
}

// save Note
async function saveAll(data) {

    if (!_ready) return;

    _cache = [...data];

    const note = await _getNote();

    const payload = {
        version: 1,
        _meta: _meta,
        data: _cache
    };

    note.setNote(
`${NOTE_MARKER}

${JSON.stringify(payload, null, 2)}`
    );

    await note.saveTx();
}

// add reading data
function addSeconds(day, seconds) {

    if (!day) return;

    const data = loadAll();

    let item = data.find(d => d.date === day);

    if (!item) {
        data.push({ date: day, seconds, items: [] });
    } else {
        item.seconds += seconds;
    }

    saveAll(data);
}

// track items read on a given day
function addItemToDay(day, itemKey) {

    if (!day || !itemKey) return;

    const data = loadAll();

    let item = data.find(d => d.date === day);

    if (!item) {
        data.push({ date: day, seconds: 0, items: [itemKey] });
    } else {
        if (!item.items) item.items = [];
        if (!item.items.includes(itemKey)) {
            item.items.push(itemKey);
        }
    }

    saveAll(data);
}

// ------- Annotation-based backfill (one-time) -------

// Estimate reading seconds for a day based on total annotation+note count
function _estimateSeconds(count) {
    if (count <= 1) return 600;        // ~10 min
    if (count <= 4) return 1200;       // ~20 min
    if (count <= 10) return 2400;      // ~40 min
    if (count <= 20) return 3600;      // ~60 min
    if (count <= 50) return 5400;      // ~90 min
    return 7200;                        // ~120 min
}

// Get the top-level library item key from any child item (annotation or note)
function _getParentItemKey(item) {
    try {
        // Walk up the parent chain to find the top-level item
        let current = item;
        let seen = new Set();
        while (current) {
            if (seen.has(current.id)) break;
            seen.add(current.id);
            const pid = current.parentItemID;
            if (!pid) return current.key; // reached the top
            const parent = Zotero.Items.get(pid);
            if (!parent) return current.key;
            current = parent;
        }
        return current ? current.key : null;
    } catch (e) {
        return null;
    }
}

// Backfill: scan annotations and notes via Zotero.Search, estimate historical reading time
async function backfillReadingData() {

    if (!_ready) return;

    if (_meta.backfilled) {
        Zotero.debug("Reading Tracker: backfill already done");
        return;
    }

    try {

        Zotero.debug("Reading Tracker: backfill STARTED");

        const libraryID = Zotero.Libraries.userLibraryID;
        const existingData = loadAll();
        const existingDates = new Set(existingData.map(d => d.date));

        // date -> { count (for estimation), itemKeys (Set) }
        const dateInfo = {};

        function _addDateActivity(day, parentKey) {
            if (!day) return;
            if (!dateInfo[day]) {
                dateInfo[day] = { count: 0, keys: new Set() };
            }
            dateInfo[day].count++;
            if (parentKey) {
                dateInfo[day].keys.add(parentKey);
            }
        }

        // ---- Step 1: search for ALL annotations ----
        try {
            const annSearch = new Zotero.Search();
            annSearch.libraryID = libraryID;
            annSearch.addCondition("itemType", "is", "annotation");
            const annIDs = await annSearch.search();

            Zotero.debug("Reading Tracker: found " + annIDs.length + " annotation items");

            for (const id of annIDs) {
                try {
                    const ann = await Zotero.Items.getAsync(id);
                    if (!ann) continue;
                    let added = String(ann.getField('dateAdded') || '');
                    if (!added) continue;
                    const day = added.slice(0, 10);
                    const parentKey = _getParentItemKey(ann);
                    _addDateActivity(day, parentKey);
                } catch (e) {}
            }
        } catch (e) {
            Zotero.debug("Reading Tracker: annotation search error: " + e);
        }

        // ---- Step 2: search for ALL notes (excluding our tracker note) ----
        try {
            const noteSearch = new Zotero.Search();
            noteSearch.libraryID = libraryID;
            noteSearch.addCondition("itemType", "is", "note");
            const noteIDs = await noteSearch.search();

            Zotero.debug("Reading Tracker: found " + noteIDs.length + " note items");

            for (const id of noteIDs) {
                try {
                    const noteItem = await Zotero.Items.getAsync(id);
                    if (!noteItem) continue;

                    // Skip our own tracker note
                    const content = noteItem.getNote ? noteItem.getNote() || '' : '';
                    if (content.includes(NOTE_MARKER)) continue;

                    let added = String(noteItem.getField('dateAdded') || '');
                    if (!added) continue;
                    const day = added.slice(0, 10);
                    const parentKey = _getParentItemKey(noteItem);
                    _addDateActivity(day, parentKey);
                } catch (e) {}
            }
        } catch (e) {
            Zotero.debug("Reading Tracker: note search error: " + e);
        }

        Zotero.debug("Reading Tracker: found " +
            Object.keys(dateInfo).length + " dates with annotation/note activity");

        if (Object.keys(dateInfo).length === 0) {
            Zotero.debug("Reading Tracker: no annotation/note data found, skipping");
            _meta.backfilled = true;
            _meta.backfillDate = new Date().toISOString().slice(0, 10);
            await saveAll(existingData);
            return;
        }

        // ---- Merge with existing data ----
        const merged = [...existingData];
        let addedDays = 0;

        for (const [date, info] of Object.entries(dateInfo)) {
            if (existingDates.has(date)) continue;

            merged.push({
                date,
                seconds: _estimateSeconds(info.count),
                items: Array.from(info.keys),
                _estimated: true
            });
            addedDays++;
        }

        merged.sort((a, b) => a.date.localeCompare(b.date));

        _meta.backfilled = true;
        _meta.backfillDate = new Date().toISOString().slice(0, 10);

        await saveAll(merged);

        Zotero.debug("Reading Tracker: backfill COMPLETE — added " +
            addedDays + " estimated reading days with item references");

    } catch (e) {
        Zotero.debug("Reading Tracker: backfill FATAL ERROR — " + e);
        if (e.stack) Zotero.debug(e.stack);
    }
}

Zotero.debug("Reading Tracker: storage.js loaded");
