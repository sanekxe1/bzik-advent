/*
 * Звук без файлов: всё синтезируется Web Audio.
 *  - музыка: плейлист из 4 новогодних мелодий в 8 бит (квадрат + треугольный бас + шум-хэт), каждая следующая — другая;
 *  - эффекты: нажатие, открытие створки, замок, листание, успех, фанфары.
 * Браузеры не дают играть звук без касания, поэтому контекст создаётся на первом тапе.
 */
(function () {
  'use strict';

  var KEY = 'bzik-advent-sound';
  var prefs = { music: true, sfx: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }

  var ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  var loopTimer = null, playing = false;

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // одна нота: тип волны, частота, время, длительность, громкость, куда
  function tone(type, f, t, dur, vol, bus, slideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function hat(t, vol, bus) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + 0.06);
    return s;
  }

  // ---------------- музыка: плейлист 8-битных мелодий ----------------
  // Все мелодии — народные или старше 100 лет (общественное достояние).
  // melody: [midi, доли]; midi 0 — пауза. bass: [корень, доли]; meter — долей в такте.
  var C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;
  var JB_A = [[E5, 1], [E5, 1], [E5, 2], [E5, 1], [E5, 1], [E5, 2], [E5, 1], [G5, 1], [C5, 1.5], [D5, .5], [E5, 4]];
  var JB_B = [[F5, 1], [F5, 1], [F5, 1.5], [F5, .5], [F5, 1], [E5, 1], [E5, 1], [E5, .5], [E5, .5], [E5, 1], [D5, 1], [D5, 1], [E5, 1], [D5, 2], [G5, 2]];
  var JB_C = [[F5, 1], [F5, 1], [F5, 1.5], [F5, .5], [F5, 1], [E5, 1], [E5, 1], [E5, .5], [E5, .5], [G5, 1], [G5, 1], [F5, 1], [D5, 1], [C5, 4]];

  var DH_1 = [[79, 1.5], [77, .5], [76, 1], [74, 1], [72, 1], [74, 1], [76, 1], [72, 1], [74, .5], [76, .5], [77, .5], [74, .5], [76, 1.5], [74, .5], [72, 1], [71, 1], [72, 2]];
  var DH_3 = [[74, 1.5], [76, .5], [77, 1], [74, 1], [76, 1.5], [77, .5], [79, 1], [74, 1], [76, .5], [78, .5], [79, 1], [81, .5], [83, .5], [84, 1], [83, 1], [81, 1], [79, 2]];
  var DH_4 = [[79, 1.5], [77, .5], [76, 1], [74, 1], [72, 1], [74, 1], [76, 1], [72, 1], [81, .5], [81, .5], [81, .5], [81, .5], [79, 1.5], [77, .5], [76, 1], [74, 1], [72, 2]];

  var EL = [
    [72, .5], [81, .5], [81, .5], [79, .5], [81, .5], [77, .5], [72, .5], [72, .5],
    [72, .5], [81, .5], [81, .5], [82, .5], [79, .5], [84, 1.5],
    [84, .5], [86, .5], [86, .5], [82, .5], [82, .5], [81, .5], [82, .5], [79, .5],
    [77, .5], [81, .5], [81, .5], [79, .5], [81, .5], [77, 1.5],
  ];

  function bars(roots, len) { return roots.map(function (r) { return [r, len]; }); }

  var TRACKS = [
    { name: 'jingle bells', bpm: 150, meter: 4, melody: JB_A.concat(JB_B, JB_A, JB_C),
      bass: bars([48, 48, 48, 48, 53, 48, 50, 55, 48, 48, 48, 48, 53, 48, 55, 48], 4) },
    { name: 'we wish you a merry christmas', bpm: 170, meter: 3,
      melody: [[67, 1], [72, 1], [72, .5], [74, .5], [72, .5], [71, .5], [69, 1], [69, 1], [69, 1], [74, 1], [74, .5], [76, .5], [74, .5], [72, .5],
        [71, 1], [67, 1], [67, 1], [76, 1], [76, .5], [77, .5], [76, .5], [74, .5], [72, 1], [69, 1], [67, .5], [67, .5], [69, 1], [74, 1], [71, 1], [72, 3]],
      bass: [[0, 1]].concat(bars([48, 53, 50, 55, 52, 45, 55, 48], 3)) },
    { name: 'deck the halls', bpm: 140, meter: 4, melody: DH_1.concat(DH_1, DH_3, DH_4),
      bass: bars([48, 48, 55, 48, 48, 48, 55, 48, 55, 48, 50, 55, 48, 48, 53, 48], 4) },
    { name: 'в лесу родилась ёлочка', bpm: 120, meter: 4, melody: EL.concat(EL),
      bass: bars([53, 48, 46, 53, 53, 48, 46, 53], 4) },
  ];
  var trackIdx = Math.floor(Math.random() * TRACKS.length);
  var repeat = -1;
  var TRACK_SECONDS = 120;
  function trackLength(tr) {
    var beats = tr.melody.reduce(function (sum, n) { return sum + n[1]; }, 0);
    return beats * 60 / tr.bpm;
  }
  function repeatsOf(tr) { return Math.max(1, Math.round(TRACK_SECONDS / trackLength(tr))); }

  // планирует одну мелодию, возвращает её длительность в секундах
  function scheduleTrack(tr, t0) {
    var beat = 60 / tr.bpm, t = t0;
    tr.melody.forEach(function (n) {
      var dur = n[1] * beat;
      if (n[0]) {
        tone('square', hz(n[0]), t, dur * 0.9, 0.09, musicBus);
        // тихое эхо октавой выше для «блеска»
        tone('square', hz(n[0] + 12), t + 0.012, Math.min(dur * 0.5, 0.18), 0.018, musicBus);
      }
      t += dur;
    });
    var tb = t0;
    tr.bass.forEach(function (seg) {
      for (var b = 0; b < seg[1]; b++) {
        if (seg[0]) {
          var waltz = tr.meter === 3;
          var note = b % tr.meter === 0 ? seg[0] : (waltz ? seg[0] + 12 : (b % 2 ? seg[0] + 7 : seg[0]));
          tone('triangle', hz(note), tb, beat * (waltz && b % 3 ? 0.45 : 0.8), 0.16, musicBus);
          hat(tb + beat / 2, 0.035, musicBus);
        }
        tb += beat;
      }
    });
    return Math.max(t, tb) - t0;
  }

  var onTrack = null;
  function startMusic() {
    if (playing || !prefs.music || !init()) return;
    playing = true;
    (function loop(start) {
      // каждая мелодия звучит ~2 минуты (несколько повторов подряд), потом — следующая
      repeat++;
      if (repeat >= repeatsOf(TRACKS[trackIdx])) { repeat = 0; trackIdx = (trackIdx + 1) % TRACKS.length; }
      var tr = TRACKS[trackIdx];
      if (onTrack) onTrack(tr.name);
      var lastRepeat = repeat + 1 >= repeatsOf(tr);
      var len = scheduleTrack(tr, start) + (lastRepeat ? 1.2 : 0); // пауза только между разными песнями
      loopTimer = setTimeout(function () { loop(start + len); }, Math.max(0, (start + len - ctx.currentTime - 0.5) * 1000));
    })(ctx.currentTime + 0.1);
  }
  function stopMusic() {
    playing = false;
    clearTimeout(loopTimer);
    if (!ctx) return;
    // уже запланированные ноты уходят в отключённую шину и не звучат
    musicBus.disconnect();
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
  }

  // ---------------- эффекты ----------------
  var SFX = {
    tap: function (t) { tone('square', 660, t, 0.05, 0.12, sfxBus, 990); },
    swipe: function (t) { tone('triangle', 1200, t, 0.06, 0.12, sfxBus, 700); },
    toggle: function (t) { tone('square', 520, t, 0.05, 0.1, sfxBus); tone('square', 780, t + 0.05, 0.06, 0.1, sfxBus); },
    locked: function (t) { tone('sawtooth', 180, t, 0.09, 0.1, sfxBus); tone('sawtooth', 140, t + 0.1, 0.14, 0.1, sfxBus); },
    open: function (t) {
      [72, 76, 79, 84, 88].forEach(function (m, i) { tone('square', hz(m), t + i * 0.06, 0.09, 0.11, sfxBus); });
      hat(t + 0.3, 0.06, sfxBus);
    },
    success: function (t) {
      [[72, 0], [76, .08], [79, .16], [84, .24], [79, .36], [84, .44]].forEach(function (n) {
        tone('square', hz(n[0]), t + n[1], 0.12, 0.11, sfxBus);
        tone('triangle', hz(n[0] - 12), t + n[1], 0.12, 0.12, sfxBus);
      });
    },
    hoho: function (t) { tone('square', 220, t, 0.14, 0.12, sfxBus, 180); tone('square', 220, t + 0.2, 0.18, 0.12, sfxBus, 160); },
    photo: function (t) { hat(t, 0.15, sfxBus); tone('square', 1500, t + 0.03, 0.04, 0.06, sfxBus); },
  };

  function play(name) {
    if (!prefs.sfx || !init() || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.01);
  }

  // первый тап где угодно запускает музыку (если включена)
  function unlock() {
    if (init()) startMusic();
    removeEventListener('pointerdown', unlock, true);
    removeEventListener('keydown', unlock, true);
  }
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);

  // пауза, когда приложение свернули
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  window.BzikAudio = {
    play: play,
    prefs: prefs,
    setMusic: function (on) {
      prefs.music = on; savePrefs();
      if (on) startMusic(); else stopMusic();
    },
    setSfx: function (on) { prefs.sfx = on; savePrefs(); },
    onTrack: function (fn) { onTrack = fn; },
    tracks: function () { return TRACKS.map(function (t) { return t.name; }); },
  };
})();
