/*
 * Слайды карусели в стиле постов бзика: белый лист, крупный узкий заголовок
 * с пунктиром, «выделенный» голубым текст, пунктирные рамки и кружки,
 * пиксельные картинки. Все размеры — в cqw (доля ширины слайда),
 * поэтому слайд выглядит как картинка 1:1 на любом экране.
 *
 * BzikSlides.render(slide, i, total) -> HTML
 * BzikSlides.carousel(rootEl, onChange)  — свайпы мышью/пальцем, стрелки, точки
 */
(function () {
  'use strict';

  var Px = window.BzikPixels;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // **жирный**, _курсив_, ==выделение==
  function inline(s) {
    return esc(s)
      .replace(/==(.+?)==/g, '<mark class="sel">$1</mark>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(«])_(.+?)_(?=$|[\s.,!?»)])/g, '$1<i>$2</i>');
  }
  function paras(text) {
    return String(text || '').split('\n').filter(function (l) { return l.trim(); })
      .map(function (l) { return '<p>' + inline(l) + '</p>'; }).join('');
  }

  // ---------- пиксельные картинки, нарисованные кодом ----------
  function rng(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }
  function canvasUrl(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    return c.toDataURL();
  }
  var ART_CACHE = {};
  var ART = {
    go: function () {
      return canvasUrl(41, 41, function (x) {
        x.fillStyle = '#e8c27a'; x.fillRect(0, 0, 41, 41);
        x.fillStyle = '#8a5a2b';
        for (var i = 0; i < 9; i++) { x.fillRect(4 + i * 4, 4, 1, 33); x.fillRect(4, 4 + i * 4, 33, 1); }
        var r = rng(7);
        for (var k = 0; k < 26; k++) {
          var cx = 4 + Math.floor(r() * 9) * 4, cy = 4 + Math.floor(r() * 9) * 4, white = r() > 0.5;
          x.fillStyle = '#141414'; x.fillRect(cx - 2, cy - 1, 5, 3); x.fillRect(cx - 1, cy - 2, 3, 5);
          if (white) { x.fillStyle = '#ffffff'; x.fillRect(cx - 1, cy - 1, 3, 3); }
        }
      });
    },
    qr: function () {
      return canvasUrl(29, 29, function (x) {
        x.fillStyle = '#fff'; x.fillRect(0, 0, 29, 29);
        x.fillStyle = '#141414';
        var r = rng(42);
        for (var j = 0; j < 25; j++) for (var i = 0; i < 25; i++) if (r() > 0.52) x.fillRect(2 + i, 2 + j, 1, 1);
        [[2, 2], [20, 2], [2, 20]].forEach(function (p) {
          x.fillStyle = '#fff'; x.fillRect(p[0] - 1, p[1] - 1, 9, 9);
          x.fillStyle = '#141414'; x.fillRect(p[0], p[1], 7, 7);
          x.fillStyle = '#fff'; x.fillRect(p[0] + 1, p[1] + 1, 5, 5);
          x.fillStyle = '#141414'; x.fillRect(p[0] + 2, p[1] + 2, 3, 3);
        });
      });
    },
    barcode: function () {
      return canvasUrl(40, 20, function (x) {
        x.fillStyle = '#fff'; x.fillRect(0, 0, 40, 20);
        x.fillStyle = '#141414';
        var r = rng(3), px = 2;
        while (px < 38) { var w = 1 + Math.floor(r() * 2); x.fillRect(px, 2, w, 14); px += w + 1 + Math.floor(r() * 2); }
        x.fillStyle = '#e02d2d'; x.fillRect(1, 9, 38, 1); // «сканер»
      });
    },
  };
  function artImg(name) {
    if (!name) return '';
    var m = /^gift:(\d+)$/.exec(name);
    if (m) {
      var n = ('0' + m[1]).slice(-2);
      return '<img class="px" src="assets/boxes/box-' + n + '-closed.png?v=2" alt="">';
    }
    // настоящий QR-код с секретной ссылкой — кнопка, по нажатию показывается крупно
    if (name === 'qr') return '<button type="button" class="s-qr" aria-label="показать код крупно"><img class="px" src="assets/qr-egg.png?v=1" alt=""></button>';
    if (name === 'mascot') return '<img class="px mascot-img" data-blink src="assets/mascot/idle.png?v=1" alt="">';
    if (ART[name]) { ART_CACHE[name] = ART_CACHE[name] || ART[name](); return '<img class="px" src="' + ART_CACHE[name] + '" alt="">'; }
    if (Px[name]) return '<img class="px" src="' + Px[name].url + '" alt="">';
    return '';
  }

  // ---------- шаблоны ----------
  var T = {
    // обложка-открытка: огоньки, снег, ёлки и подарок, который открывается по нажатию
    cover: function (s, n) {
      var num = ('0' + n).slice(-2);
      var bulbs = '';
      for (var k = 0; k < 11; k++) bulbs += '<i></i>';
      return '<div class="s-gc">' +
        '<div class="s-gc-lights">' + bulbs + '</div>' +
        '<img class="px s-gc-tree l" src="' + Px.tree.url + '" alt="">' +
        '<img class="px s-gc-tree r" src="' + Px.tree.url + '" alt="">' +
        '<div class="s-gc-drift"></div>' +
        '<div class="s-gc-day">день ' + n + ' из 14</div>' +
        // до открытия подарка в рамке «??????», заголовок прячется в коробке и вылетает из неё
        '<div class="s-boxed"><span class="s-qm">??????</span><span class="s-title">' + esc(s.title) + '</span></div>' +
        '<button class="s-gift" type="button" aria-label="открыть подарок">' +
          '<span class="s-gift-rays"></span>' +
          '<img class="px s-gift-img" src="assets/boxes/box-' + num + '-closed.png?v=2" data-open="assets/boxes/box-' + num + '-open.png?v=2" alt="">' +
        '</button>' +
        '<div class="s-gc-hint"><mark class="sel">нажми на подарок</mark></div>' +
        '<div class="s-gc-sub">' + esc(s.subtitle || '') + '<span class="s-swipe">листай дальше →</span></div>' +
      '</div>';
    },
    text: function (s) {
      // фото-«полароид» (файл в assets/photos/); по нажатию открывается крупно.
      // photoSide: true — фото справа от текста (для вертикальных снимков), иначе — под заголовком
      var src = s.photo ? 'assets/photos/' + esc(s.photo) + '?v=2' : '';
      var photo = s.photo ? '<button type="button" class="s-photo' + (s.photoSide ? ' side' : '') + '" data-zoom="' + src + '" aria-label="открыть фото">' +
        '<img class="' + (s.photoOriginal ? 'orig' : 'px') + '" src="' + src + '" alt=""></button>' : '';
      var body = '<div class="s-body' + (s.art ? ' with-art' : '') + '">' + paras(s.text) + '</div>';
      return '<div class="s-pad">' +
        '<h3 class="s-h">' + esc(s.heading) + '</h3>' +
        (s.photo && s.photoSide ? '<div class="s-row">' + body + photo + '</div>' : photo + body) +
        (s.art ? '<div class="s-art s-dash-box">' + artImg(s.art) + '</div>' : '') +
        '</div>';
    },
    steps: function (s) {
      var items = s.items || [];
      return '<div class="s-pad">' +
        '<h3 class="s-h">' + esc(s.heading) + '</h3>' +
        '<ol class="s-steps n' + items.length + '">' + items.map(function (it, k) {
          return '<li><span class="s-step-n">' + (k + 1) + '</span><span class="s-step-t"><b>' + inline(it.title) + '</b> ' + inline(it.text || '') + '</span></li>';
        }).join('') + '</ol></div>';
    },
    formula: function (s) {
      var parts = s.parts || [];
      return '<div class="s-pad">' +
        '<h3 class="s-h">' + esc(s.heading) + '</h3>' +
        '<div class="s-formula">' + parts.map(function (p, k) {
          return (k ? '<span class="s-plus">+</span>' : '') + '<span class="s-dash-circle s-word">' + esc(p) + '</span>';
        }).join('') + '</div>' +
        '<div class="s-body">' + paras(s.text) + '</div></div>';
    },
    number: function (s) {
      return '<div class="s-pad">' +
        '<h3 class="s-h">' + esc(s.heading) + '</h3>' +
        '<div class="s-number"><span class="s-dash-circle s-big">' + esc(s.value) + '</span></div>' +
        '<div class="s-body">' + paras(s.text) + '</div></div>';
    },
    quote: function (s) {
      return '<div class="s-pad s-quote-wrap">' +
        '<div class="s-quote">' + paras(s.text) + '</div>' +
        (s.art ? '<div class="s-quote-art">' + artImg(s.art) + '</div>' : '') +
        '</div>';
    },
  };

  function render(slide, i, total, n) {
    var type = T[slide.type] ? slide.type : 'text';
    // обратная совместимость со старым форматом { text, style }
    if (!slide.type && slide.style === 'big') { type = 'quote'; }
    return '<div class="slide t-' + type + '"><div class="slide-in">' + T[type](slide, n) + '</div></div>';
  }

  // подгонка: если текст не влез — уменьшаем масштаб слайда
  function fit(root) {
    root.querySelectorAll('.slide').forEach(function (sl) {
      var inner = sl.querySelector('.slide-in');
      var k = 1;
      sl.style.setProperty('--k', k);
      while (inner.scrollHeight > inner.clientHeight + 1 && k > 0.7) {
        k = Math.round((k - 0.04) * 100) / 100;
        sl.style.setProperty('--k', k);
      }
    });
  }

  // ---------- карусель ----------
  function carousel(root, onChange) {
    var track = root.querySelector('.track');
    var slides = track.children;
    var dots = root.querySelector('.dots');
    var prev = root.querySelector('.nav.prev');
    var next = root.querySelector('.nav.next');
    var n = slides.length, i = 0;
    var startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;

    function go(k, silent) {
      k = Math.max(0, Math.min(n - 1, k));
      var changed = k !== i;
      i = k;
      track.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1)';
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      for (var d = 0; d < dots.children.length; d++) dots.children[d].classList.toggle('on', d === i);
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
      if (changed && !silent && onChange) onChange(i);
    }

    function down(e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; decided = false; horizontal = false; dx = 0;
      startX = e.clientX; startY = e.clientY;
      track.style.transition = 'none';
    }
    function move(e) {
      if (!dragging) return;
      var mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
        decided = true;
        horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal && track.setPointerCapture) { try { track.setPointerCapture(e.pointerId); } catch (er) {} }
      }
      if (!horizontal) return;
      e.preventDefault();
      dx = mx;
      var edge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0) ? 0.35 : 1; // «резинка» на краях
      track.style.transform = 'translateX(calc(' + (-i * 100) + '% + ' + dx * edge + 'px))';
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      if (!horizontal) { go(i, true); return; }
      var w = root.offsetWidth || 1;
      if (dx < -w * 0.15) go(i + 1);
      else if (dx > w * 0.15) go(i - 1);
      else go(i, true);
    }

    track.addEventListener('pointerdown', down);
    track.addEventListener('pointermove', move, { passive: false });
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
    track.addEventListener('lostpointercapture', up);
    // не даём браузеру утащить картинку
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
    prev.addEventListener('click', function () { go(i - 1); });
    next.addEventListener('click', function () { go(i + 1); });
    for (var d = 0; d < dots.children.length; d++) {
      (function (k) { dots.children[k].addEventListener('click', function () { go(k); }); })(d);
    }
    root.tabIndex = 0;
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    });
    go(0, true);
    return { go: go };
  }

  // подарок на обложке: по нажатию открывается, появляется подзаголовок
  function bindCover(root, onOpen) {
    root.querySelectorAll('.s-gift').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var gc = btn.closest('.s-gc');
        if (gc.classList.contains('opened')) { if (onOpen) onOpen(false); return; }
        var img = btn.querySelector('img');
        // откуда вылетает заголовок: из центра подарка в рамку
        var title = gc.querySelector('.s-title');
        var g = img.getBoundingClientRect(), t = title.getBoundingClientRect();
        title.style.setProperty('--fx', Math.round((g.left + g.width / 2) - (t.left + t.width / 2)) + 'px');
        title.style.setProperty('--fy', Math.round((g.top + g.height / 3) - (t.top + t.height / 2)) + 'px');
        img.src = img.dataset.open;
        gc.classList.add('opened');
        if (onOpen) onOpen(true);
      });
    });
  }

  window.BzikSlides = { render: render, carousel: carousel, fit: fit, inline: inline, esc: esc, bindCover: bindCover };
})();
