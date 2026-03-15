/**
 * Quiz：族語／華語對照（選擇）、輸入（打字）
 * 題庫來自 words.json，可選「全部單字」或「我的收藏」（本機 localStorage）
 */
(function () {
  const quizSetup = document.getElementById("quizSetup");
  const quizRun = document.getElementById("quizRun");
  const quizResult = document.getElementById("quizResult");
  const quizCount = document.getElementById("quizCount");
  const quizSource = document.getElementById("quizSource");
  const quizFilterLanguage = document.getElementById("quizFilterLanguage");
  const quizFilterLevel = document.getElementById("quizFilterLevel");
  const quizFilterCategory = document.getElementById("quizFilterCategory");
  const quizStartBtn = document.getElementById("quizStartBtn");
  const quizProgressText = document.getElementById("quizProgressText");
  const quizQuestionBlock = document.getElementById("quizQuestionBlock");
  const quizPrompt = document.getElementById("quizPrompt");
  const quizOptions = document.getElementById("quizOptions");
  const quizConfirmWrap = document.getElementById("quizConfirmWrap");
  const quizConfirmBtn = document.getElementById("quizConfirmBtn");
  const quizFeedback = document.getElementById("quizFeedback");
  const quizNextWrap = document.getElementById("quizNextWrap");
  const quizNextBtn = document.getElementById("quizNextBtn");
  const quizScoreText = document.getElementById("quizScoreText");
  const quizResultList = document.getElementById("quizResultList");
  const quizAgainBtn = document.getElementById("quizAgainBtn");

  let allWords = [];
  let allTags = [];
  let enrichedWords = [];
  let pool = [];
  /** 供選項用：同語言、同分類，級別不限（不足時從其他級別取） */
  let optionPool = [];
  let questions = [];
  let quizResults = [];
  let currentIndex = 0;
  let correctCount = 0;

  function enrichWordsForQuiz() {
    var tagsByWordId = {};
    (allTags || []).forEach(function (tag) {
      if (!tagsByWordId[tag.word_id]) tagsByWordId[tag.word_id] = [];
      tagsByWordId[tag.word_id].push(tag);
    });
    enrichedWords = (allWords || []).map(function (w) {
      var tags = tagsByWordId[w.id] || [];
      var tagGroups = { language: [], level: [], category: [] };
      tags.forEach(function (t) {
        if (tagGroups[t.tag_group]) tagGroups[t.tag_group].push(t);
      });
      return { word: w, _tagGroups: tagGroups };
    });
  }

  function showSection(section) {
    [quizSetup, quizRun, quizResult].forEach(function (el) {
      if (el) el.classList.add("is-hidden");
    });
    if (section) section.classList.remove("is-hidden");
  }

  function normalizeAnswer(s) {
    return String(s).trim().replace(/\s+/g, " ").toLowerCase();
  }

  function getPool(callback) {
    var published = allWords.filter(function (w) { return w.published === "TRUE"; });
    var base = enrichedWords.filter(function (e) {
      return published.some(function (w) { return w.id === e.word.id; });
    });
    if (typeof getSavedWords !== "undefined" && quizSource && quizSource.value === "saved") {
      var savedIds = getSavedWords();
      base = base.filter(function (e) { return savedIds.indexOf(String(e.word.id)) >= 0; });
    }
    var lang = (quizFilterLanguage && quizFilterLanguage.value) ? String(quizFilterLanguage.value).trim() : "";
    var lv = (quizFilterLevel && quizFilterLevel.value) ? String(quizFilterLevel.value).trim() : "";
    var cat = (quizFilterCategory && quizFilterCategory.value) ? String(quizFilterCategory.value).trim() : "";
    var baseStrict = base.filter(function (e) {
      var w = e;
      if (lang && !(w._tagGroups.language || []).some(function (t) { return t.tag_key === lang; })) return false;
      if (lv && !(w._tagGroups.level || []).some(function (t) { return t.tag_key === lv; })) return false;
      if (cat && !(w._tagGroups.category || []).some(function (t) { return t.tag_key === cat; })) return false;
      return true;
    });
    var baseOption = base.filter(function (e) {
      var w = e;
      if (lang && !(w._tagGroups.language || []).some(function (t) { return t.tag_key === lang; })) return false;
      if (cat && !(w._tagGroups.category || []).some(function (t) { return t.tag_key === cat; })) return false;
      return true;
    });
    pool = baseStrict.map(function (e) { return e.word; });
    optionPool = baseOption.map(function (e) { return e.word; });
    if (optionPool.length === 0) optionPool = pool.slice();
    if (callback) callback();
  }

  function fillFilterDropdowns() {
    var groups = { language: {}, level: {}, category: {} };
    (allTags || []).forEach(function (tag) {
      if (!groups[tag.tag_group]) return;
      if (!groups[tag.tag_group][tag.tag_key]) groups[tag.tag_group][tag.tag_key] = tag.tag_label;
    });
    function fillSelect(el, groupKey) {
      if (!el) return;
      var map = groups[groupKey] || {};
      var entries = Object.keys(map).map(function (k) { return [k, map[k]]; });
      entries.sort(function (a, b) { return (a[1] || "").localeCompare(b[1] || "", "zh-Hant"); });
      el.innerHTML = "";
      var optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = "全部";
      el.appendChild(optAll);
      entries.forEach(function (kv) {
        var o = document.createElement("option");
        o.value = kv[0];
        o.textContent = kv[1];
        el.appendChild(o);
      });
    }
    fillSelect(quizFilterLanguage, "language");
    fillSelect(quizFilterLevel, "level");
    fillSelect(quizFilterCategory, "category");
  }

  /** 題目可為同一單字的族語題與華語題各一；以 (word, direction) 槽位洗牌取前 N 題。 */
  function buildQuestions() {
    if (pool.length === 0) return;
    var slots = [];
    pool.forEach(function (w) {
      slots.push({ word: w, direction: "wordToMeaning" });
      slots.push({ word: w, direction: "meaningToWord" });
    });
    for (var j = slots.length - 1; j > 0; j--) {
      var r = Math.floor(Math.random() * (j + 1));
      var t = slots[j]; slots[j] = slots[r]; slots[r] = t;
    }
    var count = Math.min(parseInt(quizCount.value, 10) || 10, slots.length);
    questions = slots.slice(0, count).map(function (s) {
      return { word: s.word, type: "match", direction: s.direction };
    });
  }

  /** 取得錯誤選項（同義不重複）；來源為 optionPool（同語言、同分類、級別不限）。每題固定 4 選項，不足時以重複補滿。 */
  function getWrongOptions(correctValue, field, count, currentWord) {
    var values = [];
    var correctMeaning = currentWord ? (currentWord.meaning_short || currentWord.meaning_full || "").trim() : "";
    var source = optionPool.length > 0 ? optionPool : pool;
    var poolCopy = source.slice();
    var attempts = poolCopy.length * 2;
    while (values.length < count && attempts-- > 0) {
      var idx = Math.floor(Math.random() * poolCopy.length);
      var w = poolCopy[idx];
      if (field === "meaning") {
        var v = (w.meaning_short || w.meaning_full || "").trim();
        if (v && v !== correctValue && values.indexOf(v) < 0) values.push(v);
      } else {
        var v = (w.word || w.display_word || "").trim();
        var wMeaning = (w.meaning_short || w.meaning_full || "").trim();
        if (v && v !== correctValue && values.indexOf(v) < 0 && wMeaning !== correctMeaning) values.push(v);
      }
    }
    while (values.length < count && values.length > 0) {
      values.push(values[Math.floor(Math.random() * values.length)]);
    }
    return values.slice(0, count);
  }

  var selectedOptionValue = null;

  function showQuestion() {
    var q = questions[currentIndex];
    if (!q) {
      showResult();
      return;
    }
    var w = q.word;
    var total = questions.length;
    selectedOptionValue = null;
    quizProgressText.textContent = "第 " + (currentIndex + 1) + " / " + total + " 題";
    quizFeedback.classList.add("is-hidden");
    quizNextWrap.classList.add("is-hidden");
    quizOptions.classList.remove("is-hidden");
    if (quizConfirmWrap) quizConfirmWrap.classList.remove("is-hidden");
    if (quizConfirmBtn) {
      quizConfirmBtn.disabled = true;
    }

    var isWordToMeaning = q.direction === "wordToMeaning";
    var promptText = isWordToMeaning ? (w.word || w.display_word || "") : (w.meaning_short || w.meaning_full || "");
    var correctAnswer = isWordToMeaning ? (w.meaning_short || w.meaning_full || "") : (w.word || w.display_word || "");
    quizPrompt.textContent = promptText;
    var wrongs = getWrongOptions(correctAnswer, isWordToMeaning ? "meaning" : "word", 3, w);
    var options = [correctAnswer].concat(wrongs);
    for (var j = options.length - 1; j > 0; j--) {
      var r = Math.floor(Math.random() * (j + 1));
      var t = options[j]; options[j] = options[r]; options[r] = t;
    }
    quizOptions.innerHTML = "";
    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = opt;
      btn.setAttribute("data-value", opt);
      btn.setAttribute("data-correct", opt === correctAnswer ? "true" : "false");
      quizOptions.appendChild(btn);
    });
  }

  function checkMatch(selectedValue) {
    var q = questions[currentIndex];
    if (!q) return;
    var w = q.word;
    var correct = q.direction === "wordToMeaning" ? (w.meaning_short || w.meaning_full || "") : (w.word || w.display_word || "");
    var right = selectedValue === correct;
    if (right) correctCount++;
    var promptText = q.direction === "wordToMeaning" ? (w.word || w.display_word || "") : (w.meaning_short || w.meaning_full || "");
    quizResults.push({
      word: w,
      direction: q.direction,
      promptText: promptText,
      correctAnswer: correct,
      userAnswer: selectedValue,
      correct: right
    });
    quizFeedback.textContent = right ? "答對了！" : "答錯了，正確為：「" + correct + "」";
    quizFeedback.classList.remove("is-hidden");
    quizFeedback.classList.toggle("quiz-feedback--correct", right);
    quizFeedback.classList.toggle("quiz-feedback--wrong", !right);
    quizNextWrap.classList.remove("is-hidden");
    if (quizConfirmWrap) quizConfirmWrap.classList.add("is-hidden");
    if (quizConfirmBtn) quizConfirmBtn.disabled = true;
    quizOptions.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.disabled = true;
    });
  }

  function nextQuestion() {
    currentIndex++;
    if (currentIndex >= questions.length) {
      showResult();
      return;
    }
    showQuestion();
  }

  function showResult() {
    showSection(quizResult);
    var total = questions.length;
    quizScoreText.textContent = "答對 " + correctCount + " / " + total + " 題";
    if (!quizResultList) return;
    quizResultList.innerHTML = "";
    quizResults.forEach(function (r, i) {
      var item = document.createElement("div");
      item.className = "quiz-result-item";
      var isWordToMeaning = r.direction === "wordToMeaning";
      var promptLabel = isWordToMeaning ? "族語" : "華語";
      var answerLabel = isWordToMeaning ? "華語" : "族語";
      var saved = typeof isSavedWord !== "undefined" && isSavedWord(r.word.id);
      var starChar = saved ? "★" : "☆";
      item.innerHTML =
        "<div class=\"quiz-result-item__row\">" +
          "<span class=\"quiz-result-item__num\">" + (i + 1) + ".</span>" +
          "<span class=\"quiz-result-item__prompt\">" + promptLabel + "：「" + escapeHtml(r.promptText) + "」</span>" +
        "</div>" +
        "<div class=\"quiz-result-item__row quiz-result-item__answer\">" +
          "<span class=\"quiz-result-item__label\">" + answerLabel + "：</span>" +
          "<span class=\"quiz-result-item__correct\">" + escapeHtml(r.correctAnswer) + "</span>" +
          (r.userAnswer !== r.correctAnswer ? "<span class=\"quiz-result-item__wrong\">（你的答案：" + escapeHtml(r.userAnswer) + "）</span>" : "") +
        "</div>" +
        "<div class=\"quiz-result-item__row\">" +
          "<span class=\"quiz-result-item__mark" + (r.correct ? "" : " quiz-result-item__mark--wrong") + "\" aria-label=\"" + (r.correct ? "答對" : "答錯") + "\">" + (r.correct ? "✓ 答對" : "✗ 答錯") + "</span>" +
          "<button type=\"button\" class=\"quiz-result-star\" data-word-id=\"" + escapeHtml(r.word.id) + "\" aria-label=\"" + (saved ? "取消收藏" : "收藏") + "\" aria-pressed=\"" + saved + "\">" + starChar + "</button>" +
        "</div>";
      quizResultList.appendChild(item);
    });
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startQuiz() {
    if (allWords.length === 0) {
      alert("題庫載入中，請稍後再試。");
      return;
    }
    getPool(function () {
      if (pool.length === 0) {
        alert("目前篩選條件下沒有單字，請改選「全部」或放寬語言／級別／分類條件。");
        return;
      }
      buildQuestions();
      if (questions.length === 0) {
        alert("無法產生題目，請增加題數或題庫。");
        return;
      }
      quizResults = [];
      currentIndex = 0;
      correctCount = 0;
      quizResults = [];
      showSection(quizRun);
      showQuestion();
    });
  }

  function resetQuiz() {
    showSection(quizSetup);
    quizFeedback.classList.add("is-hidden");
    quizNextWrap.classList.add("is-hidden");
    if (quizConfirmWrap) quizConfirmWrap.classList.add("is-hidden");
  }

  if (quizStartBtn) {
    quizStartBtn.addEventListener("click", startQuiz);
  }
  if (quizAgainBtn) {
    quizAgainBtn.addEventListener("click", resetQuiz);
  }
  if (quizNextBtn) {
    quizNextBtn.addEventListener("click", nextQuestion);
  }

  if (quizOptions) {
    quizOptions.addEventListener("click", function (e) {
      var btn = e.target.closest(".quiz-option:not([disabled])");
      if (!btn) return;
      quizOptions.querySelectorAll(".quiz-option").forEach(function (b) { b.classList.remove("quiz-option--selected"); });
      btn.classList.add("quiz-option--selected");
      selectedOptionValue = btn.getAttribute("data-value");
      if (quizConfirmBtn) quizConfirmBtn.disabled = false;
    });
  }

  if (quizConfirmBtn) {
    quizConfirmBtn.addEventListener("click", function () {
      if (selectedOptionValue == null) return;
      checkMatch(selectedOptionValue);
    });
  }

  if (quizResultList) {
    quizResultList.addEventListener("click", function (e) {
      var starBtn = e.target.closest(".quiz-result-star");
      if (!starBtn || typeof toggleSavedWord === "undefined") return;
      var id = starBtn.getAttribute("data-word-id");
      if (!id) return;
      toggleSavedWord(id);
      var saved = isSavedWord(id);
      starBtn.textContent = saved ? "★" : "☆";
      starBtn.setAttribute("aria-pressed", saved);
      starBtn.setAttribute("aria-label", saved ? "取消收藏" : "收藏");
    });
  }

  Promise.all([
    fetch("words.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch("word_tags.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ]).then(function (results) {
    allWords = results[0] || [];
    allTags = results[1] || [];
    enrichWordsForQuiz();
    fillFilterDropdowns();
    var def = typeof getDefaultFilter !== "undefined" ? getDefaultFilter() : null;
    if (def) {
      if (quizFilterLanguage && def.language && def.language.length) quizFilterLanguage.value = def.language[0];
      if (quizFilterLevel && def.level && def.level.length) quizFilterLevel.value = def.level[0];
    }
  });
})();
