/*
 * Достижения. Считаются из данных пользователя — одинаково в браузере (тестовый
 * режим) и на сервере. Все данные, включая нажатия на маскота (counters.mascot)
 * и прослушанные мелодии (tracks), хранятся на сервере.
 *
 * compute({ doors, answers, visits, tz, registeredAt, extras }) -> [{ id, title, desc, icon, goal, value, got }]
 *   answers: { n: { firstAt, updatedAt, edits, textLen, ideas, files } }
 *   visits:  [номера местных дней, когда пользователь открывал приложение]
 *   eggs:    { код: время } — найденные пасхалки (секретные ссылки)
 */
(function (root) {
  'use strict';

  var Cal = root.BzikCalendar || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  // «идея» = непустая строка или пункт списка в ответе
  function countIdeas(text) {
    return String(text || '')
      .split(/\n|;|(?:^|\s)\d{1,2}[.)]\s/)
      .map(function (s) { return s.replace(/^[\s\-•*–—]+/, '').trim(); })
      .filter(function (s) { return s.length >= 3; }).length;
  }

  var LIST = [
    { id: 'first', title: 'первый подарок', desc: 'пройди первый день', icon: 'gift', goal: 1, of: 'days' },
    { id: 'warm', title: 'разогрев', desc: 'пройди 3 дня', icon: 'flame', goal: 3, of: 'days' },
    { id: 'equator', title: 'экватор', desc: 'пройди 7 дней из 14 — половина пути!', icon: 'globe', goal: 7, of: 'days' },
    { id: 'almost', title: 'финишная прямая', desc: 'пройди 10 дней', icon: 'flag', goal: 10, of: 'days' },
    { id: 'champion', title: 'бзик года', desc: 'пройди все 14 дней', icon: 'trophy', goal: 14, of: 'days' },
    { id: 'ideas5', title: 'искра', desc: 'напиши 5 идей', icon: 'bulb', goal: 5, of: 'ideas' },
    { id: 'ideas15', title: 'генератор идей', desc: 'напиши 15 идей', icon: 'bulb2', goal: 15, of: 'ideas' },
    { id: 'ideas30', title: 'фабрика идей', desc: 'напиши 30 идей', icon: 'factory', goal: 30, of: 'ideas' },
    { id: 'streak3', title: 'постоянство', desc: 'заходи 3 дня подряд', icon: 'cal', goal: 3, of: 'streak' },
    { id: 'streak7', title: 'железная привычка', desc: 'заходи 7 дней подряд', icon: 'cal2', goal: 7, of: 'streak' },
    { id: 'ontime', title: 'день в день', desc: 'отвечай в день открытия 5 раз', icon: 'clock', goal: 5, of: 'ontime' },
    { id: 'long', title: 'длинная мысль', desc: 'напиши ответ длиннее 500 символов', icon: 'scroll', goal: 500, of: 'longest' },
    { id: 'early', title: 'ранняя пташка', desc: 'ответь до 9 утра', icon: 'sun', goal: 1, of: 'early' },
    { id: 'night', title: 'полуночник', desc: 'ответь между полуночью и 5 утра', icon: 'moon', goal: 1, of: 'night' },
    { id: 'file', title: 'с приложением', desc: 'прикрепи к ответу файл или фото', icon: 'clip', goal: 1, of: 'files' },
    { id: 'edit', title: 'перфекционист', desc: 'доработай уже отправленный ответ', icon: 'pencil', goal: 1, of: 'edits' },
    { id: 'channel', title: 'за кулисами', desc: 'подсмотри за креаторами на канале', icon: 'eye', goal: 1, of: 'channel' },
    { id: 'qr', title: 'тайный агент', desc: 'найди секретный код в одном из дней', icon: 'qr', goal: 1, of: 'eggs' },
    { id: 'mascot', title: 'друг маскота', desc: 'потыкай маскота 10 раз', icon: 'hat', goal: 10, of: 'mascot' },
    { id: 'music', title: 'меломан', desc: 'послушай 5 разных новогодних мелодий', icon: 'note', goal: 5, of: 'music' },
  ];

  function maxStreak(days) {
    var u = (days || []).slice().sort(function (a, b) { return a - b; }).filter(function (d, i, a) { return i === 0 || d !== a[i - 1]; });
    var best = u.length ? 1 : 0, cur = 1;
    for (var i = 1; i < u.length; i++) { cur = u[i] === u[i - 1] + 1 ? cur + 1 : 1; if (cur > best) best = cur; }
    return best;
  }

  function stats(d) {
    var tz = d.tz, ans = d.answers || {}, ex = d.extras || {};
    var s = { days: 0, ideas: 0, streak: maxStreak(d.visits), ontime: 0, longest: 0, early: 0, night: 0, files: 0, edits: 0,
      mascot: (d.counters && d.counters.mascot) || ex.mascotTaps || 0, music: (d.tracks || []).length || ex.tracksHeard || 0, eggs: Object.keys(d.eggs || {}).length,
      channel: d.marks && d.marks.channel ? 1 : 0 };
    Object.keys(ans).forEach(function (k) {
      var a = ans[k], n = +k;
      s.days++;
      s.ideas += a.ideas || 0;
      s.longest = Math.max(s.longest, a.textLen || 0);
      s.files += a.files || 0;
      s.edits += a.edits || 0;
      [a.firstAt, a.updatedAt].forEach(function (t) {
        if (!t) return;
        var h = Cal.localHour(t, tz);
        if (h < 9 && h >= 5) s.early = 1;
        if (h < 5) s.night = 1;
      });
      var openedAt = n === 1 ? d.registeredAt : (ans[n - 1] && ans[n - 1].firstAt);
      if (openedAt) {
        var openDay = n === 1 ? Cal.localDay(openedAt, tz) : Cal.localDay(openedAt, tz) + 1;
        if (Cal.localDay(a.firstAt, tz) === openDay) s.ontime++;
      }
    });
    return s;
  }

  function compute(d) {
    var s = stats(d);
    return LIST.map(function (a) {
      var v = Math.min(a.goal, s[a.of] || 0);
      return { id: a.id, title: a.title, desc: a.desc, icon: a.icon, goal: a.goal, value: v, got: v >= a.goal };
    });
  }

  var api = { LIST: LIST, compute: compute, countIdeas: countIdeas, maxStreak: maxStreak };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BzikAchievements = api;
})(this);
