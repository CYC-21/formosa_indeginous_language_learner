/**
 * 設定頁：全域預設篩選、今日單字設定
 * 依 word_tags.json 建立選項，讀寫 getDefaultFilter / setDefaultFilter、getDailyWordFilter / setDailyWordFilter
 */
(function () {
  const DEFAULT_IDS = ["settingsDefaultLanguage", "settingsDefaultLevel"];
  const DAILY_IDS = ["settingsDailyLanguage", "settingsDailyLevel", "settingsDailyCategory"];
  const GROUP_KEYS = { settingsDefaultLanguage: "language", settingsDefaultLevel: "level", settingsDailyLanguage: "language", settingsDailyLevel: "level", settingsDailyCategory: "category" };

  let tags = [];
  let groups = { language: new Map(), level: new Map(), category: new Map() };
  const state = { default: { language: [], level: [] }, daily: { language: [], level: [], category: [] } };

  function getStateSlice(containerId) {
    if (containerId === "settingsDefaultLanguage") return { obj: state.default, key: "language" };
    if (containerId === "settingsDefaultLevel") return { obj: state.default, key: "level" };
    if (containerId === "settingsDailyLanguage") return { obj: state.daily, key: "language" };
    if (containerId === "settingsDailyLevel") return { obj: state.daily, key: "level" };
    if (containerId === "settingsDailyCategory") return { obj: state.daily, key: "category" };
    return null;
  }

  function updateTrigger(container) {
    const slice = getStateSlice(container.id);
    if (!slice) return;
    const arr = slice.obj[slice.key] || [];
    const trigger = container.querySelector(".filter-dropdown__trigger");
    const panel = container.querySelector(".filter-dropdown__panel");
    if (!trigger || !panel) return;
    if (arr.length === 0) {
      trigger.textContent = "請選擇";
    } else if (arr.length === 1) {
      const tag = tags.find(function (t) { return t.tag_group === slice.key && t.tag_key === arr[0]; });
      trigger.textContent = tag ? tag.tag_label : arr[0];
    } else {
      trigger.textContent = "已選 " + arr.length + " 項";
    }
    const set = new Set(arr);
    panel.querySelectorAll(".filter-dropdown__option").forEach(function (o) {
      const v = o.getAttribute("data-value");
      o.classList.toggle("is-selected", v ? set.has(v) : set.size === 0);
    });
  }

  function buildDropdown(container, groupKey) {
    const map = groups[groupKey];
    const trigger = container.querySelector(".filter-dropdown__trigger");
    const panel = container.querySelector(".filter-dropdown__panel");
    if (!trigger || !panel || !map) return;
    panel.innerHTML = "";
    const allOpt = document.createElement("div");
    allOpt.className = "filter-dropdown__option";
    allOpt.setAttribute("data-value", "");
    allOpt.setAttribute("role", "option");
    allOpt.textContent = "全部";
    panel.appendChild(allOpt);
    const entries = Array.from(map.entries()).sort(function (a, b) { return (a[1] || "").localeCompare(b[1] || "", "zh-Hant"); });
    entries.forEach(function (kv) {
      const opt = document.createElement("div");
      opt.className = "filter-dropdown__option";
      opt.setAttribute("data-value", kv[0]);
      opt.setAttribute("role", "option");
      opt.textContent = kv[1];
      panel.appendChild(opt);
    });

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      trigger.setAttribute("aria-expanded", (!panel.hidden).toString());
      if (panel.hidden) updateTrigger(container);
    });

    panel.querySelectorAll(".filter-dropdown__option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        const slice = getStateSlice(container.id);
        if (!slice) return;
        const value = opt.getAttribute("data-value");
        var arr = slice.obj[slice.key] || [];
        arr = Array.isArray(arr) ? arr.slice() : [arr].filter(Boolean);
        if (value === "") {
          slice.obj[slice.key] = [];
        } else {
          var idx = arr.indexOf(value);
          if (idx >= 0) arr.splice(idx, 1);
          else arr.push(value);
          slice.obj[slice.key] = arr;
        }
        updateTrigger(container);
      });
    });

    updateTrigger(container);
  }

  function loadInitialState() {
    const def = typeof getDefaultFilter !== "undefined" ? getDefaultFilter() : null;
    state.default = def ? { language: def.language || [], level: def.level || [] } : { language: [], level: [] };
    const daily = typeof getDailyWordFilter !== "undefined" ? getDailyWordFilter() : null;
    const defFallback = def || { language: [], level: [] };
    state.daily = {
      language: (daily && daily.language && daily.language.length) ? daily.language : (defFallback.language || []),
      level: (daily && daily.level && daily.level.length) ? daily.level : (defFallback.level || []),
      category: (daily && daily.category) ? daily.category : []
    };
  }

  function saveDefault() {
    if (typeof setDefaultFilter !== "undefined") {
      setDefaultFilter(state.default);
      if (document.getElementById("settingsSaveDefaultBtn")) document.getElementById("settingsSaveDefaultBtn").textContent = "已儲存";
      setTimeout(function () {
        var btn = document.getElementById("settingsSaveDefaultBtn");
        if (btn) btn.textContent = "儲存全域預設";
      }, 1500);
    }
  }

  function saveDaily() {
    if (typeof setDailyWordFilter !== "undefined") {
      setDailyWordFilter(state.daily);
      var btn = document.getElementById("settingsSaveDailyBtn");
      if (btn) btn.textContent = "已儲存";
      setTimeout(function () {
        if (btn) btn.textContent = "儲存今日單字設定";
      }, 1500);
    }
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest(".filter-dropdown")) return;
    document.querySelectorAll(".filter-dropdown__panel").forEach(function (p) { p.hidden = true; });
    document.querySelectorAll(".filter-dropdown__trigger").forEach(function (t) { t.setAttribute("aria-expanded", "false"); });
  });

  fetch("word_tags.json")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("無法載入 word_tags.json")); })
    .then(function (data) {
      tags = data || [];
      groups = { language: new Map(), level: new Map(), category: new Map() };
      tags.forEach(function (tag) {
        if (groups[tag.tag_group] && !groups[tag.tag_group].has(tag.tag_key)) {
          groups[tag.tag_group].set(tag.tag_key, tag.tag_label);
        }
      });
      loadInitialState();
      DEFAULT_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) buildDropdown(el, GROUP_KEYS[id] || el.getAttribute("data-group"));
      });
      DAILY_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) buildDropdown(el, GROUP_KEYS[id] || el.getAttribute("data-group"));
      });
    })
    .catch(function () {
      loadInitialState();
    });

  var saveDefaultBtn = document.getElementById("settingsSaveDefaultBtn");
  if (saveDefaultBtn) saveDefaultBtn.addEventListener("click", saveDefault);
  var saveDailyBtn = document.getElementById("settingsSaveDailyBtn");
  if (saveDailyBtn) saveDailyBtn.addEventListener("click", saveDaily);
})();
