/*
 * Слой данных. Два режима с одинаковым интерфейсом:
 *  - Remote: функция Yandex Cloud (когда задан BZIK_CONFIG.API_URL и есть Telegram initData);
 *  - Mock:   всё в localStorage — для разработки в обычном браузере.
 *
 * Методы:
 *  state()            -> { user: {name, tz}|null, now, doors: [...], complete, achievements: [...] }
 *  register(name, tz) -> state
 *  door(n)            -> { n, status, content|null, answer|null }
 *  answer(n, {text, files: [{name, type, size, url}]}) -> state
 */
(function () {
  'use strict';

  var cfg = window.BZIK_CONFIG || {};
  var tg = window.Telegram && window.Telegram.WebApp;
  var Cal = window.BzikCalendar;
  var Ach = window.BzikAchievements;

  // ---------------- Remote ----------------
  function Remote(url, initData) {
    // тело — JSON в text/plain: так браузер не шлёт лишний предварительный OPTIONS-запрос
    function call(action, payload) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(Object.assign({ action: action, initData: initData }, payload || {})),
      }).catch(function () {
        throw new Error('нет связи с сервером — проверь интернет');
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok || data.error) throw new Error(data.error || 'ошибка сервера ' + r.status);
          return data;
        });
      });
    }
    function dataUrlToBlob(u) {
      var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(u);
      var bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: m[1] || 'application/octet-stream' });
    }
    // новые файлы грузим прямо в хранилище по одноразовой ссылке от сервера
    function upload(n, f) {
      if (f.key) return Promise.resolve({ name: f.name, type: f.type, size: f.size, key: f.key });
      var blob = dataUrlToBlob(f.url);
      var type = f.type || blob.type || 'application/octet-stream';
      return call('uploadUrl', { n: n, name: f.name, type: type, size: blob.size }).then(function (r) {
        return fetch(r.url, { method: 'PUT', headers: { 'Content-Type': type }, body: blob }).then(function (res) {
          if (!res.ok) throw new Error('не получилось загрузить «' + f.name + '»');
          return { name: f.name, type: type, size: blob.size, key: r.key };
        });
      });
    }
    return {
      mode: 'remote',
      state: function () { return call('state'); },
      register: function (name, tz) { return call('register', { name: name, tz: tz }); },
      door: function (n) { return call('door', { n: n }); },
      answer: function (n, a) {
        return Promise.all((a.files || []).map(function (f) { return upload(n, f); })).then(function (files) {
          return call('answer', { n: n, text: a.text, files: files });
        });
      },
    };
  }

  // ---------------- Mock ----------------
  function Mock() {
    var KEY = 'bzik-advent-mock-v2';
    var contentPromise = null;

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    }
    function save(s) {
      try { localStorage.setItem(KEY, JSON.stringify(s)); }
      catch (e) { throw new Error('не хватает места в браузере для тестовых файлов'); }
    }
    function now(s) { return Date.now() + (s.shift || 0); }
    function tz(s) { return (s.user && s.user.tz) || Cal.DEFAULT_TZ; }
    function content() {
      if (!contentPromise) {
        contentPromise = fetch(cfg.MOCK_CONTENT_URL, { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (j) { return j.doors || []; })
          .catch(function () { return []; });
      }
      return contentPromise;
    }
    function firstMap(s) {
      var m = {};
      Object.keys(s.answers || {}).forEach(function (n) { m[n] = s.answers[n].firstAt; });
      return m;
    }
    function snapshot(s) {
      return content().then(function (doorsContent) {
        var t = now(s);
        var doors = Cal.computeDoors(firstMap(s), t, tz(s));
        doors.forEach(function (d) {
          d.ready = !!doorsContent.find(function (c) { return c.n === d.n && c.slides && c.slides.length; });
        });
        var meta = {};
        Object.keys(s.answers || {}).forEach(function (n) {
          var a = s.answers[n];
          meta[n] = { firstAt: a.firstAt, updatedAt: a.updatedAt, edits: a.edits || 0, textLen: (a.text || '').length,
            ideas: Ach.countIdeas(a.text), files: (a.files || []).length };
        });
        var achievements = s.user ? Ach.compute({ answers: meta, visits: s.visits || [], tz: tz(s), registeredAt: s.user.registeredAt }) : [];
        return { user: s.user || null, now: t, doors: doors, complete: Cal.isComplete(doors), achievements: achievements };
      });
    }
    function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 150); }); }

    return {
      mode: 'mock',
      state: function () {
        var s = load();
        if (s.user) { // отмечаем заход сегодня (для «заходи N дней подряд»)
          var d = Cal.localDay(now(s), tz(s));
          s.visits = s.visits || [];
          if (s.visits.indexOf(d) < 0) { s.visits.push(d); save(s); }
        }
        return snapshot(s).then(delay);
      },
      register: function (name, zone) {
        var s = load();
        var t = now(s);
        s.user = { name: name, tz: Cal.isValidTz(zone) ? zone : Cal.DEFAULT_TZ, registeredAt: t };
        s.answers = s.answers || {};
        s.visits = [Cal.localDay(t, s.user.tz)];
        save(s);
        return snapshot(s).then(delay);
      },
      door: function (n) {
        var s = load();
        return Promise.all([snapshot(s), content()]).then(function (r) {
          var d = r[0].doors[n - 1];
          if (!d || d.status === 'locked') throw new Error('этот день ещё закрыт');
          var c = r[1].find(function (x) { return x.n === n; }) || null;
          if (c && !(c.slides && c.slides.length)) c = null;
          return delay({ n: n, status: d.status, content: c, answer: (s.answers || {})[n] || null });
        });
      },
      answer: function (n, a) {
        var s = load();
        var t = now(s);
        var d = Cal.computeDoors(firstMap(s), t, tz(s))[n - 1];
        if (!d || d.status === 'locked') return Promise.reject(new Error('этот день ещё закрыт'));
        s.answers = s.answers || {};
        var prev = s.answers[n];
        s.answers[n] = {
          text: a.text || '',
          // в тестовом режиме большие файлы храним без содержимого — места в браузере мало
          files: (a.files || []).map(function (f) { return { name: f.name, type: f.type, size: f.size, url: f.size < 1.5e6 ? f.url : null }; }),
          firstAt: prev ? prev.firstAt : t,
          updatedAt: t,
          edits: prev ? (prev.edits || 0) + 1 : 0,
        };
        save(s);
        return snapshot(s).then(delay);
      },
      // --- только для тестов ---
      debugShiftDay: function () { var s = load(); s.shift = (s.shift || 0) + 24 * 3600 * 1000; save(s); },
      debugReset: function () { localStorage.removeItem(KEY); },
    };
  }

  var initData = tg && tg.initData;
  window.BzikAPI = cfg.API_URL && initData ? Remote(cfg.API_URL, initData) : Mock();
})();
