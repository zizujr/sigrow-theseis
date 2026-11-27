/* SiGrow theseis embed renderer. Used by index.html (iframe) and the native snippet. */
(function (global) {
  "use strict";

  var TAG_LABEL = { NEW: "Νέα", UPDATE: "Ενημέρωση", ACTIVE: "Ενεργή" };
  var TAG_ORDER = { NEW: 0, UPDATE: 1, ACTIVE: 2 };
  var DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseDMY(s) {
    if (!s) return null;
    var m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  function allDates() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var t = arguments[i];
      if (!t) continue;
      var re = new RegExp(DATE_RE.source, "g");
      var m;
      while ((m = re.exec(String(t)))) {
        var d = parseDMY(m[0]);
        if (d) out.push(d);
      }
    }
    return out;
  }

  function lastDate(dates) {
    if (!dates || !dates.length) return null;
    var best = dates[0];
    for (var i = 1; i < dates.length; i++) {
      if (dates[i].getTime() > best.getTime()) best = dates[i];
    }
    return best;
  }

  function firstDate(dates) {
    if (!dates || !dates.length) return null;
    var best = dates[0];
    for (var i = 1; i < dates.length; i++) {
      if (dates[i].getTime() < best.getTime()) best = dates[i];
    }
    return best;
  }

  function todayCy() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Nicosia", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    return new Date(Number(map.year), Number(map.month) - 1, Number(map.day));
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addMonths(d, months) {
    var y = d.getFullYear();
    var m = d.getMonth() + months;
    var last = new Date(y, m + 1, 0).getDate();
    var day = Math.min(d.getDate(), last);
    return new Date(y, m, day);
  }

  function expiryRef(p) {
    return parseDMY(p.deadline) || parseDMY(p.exam_date) || parseDMY(p.published);
  }

  function isExpiredPost(p) {
    var today = todayCy();
    var dd = parseDMY(p.deadline);
    var ed = parseDMY(p.exam_date);
    return !!(dd && startOfDay(dd) < today) || !!(ed && startOfDay(ed) < today);
  }

  function examExpiryRef(p) {
    var examDates = allDates(p.exam_date);
    if (examDates.length) return lastDate(examDates);
    var due = allDates(p.deadline, p.application_window);
    if (due.length) return lastDate(due);
    return parseDMY(p.published);
  }

  function isExpiredExam(p) {
    var today = todayCy();
    var examDates = allDates(p.exam_date);
    if (examDates.length) return startOfDay(lastDate(examDates)) < today;
    var due = allDates(p.deadline, p.application_window);
    if (due.length) return startOfDay(lastDate(due)) < today;
    return false;
  }

  function isExpiredItem(p, kind) {
    return kind === "exams" ? isExpiredExam(p) : isExpiredPost(p);
  }

  function expiryRefItem(p, kind) {
    return kind === "exams" ? examExpiryRef(p) : expiryRef(p);
  }

  function isTooOldExpired(p, kind) {
    if (!isExpiredItem(p, kind)) return false;
    var ref = expiryRefItem(p, kind);
    if (!ref) return false;
    return startOfDay(ref) < startOfDay(addMonths(todayCy(), -6));
  }

  function sectionOf(p, kind) {
    return isExpiredItem(p, kind) ? "expired" : "open";
  }

  function iconSearch() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>';
  }

  function iconLink() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5"/><path d="M20 4L10 14"/><path d="M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>';
  }

  function iconMore() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  }

  function unique(values) {
    var seen = Object.create(null);
    var out = [];
    values.forEach(function (v) {
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }

  function sortOrgs(a, b) {
    return a.localeCompare(b, "el");
  }

  function positionsLabel(s) {
    var t = String(s == null ? "" : s).trim();
    if (!t) return "";
    if (/θέσ/i.test(t)) return t;
    if (/^\d+$/.test(t)) return t === "1" ? "1 θέση" : t + " θέσεις";
    return t;
  }

  function cardHTML(p) {
    var tag = p.tag || "ACTIVE";
    var tagClass = "sgr-th-tag sgr-th-tag--" + String(tag).toLowerCase();
    var exam = p.exam_date ? ("Εξέταση " + esc(p.exam_date)) : "Αναμένεται";
    var expired = isExpiredPost(p);
    var deadlineTxt = p.deadline && parseDMY(p.deadline)
      ? ((expired && parseDMY(p.deadline) && startOfDay(parseDMY(p.deadline)) < todayCy() ? "έληξε " : "έως ") + esc(p.deadline))
      : (p.deadline && p.deadline !== "Υπό επιβεβαίωση" ? esc(p.deadline) : "—");
    var pos = positionsLabel(p.positions);
    var detail = p.gazette ? '<p class="sgr-th-detail">' + esc(p.gazette) + "</p>" : "";
    return (
      '<li class="sgr-th-row" data-id="' + esc(p.id) + '" data-status="' + (expired ? "expired" : "open") + '">' +
        '<div class="sgr-th-item">' +
          '<div class="sgr-th-main">' +
            '<h3 class="sgr-th-title" title="' + esc(p.title) + '">' +
              '<a href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' + esc(p.title) + "</a>" +
            "</h3>" +
            '<div class="sgr-th-sub">' +
              '<span class="' + tagClass + '">' + esc(TAG_LABEL[tag] || tag) + "</span>" +
              '<p class="sgr-th-org">' + esc(p.organisation) + "</p>" +
              '<span class="sgr-th-cat">' + esc(p.category || "Άλλη") + "</span>" +
              (p.scale ? '<span class="sgr-th-scale">' + esc(p.scale) + "</span>" : "") +
              (pos ? '<span class="sgr-th-pos">' + esc(pos) + "</span>" : "") +
            "</div>" +
          "</div>" +
          '<div class="sgr-th-side">' +
            '<span class="sgr-th-deadline sgr-th-date' + (expired && parseDMY(p.deadline) && startOfDay(parseDMY(p.deadline)) < todayCy() ? " is-expired" : "") + '">' + deadlineTxt + "</span>" +
            '<span class="sgr-th-exam sgr-th-date">' + exam + "</span>" +
            '<div class="sgr-th-actions">' +
              (p.gazette
                ? '<button class="sgr-th-more" type="button" aria-expanded="false" aria-label="Περισσότερα στοιχεία">' + iconMore() + "</button>"
                : "") +
              '<a class="sgr-th-link" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer" aria-label="Επίσημη προκήρυξη" title="Επίσημη προκήρυξη">' +
                iconLink() +
              "</a>" +
            "</div>" +
          "</div>" +
        "</div>" +
        detail +
      "</li>"
    );
  }

  function examCardHTML(p) {
    var tag = p.tag || "ACTIVE";
    var tagClass = "sgr-th-tag sgr-th-tag--" + String(tag).toLowerCase();
    var exam = p.exam_date ? ("Εξέταση " + esc(p.exam_date)) : "Ημερομηνία εκκρεμεί";
    var expired = isExpiredExam(p);
    var windowTxt = (p.application_window || p.deadline || "").trim();
    var windowDate = parseDMY(windowTxt);
    var deadlineTxt;
    if (windowDate) {
      deadlineTxt = ((expired && startOfDay(windowDate) < todayCy()) ? "έληξε " : "αιτήσεις έως ") + esc(windowTxt);
    } else if (windowTxt) {
      deadlineTxt = "Αιτήσεις: " + esc(windowTxt);
    } else {
      deadlineTxt = "—";
    }
    var summary = p.summary
      ? '<p class="sgr-th-summary">' + esc(p.summary) + "</p>"
      : "";
    var detail = p.gazette ? '<p class="sgr-th-detail">' + esc(p.gazette) + "</p>" : "";
    return (
      '<li class="sgr-th-row" data-id="' + esc(p.id) + '" data-status="' + (expired ? "expired" : "open") + '">' +
        '<div class="sgr-th-item">' +
          '<div class="sgr-th-main">' +
            '<h3 class="sgr-th-title" title="' + esc(p.title) + '">' +
              '<a href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' + esc(p.title) + "</a>" +
            "</h3>" +
            '<div class="sgr-th-sub">' +
              '<span class="' + tagClass + '">' + esc(TAG_LABEL[tag] || tag) + "</span>" +
              '<p class="sgr-th-org">' + esc(p.organisation) + "</p>" +
              '<span class="sgr-th-cat">' + esc(p.category || "Άλλη") + "</span>" +
              (p.scale ? '<span class="sgr-th-scale">' + esc(p.scale) + "</span>" : "") +
            "</div>" +
            summary +
          "</div>" +
          '<div class="sgr-th-side">' +
            '<span class="sgr-th-deadline sgr-th-date' + (expired && windowDate && startOfDay(windowDate) < todayCy() ? " is-expired" : "") + '">' + deadlineTxt + "</span>" +
            '<span class="sgr-th-exam sgr-th-date">' + exam + "</span>" +
            '<div class="sgr-th-actions">' +
              (p.gazette
                ? '<button class="sgr-th-more" type="button" aria-expanded="false" aria-label="Περισσότερα στοιχεία">' + iconMore() + "</button>"
                : "") +
              '<a class="sgr-th-link" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer" aria-label="Επίσημη ανακοίνωση" title="Επίσημη ανακοίνωση">' +
                iconLink() +
              "</a>" +
            "</div>" +
          "</div>" +
        "</div>" +
        detail +
      "</li>"
    );
  }

  function deadlineVal(p) {
    var d = parseDMY(p.deadline) || lastDate(allDates(p.deadline, p.application_window));
    return d ? d.getTime() : 8640000000000000;
  }

  function publishedVal(p) {
    var d = parseDMY(p.published);
    return d ? d.getTime() : 0;
  }

  function expiryVal(p, kind) {
    var d = expiryRefItem(p, kind);
    return d ? d.getTime() : 0;
  }

  function examDateVal(p) {
    var d = parseDMY(p.exam_date) || firstDate(allDates(p.exam_date));
    return d ? d.getTime() : 8640000000000000;
  }

  function compareInSection(a, b, sort, section, kind) {
    if (sort === "organisation") {
      return a.organisation.localeCompare(b.organisation, "el") || a.title.localeCompare(b.title, "el");
    }
    if (sort === "deadline") {
      if (kind === "exams") {
        return examDateVal(a) - examDateVal(b) || a.organisation.localeCompare(b.organisation, "el");
      }
      if (section === "expired") {
        return expiryVal(b, kind) - expiryVal(a, kind) || a.organisation.localeCompare(b.organisation, "el");
      }
      return deadlineVal(a) - deadlineVal(b) || a.organisation.localeCompare(b.organisation, "el");
    }
    if (sort === "tag") {
      var ta = Object.prototype.hasOwnProperty.call(TAG_ORDER, a.tag) ? TAG_ORDER[a.tag] : 9;
      var tb = Object.prototype.hasOwnProperty.call(TAG_ORDER, b.tag) ? TAG_ORDER[b.tag] : 9;
      if (ta !== tb) return ta - tb;
    }
    if (section === "expired") {
      return expiryVal(b, kind) - expiryVal(a, kind) || a.organisation.localeCompare(b.organisation, "el");
    }
    if (kind === "exams") {
      return publishedVal(b) - publishedVal(a) || examDateVal(a) - examDateVal(b) || a.organisation.localeCompare(b.organisation, "el") || a.title.localeCompare(b.title, "el");
    }
    return publishedVal(b) - publishedVal(a) || a.organisation.localeCompare(b.organisation, "el");
  }

  function matches(p, f) {
    if (f.category && p.category !== f.category) return false;
    if (f.organisation && p.organisation !== f.organisation) return false;
    if (f.tag && p.tag !== f.tag) return false;
    if (f.q) {
      var hay = [p.title, p.organisation, p.scale, p.category, p.gazette, p.positions, p.summary, p.exam_date, p.application_window, p.deadline]
        .join(" ").toLowerCase();
      if (hay.indexOf(f.q) === -1) return false;
    }
    return true;
  }

  function orgOptions(items) {
    return unique(items.map(function (p) { return p.organisation; })).sort(sortOrgs).map(function (o) {
      return '<option value="' + esc(o) + '">' + esc(o) + "</option>";
    }).join("");
  }

  function badge(open, total) {
    var o = open == null ? "0" : String(open);
    var t = total == null ? "0" : String(total);
    return '<span class="sgr-th-tab__badge">' + esc(o) + "/" + esc(t) + "</span>";
  }

  function currentTab(root) {
    var btn = $('.sgr-th-tab[aria-selected="true"]', root);
    return (btn && btn.getAttribute("data-tab")) || "posts";
  }

  function shellHTML(data) {
    var nOpen = data.count_open != null ? data.count_open : "";
    var nExp = data.count_expired != null ? data.count_expired : "";
    var nExOpen = data.count_exams_open != null ? data.count_exams_open : 0;
    var nEx = data.count_exams != null ? data.count_exams : (data.exams ? data.exams.length : 0);
    var updated = data.generated_at_display || "";
    var initialOrgs = orgOptions(data.posts || []);
    return (
      '<div class="sgr-th-bar">' +
        '<p class="sgr-th-meta-line">' +
          '<span class="sgr-th-count" aria-live="polite"><strong>' + esc(String(data.count)) + "</strong> θέσεις</span>" +
          (updated ? '<span>Ενημέρωση: <span class="sgr-th-date">' + esc(updated) + "</span></span>" : "") +
        "</p>" +
        '<div class="sgr-th-tabs" role="tablist" aria-label="Κατάλογοι">' +
          '<button class="sgr-th-tab" type="button" role="tab" id="sgr-th-tab-posts" data-tab="posts" aria-selected="true" aria-controls="sgr-th-panel">' +
            "Θέσεις Εργασίας " + badge(nOpen, data.count) +
          "</button>" +
          '<button class="sgr-th-tab" type="button" role="tab" id="sgr-th-tab-exams" data-tab="exams" aria-selected="false" aria-controls="sgr-th-panel">' +
            "Προκηρύξεις Εξετάσεων " + badge(nExOpen, nEx) +
          "</button>" +
        "</div>" +
        '<form class="sgr-th-controls" action="#" role="search">' +
          '<div class="sgr-th-search">' +
            iconSearch() +
            '<label class="sgr-th-sr" for="sgr-th-q">Αναζήτηση θέσης, οργανισμού ή κλίμακας</label>' +
            '<input id="sgr-th-q" type="search" placeholder="Αναζήτηση θέσης, οργανισμού ή κλίμακας" autocomplete="off" enterkeyhint="search">' +
          "</div>" +
          '<div class="sgr-th-filters">' +
            '<div class="sgr-th-field">' +
              '<label class="sgr-th-sr" for="sgr-th-cat">Κατηγορία</label>' +
              '<select id="sgr-th-cat" aria-label="Κατηγορία">' +
                '<option value="">Κατηγορία</option>' +
                '<option value="Α8–Α11">Α8–Α11</option>' +
                '<option value="Α13">Α13</option>' +
                '<option value="Α15">Α15</option>' +
                '<option value="Άλλη">Άλλη</option>' +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label class="sgr-th-sr" for="sgr-th-org">Οργανισμός</label>' +
              '<select id="sgr-th-org" aria-label="Οργανισμός">' +
                '<option value="">Οργανισμός</option>' +
                initialOrgs +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label class="sgr-th-sr" for="sgr-th-tag">Κατάσταση</label>' +
              '<select id="sgr-th-tag" aria-label="Κατάσταση">' +
                '<option value="">Κατάσταση</option>' +
                '<option value="NEW">Νέα</option>' +
                '<option value="UPDATE">Ενημέρωση</option>' +
                '<option value="ACTIVE">Ενεργή</option>' +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label class="sgr-th-sr" for="sgr-th-status">Προθεσμία</label>' +
              '<select id="sgr-th-status" aria-label="Προθεσμία">' +
                '<option value="">Όλες</option>' +
                '<option value="open">Ανοιχτές</option>' +
                '<option value="expired">Έληξαν</option>' +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label class="sgr-th-sr" for="sgr-th-sort">Ταξινόμηση</label>' +
              '<select id="sgr-th-sort" aria-label="Ταξινόμηση">' +
                '<option value="published">Νεότερες πρώτα</option>' +
                '<option value="deadline">Προθεσμία</option>' +
                '<option value="tag">Νέες πρώτα</option>' +
                '<option value="organisation">Οργανισμός</option>' +
              "</select>" +
            "</div>" +
          "</div>" +
        "</form>" +
      "</div>" +
      '<div id="sgr-th-panel" class="sgr-th-panel" role="tabpanel" aria-labelledby="sgr-th-tab-posts">' +
        '<p class="sgr-th-empty" hidden>Δεν βρέθηκαν θέσεις.</p>' +
        '<section class="sgr-th-section" data-section="open">' +
          '<h2 class="sgr-th-section__title">Ανοιχτές θέσεις <span class="sgr-th-section__count" data-count="open">(' + esc(String(nOpen)) + ")</span></h2>" +
          '<ul class="sgr-th-list" data-list="open"></ul>' +
        "</section>" +
        '<section class="sgr-th-section sgr-th-section--expired" data-section="expired">' +
          '<h2 class="sgr-th-section__title">Θέσεις που έληξαν <span class="sgr-th-section__count" data-count="expired">(' + esc(String(nExp)) + ")</span></h2>" +
          '<ul class="sgr-th-list" data-list="expired"></ul>' +
        "</section>" +
      "</div>"
    );
  }

  function sendHeight() {
    if (global.parent === global) return;
    var h = Math.max(
      document.documentElement ? document.documentElement.scrollHeight : 0,
      document.body ? document.body.scrollHeight : 0
    );
    try {
      global.parent.postMessage({ type: "sigrow-theseis-height", height: h }, "*");
    } catch (e) {}
  }

  function bindHeight() {
    sendHeight();
    if (typeof ResizeObserver !== "undefined" && document.body) {
      var ro = new ResizeObserver(function () { sendHeight(); });
      ro.observe(document.body);
      if (document.documentElement) ro.observe(document.documentElement);
    }
    global.addEventListener("load", sendHeight);
    global.addEventListener("resize", sendHeight);
  }

  function bindRows(root) {
    if (root.dataset.boundRows) return;
    root.dataset.boundRows = "1";
    root.addEventListener("click", function (e) {
      var btn = e.target.closest(".sgr-th-more");
      if (!btn) return;
      e.preventDefault();
      var row = btn.closest(".sgr-th-row");
      if (!row) return;
      var open = row.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      sendHeight();
    });
  }

  function applyTabChrome(root, view, tab) {
    var isExams = tab === "exams";
    var items = isExams ? view.exams : view.posts;
    var q = $("#sgr-th-q", root);
    var qLabel = $('label[for="sgr-th-q"]', root);
    var placeholder = isExams
      ? "Αναζήτηση προκήρυξης, οργανισμού ή κλίμακας"
      : "Αναζήτηση θέσης, οργανισμού ή κλίμακας";
    if (q) q.setAttribute("placeholder", placeholder);
    if (qLabel) qLabel.textContent = placeholder;
    var org = $("#sgr-th-org", root);
    if (org) {
      var prev = org.value;
      org.innerHTML = '<option value="">Οργανισμός</option>' + orgOptions(items);
      org.value = prev && unique(items.map(function (p) { return p.organisation; })).indexOf(prev) !== -1 ? prev : "";
    }
    var statusLabel = $('label[for="sgr-th-status"]', root);
    var status = $("#sgr-th-status", root);
    if (statusLabel) statusLabel.textContent = isExams ? "Κατάσταση προκήρυξης" : "Προθεσμία";
    if (status) {
      status.setAttribute("aria-label", isExams ? "Κατάσταση προκήρυξης" : "Προθεσμία");
      var openOpt = status.querySelector('option[value="open"]');
      if (openOpt) openOpt.textContent = isExams ? "Προσεχείς" : "Ανοιχτές";
    }
    var sortDeadline = $("#sgr-th-sort", root) && $("#sgr-th-sort", root).querySelector('option[value="deadline"]');
    if (sortDeadline) sortDeadline.textContent = isExams ? "Ημερομηνία εξέτασης" : "Προθεσμία";
    var emptyEl = $(".sgr-th-empty", root);
    if (emptyEl) emptyEl.textContent = isExams ? "Δεν βρέθηκαν προκηρύξεις εξετάσεων." : "Δεν βρέθηκαν θέσεις.";
    var openTitle = $('[data-section="open"] .sgr-th-section__title', root);
    var expTitle = $('[data-section="expired"] .sgr-th-section__title', root);
    if (openTitle) {
      openTitle.innerHTML = (isExams ? "Προσεχείς εξετάσεις " : "Ανοιχτές θέσεις ") +
        '<span class="sgr-th-section__count" data-count="open"></span>';
    }
    if (expTitle) {
      expTitle.innerHTML = (isExams ? "Εξετάσεις που έληξαν " : "Θέσεις που έληξαν ") +
        '<span class="sgr-th-section__count" data-count="expired"></span>';
    }
    var panel = $("#sgr-th-panel", root);
    if (panel) panel.setAttribute("aria-labelledby", isExams ? "sgr-th-tab-exams" : "sgr-th-tab-posts");
  }

  function setTab(root, view, tab, persist) {
    var next = tab === "exams" ? "exams" : "posts";
    root.querySelectorAll(".sgr-th-tab").forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === next;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    applyTabChrome(root, view, next);
    renderList(root, view);
    sendHeight();
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(function () { sendHeight(); });
    }
    if (persist && global.history && global.history.replaceState) {
      try {
        var url = new URL(global.location.href);
        if (next === "exams") url.hash = "exams";
        else url.hash = "";
        global.history.replaceState(null, "", url);
      } catch (e) {}
    }
  }

  function renderList(root, data) {
    var kind = currentTab(root);
    var f = {
      q: ($("#sgr-th-q", root).value || "").trim().toLowerCase(),
      category: $("#sgr-th-cat", root).value,
      organisation: $("#sgr-th-org", root).value,
      tag: $("#sgr-th-tag", root).value,
      section: $("#sgr-th-status", root) ? $("#sgr-th-status", root).value : "",
      sort: ($("#sgr-th-sort", root) && $("#sgr-th-sort", root).value) || "published"
    };
    var source = kind === "exams" ? data.exams : data.posts;
    var pool = source.filter(function (p) { return !isTooOldExpired(p, kind); });
    var rows = pool.filter(function (p) { return matches(p, f); });
    var open = rows.filter(function (p) { return sectionOf(p, kind) === "open"; });
    var exp = rows.filter(function (p) { return sectionOf(p, kind) === "expired"; });
    if (f.section === "open") exp = [];
    if (f.section === "expired") open = [];
    open.sort(function (a, b) { return compareInSection(a, b, f.sort, "open", kind); });
    exp.sort(function (a, b) { return compareInSection(a, b, f.sort, "expired", kind); });

    var listOpen = $('[data-list="open"]', root);
    var listExp = $('[data-list="expired"]', root);
    var secOpen = $('[data-section="open"]', root);
    var secExp = $('[data-section="expired"]', root);
    var emptyEl = $(".sgr-th-empty", root);
    var countEl = $(".sgr-th-count", root);
    var countOpenEl = $('[data-count="open"]', root);
    var countExpEl = $('[data-count="expired"]', root);
    var toCard = kind === "exams" ? examCardHTML : cardHTML;

    if (listOpen) listOpen.innerHTML = open.map(toCard).join("");
    if (listExp) listExp.innerHTML = exp.map(toCard).join("");
    if (secOpen) secOpen.hidden = open.length === 0;
    if (secExp) secExp.hidden = exp.length === 0;
    if (countOpenEl) countOpenEl.textContent = "(" + open.length + ")";
    if (countExpEl) countExpEl.textContent = "(" + exp.length + ")";
    if (emptyEl) emptyEl.hidden = !!(open.length || exp.length);

    var shown = open.length + exp.length;
    var nounOne = kind === "exams" ? "προκήρυξη" : "θέση";
    var nounMany = kind === "exams" ? "προκηρύξεις" : "θέσεις";
    if (countEl) {
      if (shown === pool.length) {
        countEl.innerHTML = "<strong>" + shown + "</strong> " + (shown === 1 ? nounOne : nounMany);
      } else {
        countEl.innerHTML = "<strong>" + shown + "</strong> από " + pool.length + " " + nounMany;
      }
    }
    sendHeight();
  }

  function requestedTab() {
    try {
      var hash = (global.location && global.location.hash || "").replace(/^#/, "");
      if (hash === "exams") return "exams";
      var sp = global.location && global.location.search ? new URLSearchParams(global.location.search) : null;
      if (sp && sp.get("tab") === "exams") return "exams";
    } catch (e) {}
    return "posts";
  }

  function init(root, data, opts) {
    opts = opts || {};
    if (!root || !data) return;
    root.classList.add("sgr-th-root", "sgr-th-live");
    if (root.id === "theseis-embed" || (root.classList && root.classList.contains("theseis-embed"))) {
      root.classList.add("sgr-th-live");
    }
    var posts = Array.isArray(data.posts) ? data.posts : [];
    var exams = Array.isArray(data.exams) ? data.exams : [];
    var view = {
      version: data.version,
      generated_at: data.generated_at,
      generated_at_display: data.generated_at_display || opts.generatedAtDisplay || "",
      count: typeof data.count === "number" ? data.count : posts.length,
      count_open: data.count_open,
      count_expired: data.count_expired,
      posts: posts,
      count_exams: typeof data.count_exams === "number" ? data.count_exams : exams.length,
      count_exams_open: data.count_exams_open,
      count_exams_expired: data.count_exams_expired,
      exams: exams
    };
    root.innerHTML = shellHTML(view);
    var form = $(".sgr-th-controls", root);
    if (form) {
      form.addEventListener("submit", function (e) { e.preventDefault(); });
    }
    ["sgr-th-q", "sgr-th-cat", "sgr-th-org", "sgr-th-tag", "sgr-th-status", "sgr-th-sort"].forEach(function (id) {
      var el = $("#" + id, root);
      if (!el) return;
      var ev = el.id === "sgr-th-q" ? "input" : "change";
      el.addEventListener(ev, function () { renderList(root, view); });
    });
    var tabs = root.querySelectorAll(".sgr-th-tab");
    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(root, view, btn.getAttribute("data-tab"), true);
      });
    });
    var tablist = $(".sgr-th-tabs", root);
    if (tablist) {
      tablist.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
        var list = Array.prototype.slice.call(tabs);
        var i = list.findIndex(function (b) { return b.getAttribute("aria-selected") === "true"; });
        if (e.key === "ArrowRight") i = (i + 1) % list.length;
        else if (e.key === "ArrowLeft") i = (i - 1 + list.length) % list.length;
        else if (e.key === "Home") i = 0;
        else i = list.length - 1;
        e.preventDefault();
        list[i].focus();
        setTab(root, view, list[i].getAttribute("data-tab"), true);
      });
    }
    bindRows(root);
    setTab(root, view, requestedTab(), false);
    bindHeight();
  }

  function resolveRoot(target) {
    if (!target) return document.getElementById("theseis-embed") || document.getElementById("theseis-app");
    if (typeof target === "string") return document.querySelector(target);
    return target;
  }

  function mount(target, opts) {
    opts = opts || {};
    var root = resolveRoot(target);
    if (!root) return Promise.reject(new Error("SiGrow theseis: mount root not found"));
    var dataP;
    if (opts.data) {
      dataP = Promise.resolve(opts.data);
    } else if (opts.api) {
      dataP = fetch(opts.api, { credentials: "omit" }).then(function (r) {
        if (!r.ok) throw new Error("SiGrow theseis: API " + r.status);
        return r.json();
      });
    } else if (global.SIGROW_THESEIS_DATA) {
      dataP = Promise.resolve(global.SIGROW_THESEIS_DATA);
    } else {
      dataP = Promise.reject(new Error("SiGrow theseis: no data or api URL"));
    }
    return dataP.then(function (data) {
      init(root, data, opts);
      return data;
    });
  }

  global.SiGrowTheseis = {
    init: init,
    mount: mount,
    sendHeight: sendHeight
  };
})(typeof window !== "undefined" ? window : this);
