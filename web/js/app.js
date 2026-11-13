/* Экраны мини-приложения: регистрация, календарь, день, достижения. Всё с маленькой буквы — стиль бзика. */
(function () {
  'use strict';

  var cfg = window.BZIK_CONFIG || {};
  var api = window.BzikAPI;
  var Px = window.BzikPixels;
  var Sl = window.BzikSlides;
  var Snd = window.BzikAudio;
  var tg = window.Telegram && window.Telegram.WebApp;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var MAX_FILES = 5;
  var MAX_FILE_MB = 3;
  var ASSET_V = 2; // поднимать при перерисовке спрайтов — Telegram агрессивно кеширует
  var state = null;        // последний ответ state()
  var clockOffset = 0;     // серверное время - локальное
  var timerId = null;
  var currentDoor = null;  // открытый день
  var draftFiles = [];     // вложения в форме ответа: {name, type, size, url}
  // метка секретной ссылки t.me/бот?startapp=qr (в браузере для теста — ?startapp=qr)
  var startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get('startapp') || '';
  var eggPending = startParam === 'qr';

  document.querySelectorAll('[data-title]').forEach(function (el) { el.textContent = cfg.TITLE || 'адвент-календарь'; });

  // ---------------- локальные счётчики (пасхалки для достижений) ----------------
  var LOCAL_KEY = 'bzik-advent-local';
  var local = { mascotTaps: 0, tracks: [] };
  try { Object.assign(local, JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}); } catch (e) {}
  function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)); } catch (e) {} }
  Snd.onTrack(function (name) {
    if (local.tracks.indexOf(name) < 0) { local.tracks.push(name); saveLocal(); checkAchievements(); }
  });

  // ---------------- Telegram ----------------
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor && tg.setHeaderColor('#ffffff');
      tg.setBackgroundColor && tg.setBackgroundColor('#ffffff');
      tg.disableVerticalSwipes && tg.disableVerticalSwipes();
      tg.BackButton && tg.BackButton.onClick(function () { Snd.play('tap'); showCalendar(); });
    } catch (e) { /* старые клиенты */ }
  }
  function haptic(kind) {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind === 'ok') tg.HapticFeedback.notificationOccurred('success');
      else if (kind === 'err') tg.HapticFeedback.notificationOccurred('error');
      else tg.HapticFeedback.impactOccurred('light');
    } catch (e) {}
  }

  // ---------------- утилиты ----------------
  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    document.body.classList.toggle('door', id === 'screen-door' || id === 'screen-ach');
    window.scrollTo(0, 0);
    if (tg && tg.BackButton) {
      if (id === 'screen-door' || id === 'screen-ach') tg.BackButton.show(); else tg.BackButton.hide();
    }
  }
  var esc = Sl.esc, inline = Sl.inline;
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function fail(e) {
    haptic('err');
    Snd.play('locked');
    toast((e && e.message ? e.message.toLowerCase() : '') || 'что-то пошло не так. попробуй ещё раз');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtLeft(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' мб' : Math.max(1, Math.round(b / 1024)) + ' кб'; }
  function boxSrc(n, opened) { return 'assets/boxes/box-' + pad(n) + (opened ? '-open' : '-closed') + '.png?v=' + ASSET_V; }
  function serverNow() { return Date.now() + clockOffset; }
  function setState(s) { state = s; clockOffset = (s.now || Date.now()) - Date.now(); checkAchievements(); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // общий звук нажатия на любые кнопки
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (b && !b.classList.contains('cell') && !b.classList.contains('mascot-btn') && !b.classList.contains('sound-btn') && !b.classList.contains('s-gift')) Snd.play('tap');
  }, true);

  // ---------------- звук: кнопки ----------------
  function paintSound() {
    $('btn-music').style.backgroundImage = 'url(' + Px.iconMusic.url + ')';
    $('btn-sfx').style.backgroundImage = 'url(' + Px.iconSound.url + ')';
    $('btn-music').classList.toggle('off', !Snd.prefs.music);
    $('btn-sfx').classList.toggle('off', !Snd.prefs.sfx);
  }
  $('btn-music').onclick = function () { Snd.setMusic(!Snd.prefs.music); Snd.play('toggle'); paintSound(); toast(Snd.prefs.music ? 'музыка включена' : 'музыка выключена'); };
  $('btn-sfx').onclick = function () { Snd.setSfx(!Snd.prefs.sfx); Snd.play('toggle'); paintSound(); toast(Snd.prefs.sfx ? 'звуки включены' : 'звуки выключены'); };
  paintSound();

  // ---------------- маскот ----------------
  // исходный рисунок (руки скрещены) + моргание; движение — подпрыгивания и покачивания целиком
  var PHRASES = {
    hello: ['привет! как здорово, что ты здесь', 'с наступающим! давай знакомиться', 'хо-хо-хо! впереди 14 дней идей'],
    reg: ['впереди 14 дней идей и подарков', 'у тебя точно всё получится!', 'хо-хо-хо! пора творить', 'я буду рядом все 14 дней', 'с наступающим новым годом!'],
    cal: ['ты отлично справляешься!', 'каждая идея — маленькое чудо', 'хо-хо-хо! с наступающим!', 'сегодня отличный день для идей',
      'я в тебя верю!', 'даже маленькая идея — уже подарок', 'новый год — время для нового', 'твои идеи греют лучше какао',
      'снег идёт — идеи растут', 'загадай желание и придумай план', 'ты — настоящий волшебник идей'],
    done: ['ура! отличная работа!', 'вот это идея!', 'ты молодец, так держать!', 'ещё один подарок открыт!'],
    wait: ['завтра будет новый подарок!', 'отдыхай — идеи любят паузу', 'увидимся завтра у ёлки!'],
  };

  var MASCOT_SIZE = { big: [111, 219], small: [56, 110], modal: [56, 110], nr: [74, 146] };
  function Mascot(btn, size) {
    btn.innerHTML = '<img class="m" data-blink src="assets/mascot.png?v=2" alt=""><span class="shadow"></span>';
    btn.style.width = size[0] + 'px';
    btn.style.height = size[1] + 'px';
    function anim(cls, ms, done) {
      btn.classList.remove('wave', 'jump');
      void btn.offsetWidth;
      btn.classList.add(cls);
      setTimeout(function () { btn.classList.remove(cls); if (done) done(); }, ms);
    }
    var m = {
      el: btn,
      wave: function (times, done) { anim('wave', 900, done); },
      cheer: function (done) { anim('jump', 650, done); },
      // «заходит» на экран вприпрыжку из-за края
      walkIn: function (from, done) {
        if (reduced) { if (done) done(); return; }
        var dist = (from === 'right' ? 1 : -1) * (innerWidth * 0.7);
        btn.style.transition = 'none';
        btn.style.transform = 'translateX(' + dist + 'px)';
        void btn.offsetWidth;
        btn.classList.add('hop');
        btn.style.transition = 'transform 1.3s steps(13)';
        btn.style.transform = 'translateX(0)';
        setTimeout(function () {
          btn.classList.remove('hop');
          btn.style.transition = '';
          btn.style.transform = '';
          anim('jump', 650, done);
        }, 1350);
      },
    };
    btn.addEventListener('click', function () {
      Snd.play('hoho'); haptic();
      local.mascotTaps++; saveLocal(); checkAchievements();
      if (Math.random() < 0.5) m.cheer(); else m.wave();
      if (m.onTap) m.onTap();
    });
    return m;
  }

  // моргание всех маскотов
  (function blink() {
    setTimeout(function () {
      document.querySelectorAll('img[data-blink]').forEach(function (im) { im.src = 'assets/mascot-blink.png?v=2'; });
      setTimeout(function () {
        document.querySelectorAll('img[data-blink]').forEach(function (im) { im.src = 'assets/mascot.png?v=2'; });
        blink();
      }, 140);
    }, 2200 + Math.random() * 2600);
  })();

  var mascots = {};
  mascots.big = Mascot(document.querySelector('[data-mascot="big"]'), MASCOT_SIZE.big);
  mascots.small = Mascot(document.querySelector('[data-mascot="small"]'), MASCOT_SIZE.small);
  mascots.modal = Mascot(document.querySelector('[data-mascot="modal"]'), MASCOT_SIZE.modal);
  mascots.big.onTap = function () { say($('reg-bubble'), pick(PHRASES.reg)); };
  mascots.small.onTap = function () { say($('cal-bubble'), pick(PHRASES.cal)); };

  var bubbleTimers = {};
  function say(el, text, ms) {
    el.textContent = text;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(bubbleTimers[el.id]);
    if (ms !== 0) bubbleTimers[el.id] = setTimeout(function () { el.textContent = ''; }, ms || 3800);
  }
  // маскот в календаре иногда что-то говорит сам
  setInterval(function () {
    if ($('screen-calendar').classList.contains('active') && !$('cal-bubble').textContent && Math.random() < 0.5) say($('cal-bubble'), pick(PHRASES.cal));
  }, 8000);

  // ---------------- гирлянда: мигающие лампочки ----------------
  var garlands = Array.prototype.slice.call(document.querySelectorAll('canvas.garland'));
  var BULBS = ['#e02d2d', '#3aa64c', '#f5c33b', '#4f8ff0', '#ff7ad9'];
  function drawGarland(c, t) {
    var w = c.clientWidth;
    if (!w) return;
    var S = 3; // размер «пикселя»
    var W = Math.ceil(w / S), H = 10;
    if (c.width !== W) { c.width = W; c.height = H; }
    var x = c.getContext('2d');
    x.clearRect(0, 0, W, H);
    var step = 9, mode = Math.floor(t / 6000) % 3; // режимы: бегущий огонь, через одну, мерцание
    for (var i = 0; i * step < W + step; i++) {
      var x0 = i * step;
      x.fillStyle = '#141414';
      for (var k = 0; k < step; k++) x.fillRect(x0 + k, 1 + Math.round(Math.sin((k / step) * Math.PI) * 3), 1, 1);
      var bx = x0 + Math.floor(step / 2), by = 5;
      var col = BULBS[i % BULBS.length];
      var on = mode === 0 ? ((i + Math.floor(t / 260)) % 4 !== 0)
        : mode === 1 ? ((i + Math.floor(t / 520)) % 2 === 0)
        : (Math.sin(t / 300 + i * 1.7) > -0.2);
      x.fillStyle = '#141414'; x.fillRect(bx, by - 1, 1, 1);
      if (on) { x.globalAlpha = 0.28; x.fillStyle = col; x.fillRect(bx - 2, by - 1, 5, 6); x.globalAlpha = 1; }
      x.fillStyle = on ? col : '#9a9a9a';
      x.fillRect(bx - 1, by, 3, 3); x.fillRect(bx, by + 3, 1, 1);
      if (on) { x.fillStyle = '#ffffff'; x.fillRect(bx - 1, by, 1, 1); }
    }
  }

  // ---------------- снег ----------------
  var snow = (function () {
    var c = $('snow'), ctx = c.getContext('2d'), flakes = [], dpr = 1;
    function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    resize(); addEventListener('resize', resize);
    for (var i = 0; i < 46; i++) {
      flakes.push({ x: Math.random(), y: Math.random(), s: 2 + Math.floor(Math.random() * 3), v: .03 + Math.random() * .05, d: Math.random() * 6, big: i < 7 });
    }
    var flakeImg = new Image(); flakeImg.src = Px.flake.url;
    return function (dt) {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      flakes.forEach(function (f) {
        f.y += f.v * dt; f.d += dt;
        if (f.y > 1.03) { f.y = -0.03; f.x = Math.random(); }
        var px = Math.round(f.x * innerWidth + Math.sin(f.d) * 10), py = Math.round(f.y * innerHeight);
        if (f.big) { ctx.globalAlpha = 0.8; ctx.drawImage(flakeImg, px * dpr, py * dpr, 18 * dpr, 18 * dpr); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = f.s > 3 ? '#9fb6d1' : '#b9cadd'; ctx.fillRect(px * dpr, py * dpr, f.s * dpr, f.s * dpr); }
      });
    };
  })();

  // ---------------- плавающий декор и искорки ----------------
  (function decor() {
    var box = $('decor');
    var items = [
      // [спрайт, x%, y%, масштаб, качание] — по краям экрана, чтобы не закрывать контент
      ['tree', -1, 64, 3, ''], ['ballRed', 93, 18, 3, 'sway'], ['cane', 0, 34, 3, ''], ['bell', 92, 55, 3, 'sway'],
      ['star', 1, 88, 3, ''], ['ballBlue', 0, 12, 3, 'sway'], ['ballGreen', 93, 82, 3, 'sway'], ['star', 95, 38, 2, ''],
    ];
    items.forEach(function (it, k) {
      var sp = Px[it[0]];
      var im = document.createElement('img');
      im.className = 'd ' + it[4];
      im.src = sp.url;
      im.style.left = it[1] + '%';
      im.style.top = it[2] + '%';
      im.style.width = sp.w * it[3] + 'px';
      im.style.height = sp.h * it[3] + 'px';
      im.style.setProperty('--r', (k % 2 ? 6 : -6) + 'deg');
      im.style.animationDelay = (-k * 0.9) + 's';
      im.style.transformOrigin = it[4] ? '50% 0' : '50% 50%';
      box.appendChild(im);
    });
    if (reduced) return;
    setInterval(function () {
      if (document.hidden) return;
      var s = document.createElement('img');
      s.className = 'tw';
      s.src = Px.sparkle.url;
      s.style.left = (Math.random() * 94) + '%';
      s.style.top = (Math.random() * 94) + '%';
      box.appendChild(s);
      setTimeout(function () { s.remove(); }, 1700);
    }, 700);
  })();

  (function loop() {
    var last = performance.now();
    function frame(t) {
      var dt = Math.min(64, t - last) / 1000; last = t;
      if (!reduced) snow(dt);
      garlands.forEach(function (g) { if (g.offsetParent) drawGarland(g, t); });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ---------------- регистрация ----------------
  var regShown = false;
  function showRegister() {
    show('screen-register');
    if (regShown) return;
    regShown = true;
    $('reg-bubble').textContent = '';
    mascots.big.walkIn('left', function () { say($('reg-bubble'), pick(PHRASES.hello), 0); });
  }

  $('register-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('name-input').value.trim().replace(/\s+/g, ' ');
    var err = $('register-error');
    if (name.length < 2) { err.textContent = 'напиши имя или ник — хотя бы 2 символа'; err.hidden = false; Snd.play('locked'); return; }
    err.hidden = true;
    var btn = e.target.querySelector('button');
    btn.disabled = true;
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (er) {}
    api.register(name, tz).then(function (s) {
      haptic('ok');
      Snd.play('success');
      setState(s);
      showCalendar(true);
    }).catch(fail).finally(function () { btn.disabled = false; });
  });

  // ---------------- календарь ----------------
  var calShown = false;
  function showCalendar(skipFetch) {
    currentDoor = null;
    var p = skipFetch && state ? Promise.resolve(state) : api.state().then(function (s) { setState(s); return s; });
    return p.then(function (s) {
      if (!s.user) {
        // нет регистрации (впервые или прогресс сброшен) — достижения начнутся заново
        try { localStorage.removeItem(SEEN_KEY); } catch (e) {}
        showRegister(); return;
      }
      renderCalendar(s);
      show('screen-calendar');
      if (eggPending) { eggPending = false; claimEgg('qr'); }
      if (!calShown) {
        calShown = true;
        $('cal-bubble').textContent = '';
        mascots.small.walkIn('right', function () {
          var open = s.doors.filter(function (d) { return d.status === 'open'; })[0];
          say($('cal-bubble'), open ? 'привет, ' + s.user.name.split(' ')[0] + '! подарок дня ждёт' : pick(PHRASES.wait));
        });
      }
    }).catch(fail);
  }

  function renderCalendar(s) {
    $('user-name').textContent = s.user.name;
    var done = s.doors.filter(function (d) { return d.status === 'done'; }).length;
    $('progress').innerHTML = s.doors.map(function (d) { return '<i class="' + (d.status === 'done' ? 'on' : '') + '"></i>'; }).join('');
    $('progress-text').textContent = 'пройдено ' + done + ' из ' + s.doors.length + (s.testMode ? ' · 🔓 режим проверки' : '');
    $('final').hidden = !s.complete;
    var ach = mergedAchievements();
    $('ach-btn-icon').src = Px.icons.trophy.url;
    $('ach-count').textContent = ach.filter(function (a) { return a.got; }).length + '/' + ach.length;

    var grid = $('grid');
    grid.innerHTML = '';
    s.doors.forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'cell ' + d.status + (d.unlockAt ? ' timer' : '');
      b.dataset.n = d.n;
      var opened = d.status === 'done';
      var note = '';
      if (d.status === 'open') note = d.ready === false ? 'скоро' : 'открой!';
      else if (d.status === 'done') note = 'пройден';
      else if (d.waitFor) note = 'после дня ' + d.waitFor;
      b.setAttribute('aria-label', 'день ' + d.n + ', ' + ({ done: 'пройден', open: 'доступен', locked: 'закрыт' })[d.status]);
      b.innerHTML =
        '<div class="box-wrap">' +
          '<img class="box-img ' + (opened ? 'opened' : 'closed') + '" src="' + boxSrc(d.n, opened) + '" alt="">' +
          (d.status === 'locked' ? '<img class="lock px" src="' + Px.lock.url + '" alt="">' : '') +
        '</div>' +
        '<span class="num">день ' + d.n + '</span>' +
        '<span class="note"' + (d.unlockAt ? ' data-unlock="' + d.unlockAt + '"' : '') + '>' + note + '</span>';
      b.addEventListener('click', function () { onCellClick(d, b); });
      grid.appendChild(b);
    });
    tickTimers();
    clearInterval(timerId);
    timerId = setInterval(tickTimers, 1000);
  }

  function tickTimers() {
    var els = document.querySelectorAll('[data-unlock]');
    for (var i = 0; i < els.length; i++) {
      var left = +els[i].dataset.unlock - serverNow();
      if (left <= 0) { clearInterval(timerId); showCalendar(); return; }
      els[i].textContent = 'через ' + fmtLeft(left);
    }
  }

  function onCellClick(d, el) {
    haptic();
    if (d.status === 'locked') {
      Snd.play('locked');
      if (d.unlockAt) toast('день ' + d.n + ' откроется через ' + fmtLeft(d.unlockAt - serverNow()));
      else toast('сначала ответь на задание предыдущего дня');
      var w = el.querySelector('.box-wrap');
      if (w.animate) w.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 260 });
      return;
    }
    if (d.status === 'open') {
      Snd.play('open');
      el.classList.add('opening');
      setTimeout(function () { openDoor(d.n); }, reduced ? 0 : 420);
      return;
    }
    Snd.play('tap');
    openDoor(d.n);
  }

  // ---------------- день ----------------
  function openDoor(n) {
    api.door(n).then(function (door) {
      currentDoor = door;
      renderDoor(door);
      show('screen-door');
      fitSlides(); // размеры известны только когда экран видим
    }).catch(fail);
  }

  function renderDoor(door) {
    var c = door.content;
    $('door-num').textContent = 'день ' + door.n;
    $('door-title').textContent = c && c.title ? c.title : '';
    var body = $('door-body');

    if (!c) {
      body.innerHTML =
        '<div class="not-ready">' +
          '<button class="mascot-btn" data-mascot="nr" aria-label="маскот"></button>' +
          '<h2 class="title tiny">этот день пока не готов</h2>' +
          '<p>загляни сюда чуть позже — мы уже заворачиваем подарок</p>' +
          '<button class="btn" id="nr-back">к календарю</button>' +
        '</div>';
      Mascot(body.querySelector('[data-mascot]'), MASCOT_SIZE.nr).wave();
      $('nr-back').onclick = function () { showCalendar(); };
      return;
    }

    var slides = c.slides || [];
    var a = door.answer;
    draftFiles = a ? (a.files || (a.photos || []).map(function (u, k) { return { name: 'фото ' + (k + 1) + '.jpg', type: 'image/jpeg', size: 0, url: u }; })).slice() : [];
    body.innerHTML =
      '<div class="carousel" id="carousel">' +
        '<div class="viewport"><div class="track">' + slides.map(function (s, i) { return Sl.render(s, i, slides.length, door.n); }).join('') + '</div></div>' +
        '<div class="cnav"><button class="nav prev" aria-label="назад">‹</button>' +
          '<div class="dots">' + slides.map(function () { return '<i></i>'; }).join('') + '</div>' +
          '<button class="nav next" aria-label="дальше">›</button></div>' +
      '</div>' +
      '<div class="task"><span class="task-tag">задание</span><p class="task-text">' + String(c.task || '').split('\n').map(inline).join('<br>') + '</p></div>' +
      '<span class="section-label"><span class="hl">твой ответ</span></span>' +
      '<div class="answer">' +
        (a ? '<p class="answer-status">✓ ответ сохранён — его можно изменить</p>' : '') +
        '<textarea class="textarea" id="answer-text" placeholder="пиши сюда свои идеи — каждую с новой строки…" maxlength="4000"></textarea>' +
        '<div class="files" id="files"></div>' +
        '<input type="file" multiple class="file-input" id="file-input">' +
        '<div class="answer-actions">' +
          '<button class="btn btn-small" id="add-file">+ файл</button>' +
          '<button class="btn btn-primary" id="send-answer">' + (a ? 'сохранить изменения' : 'отправить ответ') + '</button>' +
        '</div>' +
        '<p class="files-hint">можно прикрепить фото, pdf, word, excel, презентацию — до ' + MAX_FILES + ' файлов по ' + MAX_FILE_MB + ' мб</p>' +
        (cfg.CHANNEL_URL ? '<a class="btn btn-channel" id="channel-btn" href="' + esc(cfg.CHANNEL_URL) + '" target="_blank" rel="noopener">👀 подсмотреть за креаторами</a>' +
          '<p class="files-hint">видеоразборы этого задания от креаторов — в канале</p>' : '') +
      '</div>';

    $('answer-text').value = a ? a.text || '' : '';
    renderFiles();
    var car = Sl.carousel($('carousel'), function () { Snd.play('swipe'); haptic(); });
    Sl.bindCover($('carousel'), function (first) {
      if (first) { Snd.play('open'); haptic('ok'); } else car.go(1);
    });
    fitSlides();

    $('add-file').onclick = function () { $('file-input').click(); };
    $('file-input').onchange = function (e) { addFiles(e.target.files); e.target.value = ''; };
    $('send-answer').onclick = sendAnswer;
    if ($('channel-btn')) $('channel-btn').onclick = openChannel;
  }

  function fitSlides() {
    var root = $('carousel');
    if (!root) return;
    requestAnimationFrame(function () { Sl.fit(root); });
    // картинки (фото на слайдах) меняют высоту, когда загрузятся — подгоняем ещё раз
    root.querySelectorAll('.slide img').forEach(function (im) {
      if (!im.complete) im.addEventListener('load', function () { Sl.fit(root); }, { once: true });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { Sl.fit(root); });
  }

  // ---------------- вложения ----------------
  function ext(name) { var m = /\.([a-z0-9]{1,5})$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'файл'; }
  function renderFiles() {
    var box = $('files');
    box.innerHTML = '';
    draftFiles.forEach(function (f, i) {
      var d = document.createElement('div');
      var isImg = /^image\//.test(f.type) && f.url;
      d.className = 'file' + (isImg ? ' img' : '');
      if (isImg) d.style.backgroundImage = 'url("' + f.url + '")';
      else d.innerHTML = '<img class="px" src="' + Px.icons.doc.url + '" alt=""><span class="ext">' + esc(ext(f.name)) + '</span>' +
        '<span class="fname">' + esc(f.name) + '</span>' + (f.size ? '<span class="fsize">' + fmtSize(f.size) + '</span>' : '');
      var x = document.createElement('button');
      x.textContent = '×';
      x.setAttribute('aria-label', 'убрать файл');
      x.onclick = function () { draftFiles.splice(i, 1); renderFiles(); };
      d.appendChild(x);
      box.appendChild(d);
    });
    var add = $('add-file');
    if (add) add.disabled = draftFiles.length >= MAX_FILES;
  }

  function addFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    var room = MAX_FILES - draftFiles.length;
    if (list.length > room) toast('можно прикрепить до ' + MAX_FILES + ' файлов');
    list.slice(0, room).reduce(function (p, f) {
      return p.then(function () {
        if (f.size > MAX_FILE_MB * 1048576) { toast('«' + f.name + '» больше ' + MAX_FILE_MB + ' мб'); return null; }
        // фото сжимаем, остальные файлы прикладываем как есть
        return (/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) ? compress(f) : readFile(f)).catch(function () { return readFile(f); });
      }).then(function (item) { if (item) { draftFiles.push(item); Snd.play('photo'); renderFiles(); } });
    }, Promise.resolve()).catch(function () { toast('не получилось прочитать файл'); });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, url: r.result }); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // сжимаем фото до 1600px по длинной стороне, JPEG ~82%
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var data = c.toDataURL('image/jpeg', 0.82);
        resolve({ name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round(data.length * 0.75), url: data });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function sendAnswer() {
    var text = $('answer-text').value.trim();
    if (!text && !draftFiles.length) { Snd.play('locked'); toast('напиши ответ или прикрепи файл'); $('answer-text').focus(); return; }
    var btn = $('send-answer');
    var wasAnswered = !!currentDoor.answer;
    btn.disabled = true;
    btn.textContent = draftFiles.some(function (f) { return !f.key; }) ? 'загружаю файлы…' : 'сохраняю…';
    var n = currentDoor.n;
    api.answer(n, { text: text, files: draftFiles }).then(function (s) {
      setState(s);
      haptic('ok');
      // перечитываем день: у загруженных файлов появились ключи и ссылки
      return api.door(n).then(function (door) { currentDoor = door; return s; }, function () {
        currentDoor.answer = { text: text, files: draftFiles.slice() }; return s;
      });
    }).then(function (s) {
      if (wasAnswered) { Snd.play('toggle'); toast('изменения сохранены'); renderDoor(currentDoor); fitSlides(); return; }
      renderDoor(currentDoor); fitSlides();
      Snd.play('success');
      var last = currentDoor.n === s.doors.length;
      $('modal-title').textContent = last ? 'календарь пройден!' : pick(PHRASES.done);
      $('modal-text').textContent = last
        ? 'ты прошёл все 14 дней. это было креативно — с наступающим!'
        : 'ответ принят. день ' + (currentDoor.n + 1) + ' откроется завтра в 00:00 по твоему времени. ответ можно изменить в любой момент.';
      $('modal').hidden = false;
      mascots.modal.cheer(function () { mascots.modal.cheer(); });
      confetti();
    }).catch(function (e) {
      fail(e);
      if ($('send-answer')) $('send-answer').textContent = wasAnswered ? 'сохранить изменения' : 'отправить ответ';
    }).finally(function () { if ($('send-answer')) $('send-answer').disabled = false; });
  }

  // пиксельное конфетти
  function confetti() {
    if (reduced) return;
    var c = $('confetti'), x = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    var cols = ['#e02d2d', '#3aa64c', '#f5c33b', '#4f8ff0', '#ff7ad9'];
    var ps = [];
    for (var i = 0; i < 90; i++) ps.push({ x: innerWidth / 2, y: innerHeight * 0.45, vx: (Math.random() - .5) * 9, vy: -Math.random() * 11 - 3, c: pick(cols), s: 4 + Math.floor(Math.random() * 3) * 2 });
    var t0 = performance.now();
    (function f(t) {
      x.clearRect(0, 0, c.width, c.height);
      ps.forEach(function (p) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; x.fillStyle = p.c; x.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.s, p.s); });
      if (t - t0 < 2600 && !$('modal').hidden) requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height);
    })(t0);
  }

  $('modal-ok').onclick = function () { $('modal').hidden = true; showCalendar(true); };

  // ---------------- канал креаторов ----------------
  function openChannel(e) {
    e.preventDefault();
    Snd.play('tap');
    haptic();
    var url = cfg.CHANNEL_URL;
    function go() {
      try {
        if (tg && tg.initData && tg.openTelegramLink && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url);
        else window.open(url, '_blank');
      } catch (er) { window.open(url, '_blank'); }
    }
    // сначала отмечаем переход (достижение «за кулисами»), потом открываем канал — но ждём не дольше 1,5 с
    var timer = new Promise(function (r) { setTimeout(r, 1500); });
    Promise.race([api.mark('channel').then(setState).catch(function () {}), timer]).then(go);
  }

  // ---------------- пасхалка: секретный QR-код ----------------
  function claimEgg(code) {
    api.egg(code).then(function (s) {
      setState(s);
      renderCalendar(s);
      Snd.play('success');
      haptic('ok');
      $('modal-title').textContent = 'ты нашёл пасхалку! 🕵️';
      $('modal-text').textContent = 'секрет qr-кода: квадраты в трёх углах — это «глаза» для камеры. ' +
        'Масахиро Хара с командой изучил горы газет и листовок и выбрал соотношение чёрного и белого 1:1:3:1:1 — ' +
        'оно почти не встречается в печати, поэтому камера никогда не путает код с картинкой.';
      $('modal').hidden = false;
      mascots.modal.cheer(function () { mascots.modal.cheer(); });
      confetti();
    }).catch(function () { /* без подписи Telegram секрет не засчитывается — молчим */ });
  }

  // нажатие на QR-код или фото в слайде — показываем крупно
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.s-qr, [data-zoom]');
    if (!b) return;
    Snd.play('tap');
    var o = document.createElement('div');
    o.className = 'qr-zoom';
    o.innerHTML = b.classList.contains('s-qr')
      ? '<div class="qr-zoom-card"><img class="px" src="assets/qr-egg.png?v=1" alt="qr-код">' +
        '<p>наведи камеру другого телефона — или сделай скриншот и открой его в галерее 📷</p>' +
        '<button class="btn">закрыть</button></div>'
      : '<div class="qr-zoom-card photo"><img class="' + (b.querySelector('img.orig') ? 'orig' : 'px') + '" src="' + b.getAttribute('data-zoom') + '" alt="">' +
        '<button class="btn">закрыть</button></div>';
    o.onclick = function (ev) { if (ev.target === o || ev.target.tagName === 'BUTTON') o.remove(); };
    document.body.appendChild(o);
  });
  $('door-back').onclick = function () { showCalendar(); };

  // ---------------- достижения ----------------
  var SEEN_KEY = 'bzik-advent-ach-seen';
  function mergedAchievements() {
    var list = (state && state.achievements) || [];
    return list.map(function (a) {
      if (!a.local) return a;
      var v = a.id === 'mascot' ? local.mascotTaps : a.id === 'music' ? local.tracks.length : a.value;
      v = Math.min(a.goal, v);
      return Object.assign({}, a, { value: v, got: v >= a.goal });
    });
  }
  var achQueue = [], achBusy = false;
  function checkAchievements() {
    if (!state || !state.user) return;
    var seen = [];
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch (e) {}
    mergedAchievements().forEach(function (a) {
      if (a.got && seen.indexOf(a.id) < 0) { seen.push(a.id); achQueue.push(a); }
    });
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
    if (!achBusy) nextAchPopup();
    if ($('screen-ach').classList.contains('active')) renderAchievements();
  }
  function nextAchPopup() {
    var a = achQueue.shift();
    if (!a) { achBusy = false; return; }
    achBusy = true;
    var el = document.createElement('div');
    el.className = 'ach-pop';
    el.innerHTML = '<img class="px" src="' + (Px.icons[a.icon] || Px.star).url + '" alt=""><div><small>новое достижение!</small><b>' + esc(a.title) + '</b></div>';
    document.body.appendChild(el);
    Snd.play('success');
    haptic('ok');
    el.onclick = function () { showAchievements(); };
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { el.remove(); nextAchPopup(); }, 3000);
  }
  function renderAchievements() {
    var list = mergedAchievements();
    var got = list.filter(function (a) { return a.got; }).length;
    $('ach-sub').textContent = 'получено ' + got + ' из ' + list.length;
    // полученные — наверху, остальные — в исходном порядке
    list = list.filter(function (a) { return a.got; }).concat(list.filter(function (a) { return !a.got; }));
    $('ach-list').innerHTML = list.map(function (a) {
      var icon = (Px.icons[a.icon] || Px.star).url;
      var prog = a.goal > 1 && !a.got
        ? '<div class="ach-prog"><i style="width:' + Math.round(a.value / a.goal * 100) + '%"></i></div><span class="ach-num">' + a.value + ' / ' + a.goal + '</span>'
        : '';
      return '<div class="ach' + (a.got ? ' got' : '') + '"><div class="ach-icon"><img class="px" src="' + icon + '" alt=""></div>' +
        '<div class="ach-text"><b>' + esc(a.title) + '</b><span>' + esc(a.desc) + '</span>' + prog + '</div>' +
        (a.got ? '<span class="ach-ok">✓</span>' : '') + '</div>';
    }).join('');
  }
  function showAchievements() {
    renderAchievements();
    show('screen-ach');
  }
  $('ach-btn').onclick = showAchievements;
  $('ach-back').onclick = function () { showCalendar(true); };

  // ---------------- тестовый режим ----------------
  if (api.mode === 'mock') {
    $('debug').hidden = false;
    $('dbg-day').onclick = function () { api.debugShiftDay(); toast('время сдвинуто на сутки вперёд'); if (currentDoor) openDoor(currentDoor.n); else showCalendar(); };
    $('dbg-reset').onclick = function () {
      api.debugReset();
      try { localStorage.removeItem(SEEN_KEY); localStorage.removeItem(LOCAL_KEY); } catch (e) {}
      location.reload();
    };
  }

  showCalendar();
})();
