/* SiGrow theseis embed renderer. Used by index.html (iframe) and the native snippet. */
(function (global) {
  "use strict";

  var TAG_LABEL = { NEW: "Νέα", UPDATE: "Ενημέρωση", ACTIVE: "Ενεργή" };
  var TAG_ORDER = { NEW: 0, UPDATE: 1, ACTIVE: 2 };

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
    var expired = isExpired(p.deadline);
    var deadlineTxt = p.deadline
      ? ((expired ? "έληξε " : "έως ") + esc(p.deadline))
      : "—";
    var pos = positionsLabel(p.positions);
    var hasDetail = !!(p.gazette || p.title);
    var detail = "";
    if (p.gazette) {
      detail = '<p class="sgr-th-detail">' + esc(p.gazette) + "</p>";
    }
    return (
      '<li class="sgr-th-row" data-id="' + esc(p.id) + '">' +
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
            '<span class="sgr-th-deadline sgr-th-date' + (expired ? " is-expired" : "") + '">' + deadlineTxt + "</span>" +
            '<span class="sgr-th-exam sgr-th-date">' + exam + "</span>" +
            '<div class="sgr-th-actions">' +
              (hasDetail && p.gazette
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
          '<span class="sgr-th-count" aria-live="polite"><strong>' + esc(String(data.count)) + "</strong> ανοιχτές θέσεις</span>" +
          (updated ? '<span>Ενημέρωση: <span class="sgr-th-date">' + esc(updated) + "</span></span>" : "") +
        "</p>" +
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
                orgOpts +
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
              '<label class="sgr-th-sr" for="sgr-th-sort">Ταξινόμηση</label>' +
              '<select id="sgr-th-sort" aria-label="Ταξινόμηση">' +
                '<option value="tag">Νέες πρώτα</option>' +
                '<option value="deadline">Προθεσμία</option>' +
                '<option value="published">Δημοσίευση</option>' +
                '<option value="organisation">Οργανισμός</option>' +
              "</select>" +
            "</div>" +
            '<label class="sgr-th-check">' +
              '<input id="sgr-th-open" type="checkbox">' +
              "Ανοιχτές προθεσμίες" +
            "</label>" +
          "</div>" +
        "</form>" +
      "</div>" +
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

  function bindRows(root) {
    var list = $(".sgr-th-list", root);
    if (!list || list.dataset.bound) return;
    list.dataset.bound = "1";
    list.addEventListener("click", function (e) {
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
      list.innerHTML = "";
      list.hidden = true;
      if (countEl) countEl.innerHTML = '<span class="sgr-th-empty">Δεν βρέθηκαν θέσεις με αυτά τα κριτήρια.</span>';
    } else {
      list.hidden = false;
      list.innerHTML = rows.map(cardHTML).join("");
      if (countEl) {
        countEl.innerHTML = rows.length === data.posts.length
          ? ("<strong>" + rows.length + "</strong> " + (rows.length === 1 ? "ανοιχτή θέση" : "ανοιχτές θέσεις"))
          : ("<strong>" + rows.length + "</strong> από " + data.posts.length + " θέσεις");
      }
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
    bindRows(root);
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
