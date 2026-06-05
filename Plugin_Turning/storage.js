/* global Zotero */

const STORAGE_KEY = "extensions.reading-tracker.data";

function initDB() {
    // Zotero 9 不需要真实数据库
}

// 获取所有记录
function loadAll() {
    const raw = Zotero.Prefs.get(STORAGE_KEY, true);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

// 保存所有记录
function saveAll(data) {
    Zotero.Prefs.set(STORAGE_KEY, JSON.stringify(data), true);
}

// 增加秒数
function addSeconds(day, seconds) {
    let data = loadAll();
    let item = data.find(d => d.date === day);
    if (!item) {
        data.push({ date: day, seconds: seconds });
    } else {
        item.seconds += seconds;
    }
    saveAll(data);
}