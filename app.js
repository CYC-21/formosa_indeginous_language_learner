/*
  複製來源：ver 1.0/app.js
  複製日期：2026-03-13
  用途：根目錄「查看單字」頁 (vocabulary.html) 專用；v1.0 原始檔凍結於 ver 1.0/。此檔可擴充（如收藏），不刪改既有 v1.0 邏輯。
*/

// 基本前端 state
const state = {
  words: [],
  tags: [],
  syllables: [],
  morphs: [],
  enrichedWords: [],
  filteredWords: [],
  viewMode: "card", // 'card' | 'list' | 'flip'；頁面載入時為字卡模式
  searchText: "",
  filters: {
    language: [],
    level: [],
    category: [],
  },
  currentCardIndex: 0,
  showSyllablesOnCard: false, // 頁面載入時為非音節
  showMorphsOnCard: false,     // 頁面載入時為非構詞
  flipDefaultSide: "word", // 'word' | 'meaning'
  flipIsBack: false,
};

// DOM 元件
const searchInput = document.getElementById("searchInput");
const summaryCountEl = document.getElementById("summaryCount");
const summaryFiltersEl = document.getElementById("summaryFilters");
const cardViewEl = document.getElementById("cardView");
const listViewEl = document.getElementById("listView");
const cardEl = document.getElementById("card");
const cardIndexLabelEl = document.getElementById("cardIndexLabel");
const wordTableBodyEl = document.getElementById("wordTableBody");
const statusBarEl = document.getElementById("statusBar");
const prevCardBtn = document.getElementById("prevCardBtn");
const nextCardBtn = document.getElementById("nextCardBtn");
const randomCardBtn = document.getElementById("randomCardBtn");
const toggleAnswerBtn = document.getElementById("toggleAnswerBtn");
const toggleSyllableBtn = document.getElementById("toggleSyllableBtn");
const toggleMorphBtn = document.getElementById("toggleMorphBtn");
const searchToggleBtn = document.getElementById("searchToggleBtn");
const searchPanelEl = document.getElementById("searchPanel");
const viewModeSelect = document.getElementById("viewModeSelect");
const viewModeToggleBtn = document.getElementById("viewModeToggleBtn");
const viewModePanelEl = document.getElementById("viewModePanel");
const flipDefaultsEl = document.getElementById("flipDefaults");
const flipDefaultSelect = document.getElementById("flipDefaultSelect");

function setStatus(message, isError = false) {
  if (statusBarEl) {
    statusBarEl.textContent = message || "";
    statusBarEl.style.color = isError ? "#f97373" : "#9ca3af";
  }
}

/** 載入四個 JSON（單字、標籤、音節、構詞），enrich 後套用篩選；我的單字頁會再依本機 localStorage 的收藏篩選 */
async function loadData() {
  try {
    setStatus("載入資料中…");
    const [wordsRes, tagsRes, syllablesRes, morphsRes] = await Promise.all([
      fetch("words.json"),
      fetch("word_tags.json"),
      fetch("word_syllables.json"),
      fetch("word_morphs.json"),
    ]);

    if (!wordsRes.ok) throw new Error("無法載入 words.json");
    if (!tagsRes.ok) throw new Error("無法載入 word_tags.json");

    const [words, tags, syllables, morphs] = await Promise.all([
      wordsRes.json(),
      tagsRes.json(),
      syllablesRes.ok ? syllablesRes.json() : Promise.resolve([]),
      morphsRes.ok ? morphsRes.json() : Promise.resolve([]),
    ]);

    state.words = words || [];
    state.tags = tags || [];
    state.syllables = syllables || [];
    state.morphs = morphs || [];
    enrichWords();
    var defaultFilter = typeof getDefaultFilter !== "undefined" ? getDefaultFilter() : null;
    if (defaultFilter) {
      if (defaultFilter.language && defaultFilter.language.length) state.filters.language = defaultFilter.language.slice();
      if (defaultFilter.level && defaultFilter.level.length) state.filters.level = defaultFilter.level.slice();
    }
    buildFilterDropdowns();
    applyFiltersAndSearch();
    setStatus("資料載入完成。");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "資料載入失敗。", true);
  }
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function enrichWords() {
  const tagsByWordId = state.tags.reduce((acc, tag) => {
    if (!acc[tag.word_id]) acc[tag.word_id] = [];
    acc[tag.word_id].push(tag);
    return acc;
  }, {});

  state.enrichedWords = state.words.map((w) => {
    const tags = tagsByWordId[w.id] || [];
    const tagGroups = tags.reduce(
      (acc, t) => {
        if (!acc[t.tag_group]) acc[t.tag_group] = [];
        acc[t.tag_group].push(t);
        return acc;
      },
      { language: [], level: [], category: [] }
    );

    return {
      ...w,
      _tags: tags,
      _tagGroups: tagGroups,
    };
  });
}

function buildFilterDropdowns() {
  const groups = {
    language: new Map(),
    level: new Map(),
    category: new Map(),
  };

  for (const tag of state.tags) {
    if (!groups[tag.tag_group]) continue;
    if (!groups[tag.tag_group].has(tag.tag_key)) {
      groups[tag.tag_group].set(tag.tag_key, tag.tag_label);
    }
  }

  const ids = { language: "dropdownLanguage", level: "dropdownLevel", category: "dropdownCategory" };
  for (const groupKey of ["language", "level", "category"]) {
    const container = document.getElementById(ids[groupKey]);
    if (!container) continue;
    const map = groups[groupKey];
    const trigger = container.querySelector(".filter-dropdown__trigger");
    const panel = container.querySelector(".filter-dropdown__panel");
    if (!trigger || !panel) continue;

    panel.innerHTML = "";
    const allOpt = document.createElement("div");
    allOpt.className = "filter-dropdown__option";
    allOpt.setAttribute("data-value", "");
    allOpt.setAttribute("role", "option");
    allOpt.textContent = "全部";
    panel.appendChild(allOpt);

    const entries = Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "zh-Hant")
    );
    for (const [key, label] of entries) {
      const opt = document.createElement("div");
      opt.className = "filter-dropdown__option";
      opt.setAttribute("data-value", key);
      opt.setAttribute("role", "option");
      opt.textContent = label;
      panel.appendChild(opt);
    }

    function updateTriggerAndOptions() {
      const selected = state.filters[groupKey] || [];
      const arr = Array.isArray(selected) ? selected : [selected].filter(Boolean);
      if (arr.length === 0) {
        trigger.textContent = "請選擇";
      } else if (arr.length === 1) {
        const tag = state.tags.find((t) => t.tag_group === groupKey && t.tag_key === arr[0]);
        trigger.textContent = tag ? tag.tag_label : arr[0];
      } else {
        trigger.textContent = `已選 ${arr.length} 項`;
      }
      const set = new Set(arr);
      panel.querySelectorAll(".filter-dropdown__option").forEach((o) => {
        const v = o.getAttribute("data-value");
        o.classList.toggle("is-selected", v ? set.has(v) : set.size === 0);
      });
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      trigger.setAttribute("aria-expanded", (!isOpen).toString());
      if (!isOpen) updateTriggerAndOptions();
    });

    panel.querySelectorAll(".filter-dropdown__option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const value = opt.getAttribute("data-value");
        let arr = state.filters[groupKey] || [];
        arr = Array.isArray(arr) ? [...arr] : [arr].filter(Boolean);
        if (value === "") {
          state.filters[groupKey] = [];
        } else {
          const idx = arr.indexOf(value);
          if (idx >= 0) arr.splice(idx, 1);
          else arr.push(value);
          state.filters[groupKey] = arr;
        }
        applyFiltersAndSearch();
        updateTriggerAndOptions();
      });
    });

    updateTriggerAndOptions();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest(".filter-dropdown")) return;
    document.querySelectorAll(".filter-dropdown__panel").forEach((p) => {
      p.hidden = true;
    });
    document.querySelectorAll(".filter-dropdown__trigger").forEach((t) => {
      t.setAttribute("aria-expanded", "false");
    });
  });
}

function applyFiltersAndSearch() {
  // 基底：我的單字頁＝僅收藏；查看單字頁＝全部
  let base = state.enrichedWords;
  if (document.body.classList.contains("page-saved")) {
    const savedIds = typeof getSavedWords !== "undefined" ? getSavedWords() : [];
    const savedSet = new Set(savedIds.map((x) => String(x)));
    base = base.filter((w) => savedSet.has(String(w.id)));
  }
  base = base.filter((w) => w.published === "TRUE");

  const search = state.searchText.trim().toLowerCase();
  const { language, level, category } = state.filters;
  const langArr = Array.isArray(language) ? language : language ? [language] : [];
  const levelArr = Array.isArray(level) ? level : level ? [level] : [];
  const catArr = Array.isArray(category) ? category : category ? [category] : [];

  let result = base.filter((w) => {
    if (langArr.length > 0) {
      const hasLanguage =
        langArr.includes(w.language) ||
        (w._tagGroups.language || []).some((t) => langArr.includes(t.tag_key));
      if (!hasLanguage) return false;
    }

    if (levelArr.length > 0) {
      const hasLevel =
        levelArr.includes(w.level) ||
        (w._tagGroups.level || []).some((t) => levelArr.includes(t.tag_key));
      if (!hasLevel) return false;
    }

    if (catArr.length > 0) {
      const hasCategory =
        catArr.includes(w.category) ||
        (w._tagGroups.category || []).some((t) => catArr.includes(t.tag_key));
      if (!hasCategory) return false;
    }

    if (!search) return true;

    const fields = [
      w.word,
      w.display_word,
      w.meaning_short,
      w.meaning_full,
      typeof w.search_aliases === "string" ? w.search_aliases : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return fields.includes(search);
  });

  result = result.filter((w) => w.published === "TRUE");

  state.filteredWords = result;

  if (state.currentCardIndex >= state.filteredWords.length) {
    state.currentCardIndex =
      state.filteredWords.length > 0 ? state.filteredWords.length - 1 : 0;
  }

  renderSummary();
  renderCard();
  renderTable();
  updateCardControls();
}

function renderSummary() {
  if (!summaryCountEl) return;
  const total = state.filteredWords.length;
  summaryCountEl.textContent = `共 ${total} 筆單字`;

  summaryFiltersEl.innerHTML = "";
  const pills = [];

  const langArr = state.filters.language || [];
  const langKeys = Array.isArray(langArr) ? langArr : [langArr].filter(Boolean);
  if (langKeys.length > 0) {
    const labels = langKeys
      .map((k) => state.tags.find((t) => t.tag_group === "language" && t.tag_key === k)?.tag_label || k)
      .filter(Boolean);
    if (labels.length) pills.push({ label: `語言：${labels.join("、")}` });
  }

  const levelArr = state.filters.level || [];
  const levelKeys = Array.isArray(levelArr) ? levelArr : [levelArr].filter(Boolean);
  if (levelKeys.length > 0) {
    const labels = levelKeys
      .map((k) => state.tags.find((t) => t.tag_group === "level" && t.tag_key === k)?.tag_label || k)
      .filter(Boolean);
    if (labels.length) pills.push({ label: `級別：${labels.join("、")}` });
  }

  const catArr = state.filters.category || [];
  const catKeys = Array.isArray(catArr) ? catArr : [catArr].filter(Boolean);
  if (catKeys.length > 0) {
    const labels = catKeys
      .map((k) => state.tags.find((t) => t.tag_group === "category" && t.tag_key === k)?.tag_label || k)
      .filter(Boolean);
    if (labels.length) pills.push({ label: `分類：${labels.join("、")}` });
  }

  if (state.searchText.trim()) {
    pills.push({ label: `關鍵字：「${state.searchText.trim()}」` });
  }

  for (const pill of pills) {
    const span = document.createElement("span");
    span.className = "summary-pill";
    span.textContent = pill.label;
    summaryFiltersEl.appendChild(span);
  }
}

function renderCard() {
  if (!cardEl) return;
  const list = state.filteredWords;

  if (!list.length) {
    cardEl.classList.add("word-card--empty");
    cardEl.innerHTML = `
      <div class="word-card__body">
        <p class="word-card__placeholder">
          找不到符合條件的單字。請調整搜尋或篩選。
        </p>
      </div>
    `;
    if (cardIndexLabelEl) cardIndexLabelEl.textContent = "";
    return;
  }

  cardEl.classList.remove("word-card--empty");
  const word = list[state.currentCardIndex];
  const languageLabel =
    (word._tagGroups.language?.[0]?.tag_label || word.language) ?? "";
  const levelLabel = (word._tagGroups.level?.[0]?.tag_label || word.level) ?? "";
  const categoryLabel =
    (word._tagGroups.category?.[0]?.tag_label || word.category) ?? "";

  const syllables = state.syllables
    .filter((s) => s.word_id === word.id)
    .sort((a, b) => {
      const ta = Number(safeNumber(a.token_position, 1));
      const tb = Number(safeNumber(b.token_position, 1));
      if (ta !== tb) return ta - tb;
      const pa = Number(safeNumber(a.position, 0));
      const pb = Number(safeNumber(b.position, 0));
      return pa - pb;
    });

  const morphs = state.morphs
    .filter((m) => m.word_id === word.id)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  const showMorphs = state.showMorphsOnCard && morphs.length > 0;

  const hasSyllables = syllables.length > 0 && state.showSyllablesOnCard;

  // 單一 token 字數 > 8 時，每多一字縮小 5%（不與 token 換行規則衝突）
  function getTokenScale(charCount) {
    if (charCount <= 8) return 1;
    const scale = 1 - (charCount - 8) * 0.05;
    return Math.max(0.5, scale);
  }

  // 依 token_position 分組，取得每個 token 的文字（供非音節模式同一 token 不換行使用）
  function getTokenTextsFromSyllables(syls) {
    if (!syls || !syls.length) return [];
    const groups = [];
    let current = [];
    let currentPos = null;
    for (const s of syls) {
      const tokenPos = Number(s.token_position || 1);
      if (currentPos !== null && currentPos !== tokenPos) {
        groups.push(current.join(""));
        current = [];
      }
      currentPos = tokenPos;
      current.push(s.syllable || s.form || "");
    }
    if (current.length) groups.push(current.join(""));
    return groups;
  }

  // 基礎「族語」顯示（會套用詞構 / 音節）
  let baseWordHtml;

  if (showMorphs) {
    const rootMorph = morphs.find((m) => m.morph_type === "root");
    const infixMorph = morphs.find((m) => m.morph_type === "infix");
    const rootForm =
      (rootMorph && (rootMorph.display_label || rootMorph.form)) ||
      word.word ||
      word.display_word ||
      "";

    const pieces = [];

    if (infixMorph && rootForm.length > 0) {
      const firstChar = rootForm.slice(0, 1);
      const restChars = rootForm.slice(1);
      const infixText = infixMorph.display_label || infixMorph.form || "";
      const infixLen = (infixMorph.form || infixText || "").length;

      pieces.push({ text: firstChar, type: "root", len: firstChar.length });
      pieces.push({ text: infixText, type: "infix", len: infixLen });
      pieces.push({ text: restChars, type: "root", len: restChars.length });
    } else {
      for (const m of morphs) {
        const text = m.display_label || m.form || "";
        if (!text) continue;
        const logicalLen = (m.form || text).length;
        pieces.push({ text, type: m.morph_type, len: logicalLen });
      }
    }

    const tokenTexts = getTokenTextsFromSyllables(syllables);
    if (tokenTexts.length > 0) {
      // 依 token 邊界切分 pieces，同一 token_position 包成一個 word-token
      const tokenLengths = tokenTexts.map((t) => t.length);
      const tokenPiecesList = [];
      let pieceIdx = 0;
      let charInPiece = 0;
      for (const len of tokenLengths) {
        let taken = 0;
        const tokenPieces = [];
        while (taken < len && pieceIdx < pieces.length) {
          const p = pieces[pieceIdx];
          const rest = (p.len || p.text.length) - charInPiece;
          const need = len - taken;
          if (rest <= need) {
            tokenPieces.push({
              text: p.text.slice(charInPiece),
              type: p.type,
              len: rest,
            });
            taken += rest;
            pieceIdx++;
            charInPiece = 0;
          } else {
            tokenPieces.push({
              text: p.text.slice(charInPiece, charInPiece + need),
              type: p.type,
              len: need,
            });
            taken += need;
            charInPiece += need;
          }
        }
        tokenPiecesList.push(tokenPieces);
      }
      baseWordHtml = tokenPiecesList
        .map(
          (tps) => {
            // 構詞模式：縮放字數以實際顯示字元計（含 -、~ 等符號）
            const displayLen = tps.reduce((sum, p) => sum + (p.text || "").length, 0);
            return `<span class="word-token" style="--token-scale: ${getTokenScale(displayLen)}">${tps
              .map(
                (p) =>
                  `<span class="morph-inline morph-inline--${p.type}">${p.text}</span>`
              )
              .join("")}</span>`;
          }
        )
        .join(" ");
    } else {
      const singleLen = pieces.reduce((s, p) => s + (p.len || p.text.length), 0);
      baseWordHtml = `<span class="word-token" style="--token-scale: ${getTokenScale(singleLen)}">${pieces
        .map(
          (p) =>
            `<span class="morph-inline morph-inline--${p.type}">${p.text}</span>`
        )
        .join("")}</span>`;
    }
  } else if (hasSyllables && syllables.length) {
    // 音節顯示僅依 token_position、position 與 syllable（或 form），不使用 normalized
    // 相同 token_position 包成 syllable-token，不換行
    const tokenGroups = [];
    let currentToken = [];
    let currentTokenLen = 0;
    let currentPos = null;

    for (const s of syllables) {
      const tokenPos = Number(s.token_position || 1);
      if (currentPos !== null && currentPos !== tokenPos) {
        tokenGroups.push({
          html: `<span class="syllable-token" style="--token-scale: ${getTokenScale(currentTokenLen)}">${currentToken.join("")}</span>`,
        });
        currentToken = [];
        currentTokenLen = 0;
      }
      currentPos = tokenPos;
      const sy = s.syllable || s.form || "";
      currentTokenLen += sy.length;
      currentToken.push(
        `<span class="syllable-inline">${sy}</span>`
      );
    }
    if (currentToken && currentToken.length) {
      tokenGroups.push({
        html: `<span class="syllable-token" style="--token-scale: ${getTokenScale(currentTokenLen)}">${currentToken.join("")}</span>`,
      });
    }

    baseWordHtml = tokenGroups.map((g) => g.html).join(" ");
  } else {
    const tokenTexts = getTokenTextsFromSyllables(syllables);
    if (tokenTexts.length > 0) {
      baseWordHtml = tokenTexts
        .map(
          (t) =>
            `<span class="word-token" style="--token-scale: ${getTokenScale(t.length)}">${t}</span>`
        )
        .join(" ");
    } else {
      const raw = word.display_word || word.word || "—";
      baseWordHtml = `<span class="word-token" style="--token-scale: ${getTokenScale(raw.length)}">${raw}</span>`;
    }
  }

  const saved = typeof isSavedWord !== "undefined" && isSavedWord(word.id);
  const starChar = saved ? "★" : "☆";
  const starLabel = saved ? "取消收藏" : "收藏";
  const starWrap = `<div class="word-card__star-wrap"><button type="button" class="word-card__star" data-word-id="${word.id}" aria-label="${starLabel}" aria-pressed="${saved}">${starChar}</button></div>`;

  // 翻牌模式：只顯示一面（族語或華語），族語面仍套用詞構 / 音節
  if (state.viewMode === "flip") {
    const displayMeaning = word.meaning_short || "—";
    let mainHtml;

    if (!state.flipIsBack) {
      mainHtml =
        state.flipDefaultSide === "word" ? baseWordHtml : displayMeaning;
    } else {
      mainHtml =
        state.flipDefaultSide === "word" ? displayMeaning : baseWordHtml;
    }

    cardEl.innerHTML = `
      <div class="word-card__body">
        ${starWrap}
        <div class="word-card__top">
          <div class="word-card__word">${mainHtml}</div>
        </div>
      </div>
    `;

    if (cardIndexLabelEl) cardIndexLabelEl.textContent = `${state.currentCardIndex + 1} / ${list.length}`;
    return;
  }

  const wordContentHtml = baseWordHtml;
  const notesText = (word.notes && String(word.notes).trim()) || "";
  const synonymsText = (word.synonyms && String(word.synonyms).trim()) || "";
  const notesSymbol = notesText ? "▾" : "▿";
  const esc = (s) => {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  cardEl.innerHTML = `
    <div class="word-card__body">
      ${starWrap}
      <div class="word-card__top">
        <div class="word-card__word">${wordContentHtml}</div>
      </div>
      <div class="word-card__meaning">${word.meaning_short || "—"}</div>
      <div class="word-card__notes is-collapsed" aria-hidden="true">
        <div class="word-card__notes-content">${esc(word.notes || "")}</div>
      </div>
      <div class="word-card__synonyms">${synonymsText ? "同義詞：" + esc(synonymsText) : ""}</div>
      <div class="word-card__footer">
        <div class="word-card__meta" aria-label="語言、級別、分類">
          ${
            languageLabel
              ? `<span class="meta-pill">${languageLabel}</span>`
              : ""
          }
          ${
            levelLabel ? `<span class="meta-pill">${levelLabel}</span>` : ""
          }
          ${
            categoryLabel
              ? `<span class="meta-pill">${categoryLabel}</span>`
              : ""
          }
        </div>
        <button type="button" class="word-card__notes-toggle${notesText ? " word-card__notes-toggle--has-notes" : ""}" ${notesText ? "" : "disabled"} aria-expanded="false" aria-label="展開註解">${notesSymbol}</button>
      </div>
    </div>
  `;

  const notesBlock = cardEl.querySelector(".word-card__notes");
  const notesToggle = cardEl.querySelector(".word-card__notes-toggle");
  if (notesToggle && notesBlock && notesText) {
    notesToggle.addEventListener("click", () => {
      const collapsed = notesBlock.classList.toggle("is-collapsed");
      notesToggle.setAttribute("aria-expanded", (!collapsed).toString());
      notesBlock.setAttribute("aria-hidden", collapsed.toString());
    });
  }

  if (cardIndexLabelEl) cardIndexLabelEl.textContent = `${state.currentCardIndex + 1} / ${list.length}`;
}

function renderTable() {
  if (!wordTableBodyEl) return;
  const list = state.filteredWords;
  wordTableBodyEl.innerHTML = "";

  const esc = (s) => {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  if (!list.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "目前沒有符合條件的單字。";
    td.style.textAlign = "center";
    tr.appendChild(td);
    wordTableBodyEl.appendChild(tr);
    return;
  }

  for (const w of list) {
    const synonymsText = (w.synonyms && String(w.synonyms).trim()) || "";
    const notesText = (w.notes && String(w.notes).trim()) || "";
    const hasAny = synonymsText || notesText;
    const symbol = hasAny ? "▾" : "▿";
    const rowSaved = typeof isSavedWord !== "undefined" && isSavedWord(w.id);
    const rowStarChar = rowSaved ? "★" : "☆";
    const rowStarLabel = rowSaved ? "取消收藏" : "收藏";

    let languageLabel =
      (w._tagGroups.language?.[0]?.tag_label || w.language) ?? "";
    let levelLabel =
      (w._tagGroups.level?.[0]?.tag_label || w.level) ?? "";
    languageLabel = String(languageLabel).replace(/阿美/g, "");
    levelLabel = String(levelLabel).replace(/級/g, "");

    const mainTr = document.createElement("tr");
    mainTr.innerHTML = `
      <td class="word-table__star-cell">
        <button type="button" class="word-table__star" data-word-id="${w.id}" aria-label="${rowStarLabel}" aria-pressed="${rowSaved}">${rowStarChar}</button>
      </td>
      <td>${w.word || w.display_word || ""}</td>
      <td>${w.meaning_short || ""}</td>
      <td>${languageLabel}</td>
      <td>${levelLabel}</td>
      <td class="word-table__toggle-cell">
        <button type="button" class="word-table__toggle${hasAny ? " word-table__toggle--has-notes" : ""}" ${hasAny ? "" : "disabled"} aria-expanded="false" aria-label="展開同義詞與註解">${symbol}</button>
      </td>
    `;
    wordTableBodyEl.appendChild(mainTr);

    const detailTr = document.createElement("tr");
    detailTr.className = "word-table__detail-row is-collapsed";
    const lines = [];
    if (synonymsText) lines.push(`同義詞：${esc(synonymsText)}`);
    if (notesText) lines.push(`註解：${esc(notesText)}`);
    detailTr.innerHTML = `<td colspan="6" class="word-table__detail-cell"><div class="word-table__detail-content">${lines.map((line) => `<div>${line}</div>`).join("")}</div></td>`;
    wordTableBodyEl.appendChild(detailTr);
  }
}

function updateCardControls() {
  if (!prevCardBtn || !nextCardBtn || !randomCardBtn) return;
  const count = state.filteredWords.length;
  const disabled = count === 0;
  prevCardBtn.disabled = disabled || count <= 1;
  nextCardBtn.disabled = disabled || count <= 1;
  randomCardBtn.disabled = disabled || count <= 1;
  if (toggleAnswerBtn) {
    const isFlip = state.viewMode === "flip";
    toggleAnswerBtn.disabled = disabled || !isFlip;
    toggleAnswerBtn.classList.toggle(
      "is-on",
      !toggleAnswerBtn.disabled && state.flipIsBack
    );
  }
  if (toggleSyllableBtn) {
    toggleSyllableBtn.disabled = disabled || !state.syllables.length;
    toggleSyllableBtn.classList.toggle(
      "is-on",
      !toggleSyllableBtn.disabled && state.showSyllablesOnCard
    );
  }
  if (toggleMorphBtn) {
    toggleMorphBtn.disabled = disabled || !state.morphs.length;
    toggleMorphBtn.classList.toggle(
      "is-on",
      !toggleMorphBtn.disabled && state.showMorphsOnCard
    );
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  if (cardViewEl && listViewEl) {
    if (mode === "card" || mode === "flip") {
      cardViewEl.classList.remove("is-hidden");
      listViewEl.classList.add("is-hidden");
    } else {
      cardViewEl.classList.add("is-hidden");
      listViewEl.classList.remove("is-hidden");
    }
  }

  if (viewModeSelect && viewModeSelect.value !== mode) {
    viewModeSelect.value = mode;
  }

  const isFlip = mode === "flip";
  if (flipDefaultsEl) {
    flipDefaultsEl.classList.toggle("is-hidden", !isFlip);
  }

  if (isFlip) {
    state.flipIsBack = false;
  }
}

// 事件綁定（僅在 vocabulary 頁存在對應 DOM 時綁定）
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    state.searchText = e.target.value;
    applyFiltersAndSearch();
  });
}

if (wordTableBodyEl) {
  wordTableBodyEl.addEventListener("click", (e) => {
    const starBtn = e.target.closest(".word-table__star");
    if (starBtn && typeof toggleSavedWord !== "undefined") {
      const id = starBtn.getAttribute("data-word-id");
      if (id) {
        toggleSavedWord(id);
        if (document.body.classList.contains("page-saved")) {
          applyFiltersAndSearch();
        } else {
          renderTable();
        }
      }
      return;
    }
    const btn = e.target.closest(".word-table__toggle:not(:disabled)");
    if (!btn) return;
    const row = btn.closest("tr");
    const detailRow = row && row.nextElementSibling;
    if (detailRow && detailRow.classList.contains("word-table__detail-row")) {
      const collapsed = detailRow.classList.toggle("is-collapsed");
      btn.setAttribute("aria-expanded", (!collapsed).toString());
    }
  });
}

if (viewModeSelect) {
  viewModeSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    setViewMode(value);
    renderCard();
    updateCardControls();
    if (viewModePanelEl) {
      viewModePanelEl.classList.add("is-collapsed");
    }
  });
}

// 我的單字／所有單字：顯示模式與翻面預設改用自訂 dropdown，同步到隱藏的 select
const viewModeDropdown = document.getElementById("viewModeDropdown");
if (viewModeDropdown && viewModeSelect) {
  const trigger = viewModeDropdown.querySelector(".filter-dropdown__trigger");
  const panel = viewModeDropdown.querySelector(".filter-dropdown__panel");
  if (trigger && panel) {
    function updateViewModeTrigger() {
      const val = viewModeSelect.value || "card";
      const map = { card: "字卡模式", flip: "翻牌模式", list: "列表模式" };
      trigger.textContent = map[val] || "字卡模式";
      panel.querySelectorAll(".filter-dropdown__option").forEach((opt) => {
        const v = opt.getAttribute("data-value");
        opt.classList.toggle("is-selected", v === val);
      });
    }
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      trigger.setAttribute("aria-expanded", (!isOpen).toString());
      if (!isOpen) updateViewModeTrigger();
    });
    panel.querySelectorAll(".filter-dropdown__option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.getAttribute("data-value");
        if (!v) return;
        if (viewModeSelect.value !== v) {
          viewModeSelect.value = v;
          viewModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        updateViewModeTrigger();
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      });
    });
    updateViewModeTrigger();
  }
}

const flipDefaultDropdown = document.getElementById("flipDefaultDropdown");
if (flipDefaultDropdown && flipDefaultSelect) {
  const trigger = flipDefaultDropdown.querySelector(".filter-dropdown__trigger");
  const panel = flipDefaultDropdown.querySelector(".filter-dropdown__panel");
  if (trigger && panel) {
    function updateFlipTrigger() {
      const val = flipDefaultSelect.value || "word";
      const map = { word: "族語", meaning: "華語" };
      trigger.textContent = map[val] || "族語";
      panel.querySelectorAll(".filter-dropdown__option").forEach((opt) => {
        const v = opt.getAttribute("data-value");
        opt.classList.toggle("is-selected", v === val);
      });
    }
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      trigger.setAttribute("aria-expanded", (!isOpen).toString());
      if (!isOpen) updateFlipTrigger();
    });
    panel.querySelectorAll(".filter-dropdown__option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.getAttribute("data-value");
        if (!v) return;
        if (flipDefaultSelect.value !== v) {
          flipDefaultSelect.value = v;
          flipDefaultSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        updateFlipTrigger();
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      });
    });
    updateFlipTrigger();
  }
}

if (prevCardBtn) {
  prevCardBtn.addEventListener("click", () => {
    if (!state.filteredWords.length) return;
    state.currentCardIndex =
      (state.currentCardIndex - 1 + state.filteredWords.length) %
      state.filteredWords.length;
    renderCard();
    updateCardControls();
  });
}

if (nextCardBtn) {
  nextCardBtn.addEventListener("click", () => {
    if (!state.filteredWords.length) return;
    state.currentCardIndex =
      (state.currentCardIndex + 1) % state.filteredWords.length;
    renderCard();
    updateCardControls();
  });
}

if (randomCardBtn) {
  randomCardBtn.addEventListener("click", () => {
    const len = state.filteredWords.length;
    if (!len) return;
    let index = Math.floor(Math.random() * len);
    if (len > 1 && index === state.currentCardIndex) {
      index = (index + 1) % len;
    }
    state.currentCardIndex = index;
    renderCard();
    updateCardControls();
  });
}

if (toggleSyllableBtn) {
  toggleSyllableBtn.addEventListener("click", () => {
    state.showSyllablesOnCard = !state.showSyllablesOnCard;
    renderCard();
    updateCardControls();
  });
}

if (toggleMorphBtn) {
  toggleMorphBtn.addEventListener("click", () => {
    state.showMorphsOnCard = !state.showMorphsOnCard;
    renderCard();
    updateCardControls();
  });
}

if (toggleAnswerBtn) {
  toggleAnswerBtn.addEventListener("click", () => {
    if (state.viewMode !== "flip") return;
    state.flipIsBack = !state.flipIsBack;
    renderCard();
    updateCardControls();
  });
}

// word-card 手勢：左右滑動切換上一張／下一張；翻卡模式下上下滑動顯示答案
const SWIPE_MIN_DISTANCE = 50;
let cardTouchStartX = null;
let cardTouchStartY = null;

if (cardEl) {
  cardEl.addEventListener("click", (e) => {
    const starBtn = e.target.closest(".word-card__star");
    if (starBtn && typeof toggleSavedWord !== "undefined") {
      const id = starBtn.getAttribute("data-word-id");
      if (id) {
        toggleSavedWord(id);
        if (document.body.classList.contains("page-saved")) {
          applyFiltersAndSearch();
        } else {
          renderCard();
          updateCardControls();
        }
      }
    }
  });
  cardEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        cardTouchStartX = e.changedTouches[0].clientX;
        cardTouchStartY = e.changedTouches[0].clientY;
      }
    },
    { passive: true }
  );

  cardEl.addEventListener(
    "touchend",
    (e) => {
      if (
        cardTouchStartX == null ||
        cardTouchStartY == null ||
        !e.changedTouches ||
        !e.changedTouches[0]
      )
        return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - cardTouchStartX;
      const deltaY = endY - cardTouchStartY;
      cardTouchStartX = null;
      cardTouchStartY = null;

      const list = state.filteredWords;
      if (!list.length) return;
      if (state.viewMode !== "card" && state.viewMode !== "flip") return;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // 翻卡模式：上下滑動視為「看答案」（以垂直為主）
      if (
        state.viewMode === "flip" &&
        absY >= SWIPE_MIN_DISTANCE &&
        absY >= absX
      ) {
        state.flipIsBack = !state.flipIsBack;
        renderCard();
        updateCardControls();
        return;
      }

      // 左右滑動：上一張／下一張
      if (deltaX > SWIPE_MIN_DISTANCE) {
        state.currentCardIndex =
          (state.currentCardIndex - 1 + list.length) % list.length;
        renderCard();
        updateCardControls();
      } else if (deltaX < -SWIPE_MIN_DISTANCE) {
        state.currentCardIndex = (state.currentCardIndex + 1) % list.length;
        renderCard();
        updateCardControls();
      }
    },
    { passive: true }
  );
}

if (flipDefaultSelect) {
  flipDefaultSelect.addEventListener("change", (e) => {
    const value = e.target.value === "meaning" ? "meaning" : "word";
    state.flipDefaultSide = value;
    state.flipIsBack = false;
    if (state.viewMode === "flip") {
      renderCard();
    }
  });
}

if (searchToggleBtn) {
  searchToggleBtn.addEventListener("click", () => {
    const collapsed = searchPanelEl.classList.toggle("is-collapsed");
    searchToggleBtn.setAttribute("aria-expanded", (!collapsed).toString());
  });
}

if (viewModeToggleBtn && viewModePanelEl) {
  viewModeToggleBtn.addEventListener("click", () => {
    const collapsed = viewModePanelEl.classList.toggle("is-collapsed");
    viewModeToggleBtn.setAttribute("aria-expanded", (!collapsed).toString());
  });
}

// 初始化：vocabulary 頁或我的單字頁
document.addEventListener("DOMContentLoaded", () => {
  const isVocabulary = document.getElementById("searchInput");
  const isSavedPage = document.body.classList.contains("page-saved");
  if (!isVocabulary && !isSavedPage) return;
  setViewMode("card");
  loadData().then(() => {
    if (isSavedPage) return;
    // 支援依 word_id 定位字卡：vocabulary.html?id=W0001（首頁今日單字「查看單字」）或 ?random=W0001
    const params = new URLSearchParams(window.location.search);
    const wordId = params.get("id") || params.get("random");
    if (wordId && state.filteredWords.length) {
      const idx = state.filteredWords.findIndex((w) => String(w.id) === String(wordId));
      if (idx >= 0) {
        state.currentCardIndex = idx;
        renderCard();
        renderTable();
        updateCardControls();
      }
    }
  });
});
