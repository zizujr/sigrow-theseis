/* SiGrow theseis embed renderer. Used by index.html (iframe) and the native snippet. */
(function (global) {
  "use strict";

  var TAG_LABEL = { NEW: "Νέα", UPDATE: "Ενημέρωση", ACTIVE: "Ενεργή" };
  var TAG_ORDER = { NEW: 0, UPDATE: 1, ACTIVE: 2 };
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

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

  function isExpired(deadline) {
    var d = parseDMY(deadline);
    return d ? startOfDay(d) < todayCy() : false;
  }

  function iconSearch() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>';
  }

  function iconArrow() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';
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

  function cardHTML(p) {
    var tag = p.tag || "ACTIVE";
    var tagClass = "sgr-th-tag sgr-th-tag--" + String(tag).toLowerCase();
    var exam = p.exam_date ? esc(p.exam_date) : "Αναμένεται";
    var expired = isExpired(p.deadline);
    var deadlineClass = "sgr-th-date" + (expired ? " is-expired" : "");
    var deadlineTxt = esc(p.deadline || "—") + (expired ? " · έληξε" : "");
    var gazette = p.gazette ? '<p class="sgr-th-gazette">' + esc(p.gazette) + "</p>" : "";
    return (
      '<li>' +
        '<article class="sgr-th-card" data-id="' + esc(p.id) + '">' +
          '<div class="sgr-th-card__top">' +
            '<span class="' + tagClass + '">' + esc(TAG_LABEL[tag] || tag) + "</span>" +
            '<span class="sgr-th-cat">' + esc(p.category || "Άλλη") + "</span>" +
          "</div>" +
          '<p class="sgr-th-org">' + esc(p.organisation) + "</p>" +
          '<h3 class="sgr-th-title">' + esc(p.title) + "</h3>" +
          '<dl class="sgr-th-dl">' +
            "<div><dt>Κλίμακα</dt><dd>" + esc(p.scale) + "</dd></div>" +
            "<div><dt>Θέσεις</dt><dd>" + esc(p.positions) + "</dd></div>" +
            "<div><dt>Προθεσμία</dt><dd class=\"" + deadlineClass + "\">" + deadlineTxt + "</dd></div>" +
            "<div><dt>Εξέταση</dt><dd class=\"sgr-th-date\">" + exam + "</dd></div>" +
          "</dl>" +
          gazette +
          '<a class="sgr-th-btn" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' +
            "Επίσημη προκήρυξη " + iconArrow() +
          "</a>" +
        "</article>" +
      "</li>"
    );
  }

  function comparePosts(a, b, sort) {
    function deadlineVal(p) {
      var d = parseDMY(p.deadline);
      return d ? d.getTime() : 8640000000000000;
    }
    function publishedVal(p) {
      var d = parseDMY(p.published);
      return d ? d.getTime() : 0;
    }
    if (sort === "published") {
      return publishedVal(b) - publishedVal(a) || a.organisation.localeCompare(b.organisation, "el");
    }
    if (sort === "organisation") {
      return a.organisation.localeCompare(b.organisation, "el") || a.title.localeCompare(b.title, "el");
    }
    if (sort === "deadline") {
      return deadlineVal(a) - deadlineVal(b) || a.organisation.localeCompare(b.organisation, "el");
    }
    /* default: tag then deadline. Use >= 0 so NEW (rank 0) is not treated as falsy. */
    var ta = Object.prototype.hasOwnProperty.call(TAG_ORDER, a.tag) ? TAG_ORDER[a.tag] : 9;
    var tb = Object.prototype.hasOwnProperty.call(TAG_ORDER, b.tag) ? TAG_ORDER[b.tag] : 9;
    return ta - tb ||
      deadlineVal(a) - deadlineVal(b) ||
      a.organisation.localeCompare(b.organisation, "el");
  }

  function matches(p, f) {
    if (f.category && p.category !== f.category) return false;
    if (f.organisation && p.organisation !== f.organisation) return false;
    if (f.tag && p.tag !== f.tag) return false;
    if (f.openOnly && isExpired(p.deadline)) return false;
    if (f.q) {
      var hay = [p.title, p.organisation, p.scale, p.category, p.gazette, p.positions]
        .join(" ").toLowerCase();
      if (hay.indexOf(f.q) === -1) return false;
    }
    return true;
  }

  function shellHTML(data) {
    var orgs = unique(data.posts.map(function (p) { return p.organisation; })).sort(sortOrgs);
    var orgOpts = orgs.map(function (o) {
      return '<option value="' + esc(o) + '">' + esc(o) + "</option>";
    }).join("");
    var updated = data.generated_at_display || "";
    return (
      '<div class="sgr-th-bar">' +
        '<p class="sgr-th-meta-line">' +
          '<span><strong>' + esc(String(data.count)) + "</strong> ανοιχτές θέσεις</span>" +
          (updated ? '<span>Τελευταία ενημέρωση: <span class="sgr-th-date">' + esc(updated) + "</span></span>" : "") +
        "</p>" +
        '<form class="sgr-th-controls" action="#" role="search">' +
          '<div class="sgr-th-search">' +
            iconSearch() +
            '<label class="sgr-th-sr" for="sgr-th-q">Αναζήτηση θέσης, οργανισμού ή κλίμακας</label>' +
            '<input id="sgr-th-q" type="search" placeholder="Αναζήτηση θέσης, οργανισμού ή κλίμακας" autocomplete="off" enterkeyhint="search">' +
          "</div>" +
          '<div class="sgr-th-filters">' +
            '<div class="sgr-th-field">' +
              '<label for="sgr-th-cat">Κατηγορία</label>' +
              '<select id="sgr-th-cat">' +
                '<option value="">Όλες οι κατηγορίες</option>' +
                '<option value="Α8–Α11">Α8–Α11</option>' +
                '<option value="Α13">Α13</option>' +
                '<option value="Α15">Α15</option>' +
                '<option value="Άλλη">Άλλη</option>' +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label for="sgr-th-org">Οργανισμός</label>' +
              '<select id="sgr-th-org">' +
                '<option value="">Όλοι οι οργανισμοί</option>' +
                orgOpts +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label for="sgr-th-tag">Κατάσταση</label>' +
              '<select id="sgr-th-tag">' +
                '<option value="">Όλες</option>' +
                '<option value="NEW">Νέα</option>' +
                '<option value="UPDATE">Ενημέρωση</option>' +
                '<option value="ACTIVE">Ενεργή</option>' +
              "</select>" +
            "</div>" +
            '<div class="sgr-th-field">' +
              '<label for="sgr-th-sort">Ταξινόμηση</label>' +
              '<select id="sgr-th-sort">' +
                '<option value="tag">Νέες πρώτα</option>' +
                '<option value="deadline">Προθεσμία (πλησιέστερη)</option>' +
                '<option value="published">Ημερομηνία δημοσίευσης</option>' +
                '<option value="organisation">Οργανισμός</option>' +
              "</select>" +
            "</div>" +
            '<label class="sgr-th-check">' +
              '<input id="sgr-th-open" type="checkbox">' +
              "Μόνο ανοιχτές προθεσμίες" +
            "</label>" +
          "</div>" +
        "</form>" +
      "</div>" +
      '<p class="sgr-th-count" aria-live="polite"></p>' +
      '<ul class="sgr-th-list"></ul>'
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

  function renderList(root, data) {
    var list = $(".sgr-th-list", root);
    var countEl = $(".sgr-th-count", root);
    var f = {
      q: ($("#sgr-th-q", root).value || "").trim().toLowerCase(),
      category: $("#sgr-th-cat", root).value,
      organisation: $("#sgr-th-org", root).value,
      tag: $("#sgr-th-tag", root).value,
      openOnly: $("#sgr-th-open", root).checked,
      sort: $("#sgr-th-sort", root).value || "tag"
    };
    var rows = data.posts.filter(function (p) { return matches(p, f); });
    rows.sort(function (a, b) { return comparePosts(a, b, f.sort); });
    if (!rows.length) {
      list.innerHTML = '<li class="sgr-th-empty">Δεν βρέθηκαν θέσεις με αυτά τα κριτήρια.</li>';
      countEl.textContent = "Εμφανίζονται 0 από " + data.posts.length + " θέσεις.";
    } else {
      list.innerHTML = rows.map(cardHTML).join("");
      countEl.textContent = rows.length === data.posts.length
        ? (rows.length === 1 ? "Εμφανίζεται 1 θέση." : "Εμφανίζονται " + rows.length + " θέσεις.")
        : "Εμφανίζονται " + rows.length + " από " + data.posts.length + " θέσεις.";
    }
    sendHeight();
  }

  function init(root, data, opts) {
    opts = opts || {};
    if (!root || !data) return;
    root.classList.add("sgr-th-root", "sgr-th-live");
    if (root.id === "theseis-embed" || (root.classList && root.classList.contains("theseis-embed"))) {
      root.classList.add("sgr-th-live");
    }
    var posts = Array.isArray(data.posts) ? data.posts : [];
    var view = {
      version: data.version,
      generated_at: data.generated_at,
      generated_at_display: data.generated_at_display || opts.generatedAtDisplay || "",
      count: typeof data.count === "number" ? data.count : posts.length,
      posts: posts
    };
    root.innerHTML = shellHTML(view);
    var form = $(".sgr-th-controls", root);
    if (form) {
      form.addEventListener("submit", function (e) { e.preventDefault(); });
    }
    ["sgr-th-q", "sgr-th-cat", "sgr-th-org", "sgr-th-tag", "sgr-th-sort", "sgr-th-open"].forEach(function (id) {
      var el = $("#" + id, root);
      if (!el) return;
      var ev = el.id === "sgr-th-q" ? "input" : "change";
      el.addEventListener(ev, function () { renderList(root, view); });
    });
    renderList(root, view);
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
