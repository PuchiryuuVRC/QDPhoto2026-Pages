(function () {
  "use strict";

  var config = window.QD_PHOTO_PHASE_CONFIG || {};
  var debugStorageKey = "qdPhotoDebugPhase";
  var phaseNames = {
    1: "告知期間",
    2: "投稿受付中",
    3: "締切後・確認中",
    4: "投票期間",
    5: "集計・発表準備",
    6: "結果発表"
  };
  var phaseMessages = {
    1: "開催案内を公開しました（9月1日より受付開始）",
    2: "作品投稿受付中！（9月20日まで）",
    3: "投票準備中...",
    4: "投票受付中！（9月30日まで）",
    5: "集計作業中...",
    6: "受賞作品を公開中です！"
  };
  var enabledByPhase = {
    headerTop: [1, 2, 3, 4, 5, 6],
    headerMypage: [2, 3, 4, 5, 6],
    menuSubmit: [2],
    menuEntries: [4, 5, 6],
    menuResults: [6],
    vote: [4]
  };

  installDebugControls();
  renderPhase();
  refreshPhaseConfig();
  document.documentElement.classList.remove("phase-pending");

  function refreshPhaseConfig() {
    if (typeof window.fetch !== "function") return;
    var url = "assets/site-phase-config.js?refresh=" + Date.now();
    window.fetch(url, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Phase config request failed: " + response.status);
        return response.text();
      })
      .then(function (source) {
        var freshConfig = parsePhaseConfig(source);
        if (!freshConfig) return;
        config = freshConfig;
        window.QD_PHOTO_PHASE_CONFIG = Object.freeze(freshConfig);
        renderPhase();
      })
      .catch(function () {
        // Keep the initially loaded config when the refresh request fails.
      });
  }

  function parsePhaseConfig(source) {
    var prefix = "window.QD_PHOTO_PHASE_CONFIG = Object.freeze(";
    var text = String(source || "").trim();
    if (text.indexOf(prefix) !== 0 || text.slice(-2) !== ");") return null;
    try {
      return JSON.parse(text.slice(prefix.length, -2));
    } catch (error) {
      return null;
    }
  }

  function renderPhase() {
    var debugPhase = readDebugPhase();
    var phase = debugPhase || resolvePhase(config, new Date());
    document.documentElement.dataset.sitePhase = String(phase);
    document.documentElement.dataset.sitePhaseDebug = debugPhase ? "true" : "false";
    document.querySelectorAll("[data-phase-link]").forEach(function (element) {
      var key = String(element.dataset.phaseLink || "");
      var enabled = (enabledByPhase[key] || []).indexOf(phase) !== -1;
      setLinkEnabled(element, enabled, phase);
    });
    document.querySelectorAll("[data-phase-status]").forEach(function (element) {
      element.textContent = phaseMessages[phase] || "";
    });
    document.querySelectorAll("[data-debug-phase-value]").forEach(function (button) {
      var value = Number(button.dataset.debugPhaseValue || 0);
      var selected = debugPhase ? value === debugPhase : value === 0;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function installDebugControls() {
    if (!document.body || typeof document.body.insertAdjacentHTML !== "function") return;
    var buttons = [1, 2, 3, 4, 5, 6].map(function (phase) {
      return '<button type="button" data-debug-phase-value="' + phase + '" title="フェーズ' + phase + ': ' + phaseNames[phase] + '">' + phase + '</button>';
    }).join("");
    document.body.insertAdjacentHTML("afterbegin",
      '<aside class="debug-phase-bar" aria-label="デバッグ用フェーズ表示">'
      + '<strong>DEBUG フェーズ</strong>'
      + '<div class="debug-phase-buttons">' + buttons
      + '<button type="button" data-debug-phase-value="0">通常表示</button></div>'
      + '<span>ページ表示のみ切り替えます</span>'
      + '</aside>'
    );
    document.querySelectorAll("[data-debug-phase-value]").forEach(function (button) {
      button.addEventListener("click", function () {
        var phase = Number(button.dataset.debugPhaseValue || 0);
        writeDebugPhase(phase);
        renderPhase();
      });
    });
  }

  function readDebugPhase() {
    try {
      var raw = window.sessionStorage.getItem(debugStorageKey);
      if (!raw) return null;
      var stored;
      try {
        stored = JSON.parse(raw);
      } catch (error) {
        window.sessionStorage.removeItem(debugStorageKey);
        return null;
      }
      var phase = clampOptionalPhase(stored && stored.phase);
      var basePhase = clampOptionalPhase(stored && stored.basePhase);
      var currentPhase = resolvePhase(config, new Date());
      if (!phase || basePhase !== currentPhase) {
        window.sessionStorage.removeItem(debugStorageKey);
        return null;
      }
      return phase;
    } catch (error) {
      return null;
    }
  }

  function writeDebugPhase(phase) {
    try {
      if (phase >= 1 && phase <= 6) {
        window.sessionStorage.setItem(debugStorageKey, JSON.stringify({
          phase: phase,
          basePhase: resolvePhase(config, new Date())
        }));
      }
      else window.sessionStorage.removeItem(debugStorageKey);
    } catch (error) {
      // The current page still updates using its configured phase.
    }
  }

  function resolvePhase(values, now) {
    if (String(values.mode || "manual") === "manual") {
      return clampPhase(values.manualPhase);
    }

    var current = now.getTime();
    var entryOpen = parseTime(values.entryOpenAt);
    var entryClose = parseTime(values.entryCloseAt);
    var voteOpen = parseTime(values.voteOpenAt);
    var voteClose = parseTime(values.voteCloseAt);
    var resultPublish = parseTime(values.resultPublishAt);

    if (entryOpen != null && current < entryOpen) return 1;
    if (entryClose == null || current <= entryClose) return 2;
    if (voteOpen != null && current < voteOpen) return 3;
    if (voteClose == null || current <= voteClose) return 4;
    if (resultPublish != null && current >= resultPublish) return 6;
    return 5;
  }

  function parseTime(value) {
    if (!value) return null;
    var timestamp = Date.parse(String(value));
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function clampPhase(value) {
    var number = Number(value);
    return number >= 1 && number <= 6 ? Math.floor(number) : 1;
  }

  function clampOptionalPhase(value) {
    var number = Number(value);
    return number >= 1 && number <= 6 ? Math.floor(number) : null;
  }

  function setLinkEnabled(element, enabled, phase) {
    element.classList.toggle("disabled", !enabled);
    if (!element.dataset.phaseGuardBound) {
      element.addEventListener("click", preventDisabledNavigation);
      element.dataset.phaseGuardBound = "true";
    }
    if (enabled) {
      element.removeAttribute("aria-disabled");
      element.removeAttribute("tabindex");
      element.removeAttribute("title");
      return;
    }
    element.setAttribute("aria-disabled", "true");
    element.setAttribute("tabindex", "-1");
    element.setAttribute("title", disabledReason(element.dataset.phaseLink, phase));
  }

  function preventDisabledNavigation(event) {
    if (event.currentTarget.classList.contains("disabled")) event.preventDefault();
  }

  function disabledReason(key, currentPhase) {
    if (key === "menuSubmit") return currentPhase < 2 ? "作品受付開始前です。" : "作品受付は終了しました。";
    if (key === "menuEntries") return "作品一覧はまだ公開されていません。";
    if (key === "menuResults") return "結果はまだ発表されていません。";
    if (key === "vote") return currentPhase < 4 ? "投票開始前です。" : "投票受付は終了しました。";
    return "現在は利用できません。";
  }
})();
