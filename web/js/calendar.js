/*
 * Правила открытия дней. Один и тот же файл используется в браузере
 * (тестовый режим) и на сервере (функция Yandex Cloud), чтобы логика не разъехалась.
 *
 * - День 1 доступен сразу после регистрации.
 * - День N+1 открывается в полночь ПО ЧАСОВОМУ ПОЯСУ ПОЛЬЗОВАТЕЛЯ после того дня,
 *   когда был дан ПЕРВЫЙ ответ в дне N. Правка ответа отсчёт не сдвигает.
 * - Часовой пояс запоминается при регистрации (IANA, напр. «Asia/Yekaterinburg»),
 *   чтобы нельзя было «перевести часы» и открыть день раньше.
 * - За один день открывается не больше одного нового дня; пропуски не «сгорают».
 */
(function (root) {
  'use strict';

  var DOORS = 14;
  var DAY = 24 * 60 * 60 * 1000;
  var DEFAULT_TZ = 'Europe/Moscow';

  // смещение часового пояса от UTC в мс в момент ts (учитывает летнее время)
  function tzOffset(ts, tz) {
    try {
      var f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz || DEFAULT_TZ, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
      var p = {};
      f.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = +x.value; });
      var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      return asUtc - Math.floor(ts / 1000) * 1000;
    } catch (e) {
      return 3 * 60 * 60 * 1000; // неизвестный пояс — считаем по Москве
    }
  }

  function isValidTz(tz) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  }

  // номер местного календарного дня (для сравнения «сегодня/вчера»)
  function localDay(ts, tz) {
    return Math.floor((ts + tzOffset(ts, tz)) / DAY);
  }

  // ближайшая местная полночь после ts
  function nextLocalMidnight(ts, tz) {
    var guess = (localDay(ts, tz) + 1) * DAY - tzOffset(ts, tz);
    // поправка, если между ts и полуночью сменилось летнее/зимнее время
    return (localDay(ts, tz) + 1) * DAY - tzOffset(guess, tz);
  }

  function localHour(ts, tz) {
    return Math.floor(((ts + tzOffset(ts, tz)) % DAY + DAY) % DAY / 3600000);
  }

  /**
   * @param {Object<number, number>} firstAnsweredAt  номер дня -> время первого ответа (мс)
   * @param {number} now  текущее время (мс)
   * @param {string} tz   часовой пояс пользователя
   * @returns {Array<{n:number,status:'done'|'open'|'locked',unlockAt?:number,waitFor?:number}>}
   */
  function computeDoors(firstAnsweredAt, now, tz) {
    var doors = [];
    var hintGiven = false;
    var today = localDay(now, tz);
    for (var n = 1; n <= DOORS; n++) {
      var mine = firstAnsweredAt[n];
      var prev = firstAnsweredAt[n - 1];
      if (mine) {
        doors.push({ n: n, status: 'done' });
      } else if (n === 1 || (prev && today > localDay(prev, tz))) {
        doors.push({ n: n, status: 'open' });
      } else {
        var d = { n: n, status: 'locked' };
        if (!hintGiven) {
          // ближайший закрытый: либо ждём полуночи, либо ответа в предыдущем
          if (prev) d.unlockAt = nextLocalMidnight(prev, tz);
          else d.waitFor = n - 1;
          hintGiven = true;
        }
        doors.push(d);
      }
    }
    return doors;
  }

  function isComplete(doors) {
    for (var i = 0; i < doors.length; i++) if (doors[i].status !== 'done') return false;
    return true;
  }

  var api = {
    DOORS: DOORS,
    DEFAULT_TZ: DEFAULT_TZ,
    tzOffset: tzOffset,
    isValidTz: isValidTz,
    localDay: localDay,
    localHour: localHour,
    nextLocalMidnight: nextLocalMidnight,
    computeDoors: computeDoors,
    isComplete: isComplete,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BzikCalendar = api;
})(this);
