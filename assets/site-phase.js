(function () {
  "use strict";

  var config = window.QD_PHOTO_PHASE_CONFIG || {};
  var phase = resolvePhase(config, new Date());
  var enabledByPhase = {
    headerTop: [1, 2, 3, 4, 5, 6],
    headerEntries: [4, 5, 6],
    headerResults: [6],
    headerMypage: [2, 3, 4, 5, 6],
    menuSubmit: [2],
    menuEntries: [4, 5, 6],
    menuResults: [6],
    menuMypage: [2, 3, 4, 5, 6],
    menuLogin: [2, 3, 4, 5, 6],
    vote: [4]
  };

  document.documentElement.dataset.sitePhase = String(phase);
  document.querySelectorAll("[data-phase-link]").forEach(function (element) {
    var key = String(element.dataset.phaseLink || "");
    var enabled = (enabledByPhase[key] || []).indexOf(phase) !== -1;
    setLinkEnabled(element, enabled);
  });
  document.documentElement.classList.remove("phase-pending");

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

  function setLinkEnabled(element, enabled) {
    element.classList.toggle("disabled", !enabled);
    if (enabled) {
      element.removeAttribute("aria-disabled");
      element.removeAttribute("tabindex");
      element.removeAttribute("title");
      return;
    }
    element.setAttribute("aria-disabled", "true");
    element.setAttribute("tabindex", "-1");
    element.setAttribute("title", disabledReason(element.dataset.phaseLink, phase));
    element.addEventListener("click", preventDisabledNavigation);
  }

  function preventDisabledNavigation(event) {
    event.preventDefault();
  }

  function disabledReason(key, currentPhase) {
    if (key === "menuSubmit") return currentPhase < 2 ? "作品受付開始前です。" : "作品受付は終了しました。";
    if (key === "headerEntries" || key === "menuEntries") return "作品一覧はまだ公開されていません。";
    if (key === "headerResults" || key === "menuResults") return "結果はまだ発表されていません。";
    if (key === "vote") return currentPhase < 4 ? "投票開始前です。" : "投票受付は終了しました。";
    return "現在は利用できません。";
  }
})();
