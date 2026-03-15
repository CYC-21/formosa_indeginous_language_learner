/**
 * localStorage 工具（1.0+）
 * 使用者的單字收藏儲存於本機（localStorage），不送後端。
 * - saved_words: 收藏單字 ID 陣列 ["W0001", "W0034", ...]，一律以字串儲存與比對
 * - daily_word_filter: 今日單字範圍設定
 */

const STORAGE_KEYS = {
  SAVED_WORDS: "saved_words",
  DAILY_WORD_FILTER: "daily_word_filter",
  DEFAULT_FILTER: "default_filter",
};

/** 全域預設篩選：語言別、級別。各分頁以此為預設。格式 { language: string[], level: string[] } */
function getDefaultFilter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEFAULT_FILTER);
    if (raw == null) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return {
      language: Array.isArray(o.language) ? o.language.map(String) : [],
      level: Array.isArray(o.level) ? o.level.map(String) : [],
    };
  } catch {
    return null;
  }
}

function setDefaultFilter(value) {
  const o = value && typeof value === "object" ? value : {};
  const out = {
    language: Array.isArray(o.language) ? o.language.map(String) : [],
    level: Array.isArray(o.level) ? o.level.map(String) : [],
  };
  try {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_FILTER, JSON.stringify(out));
    return true;
  } catch {
    return false;
  }
}

/** 一律以字串儲存與比對，避免 id 型別不一致 */
function getSavedWords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_WORDS);
    if (raw == null) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x));
  } catch {
    return [];
  }
}

function setSavedWords(ids) {
  const arr = (Array.isArray(ids) ? ids : []).map((x) => String(x));
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_WORDS, JSON.stringify(arr));
    return true;
  } catch {
    return false;
  }
}

function toggleSavedWord(id) {
  const sid = String(id);
  const list = getSavedWords();
  const idx = list.indexOf(sid);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(sid);
  }
  setSavedWords(list);
  return idx < 0; // true = 已加入收藏
}

function isSavedWord(id) {
  return getSavedWords().includes(String(id));
}

/** 今日單字篩選：語言、級別、分類。未設時以全域預設為語言/級別。格式 { language?: string[], level?: string[], category?: string[] } */
function getDailyWordFilter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_WORD_FILTER);
    if (raw == null) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return {
      language: Array.isArray(o.language) ? o.language.map(String) : [],
      level: Array.isArray(o.level) ? o.level.map(String) : [],
      category: Array.isArray(o.category) ? o.category.map(String) : [],
    };
  } catch {
    return null;
  }
}

function setDailyWordFilter(value) {
  const o = value && typeof value === "object" ? value : {};
  const out = {
    language: Array.isArray(o.language) ? o.language.map(String) : [],
    level: Array.isArray(o.level) ? o.level.map(String) : [],
    category: Array.isArray(o.category) ? o.category.map(String) : [],
  };
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_WORD_FILTER, JSON.stringify(out));
    return true;
  } catch {
    return false;
  }
}
