/*
 * Мелкие пиксельные спрайты, нарисованные кодом.
 * Каждый — массив строк, символ = цвет из палитры, '.' = прозрачно.
 * Возвращаются как data:URL, увеличиваются в CSS через image-rendering: pixelated.
 */
(function () {
  'use strict';

  var PAL = {
    o: '#141414', w: '#ffffff', y: '#f5c33b', Y: '#c9951f', r: '#e02d2d', R: '#a81e1e',
    g: '#3aa64c', G: '#23753a', b: '#4f8ff0', B: '#2f5fbf', s: '#c9d6e3', k: '#8a8a8a',
    c: '#8fb9e6', n: '#8a5a2b', t: '#d0d0d0',
  };

  function sprite(rows, swap) {
    var pal = Object.assign({}, PAL, swap || {});
    var h = rows.length, w = rows[0].length;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var x = cv.getContext('2d');
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var ch = rows[j][i];
        if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
      }
    }
    return { url: cv.toDataURL(), w: w, h: h };
  }

  var S = {};

  S.lock = sprite([
    '...ooooo...',
    '..o.....o..',
    '.o..ooo..o.',
    '.o.o...o.o.',
    '.o.o...o.o.',
    'ooooooooooo',
    'oyyyyyyyyYo',
    'oyyyyooyyYo',
    'oyyyyooyyYo',
    'oyyyyyoyyYo',
    'oyyyyyyyyYo',
    'oYYYYYYYYYo',
    'ooooooooooo',
  ]);

  S.star = sprite([
    '...o...',
    '..oyo..',
    'ooyyyoo',
    'oyyYyyo',
    '.oyyyo.',
    'oyoooyo',
    'oo...oo',
  ]);

  S.sparkle = sprite([
    '..y..',
    '..y..',
    'yywyy',
    '..y..',
    '..y..',
  ]);

  S.flake = sprite([
    '....c....',
    '.c..c..c.',
    '..c.c.c..',
    '...ccc...',
    'ccccwcccc',
    '...ccc...',
    '..c.c.c..',
    '.c..c..c.',
    '....c....',
  ]);

  S.tree = sprite([
    '......y......',
    '.....yyy.....',
    '......o......',
    '.....ogo.....',
    '....oggGo....',
    '...oggrgGo...',
    '....ogggo....',
    '...oggggGo...',
    '..oggbgggGo..',
    '...ogggggo...',
    '..ogggggyGo..',
    '.ogrgggggGGo.',
    'oggggggbgggGo',
    'ooooooooooooo',
    '.....onno....',
    '.....oooo....',
  ]);

  var BALL = [
    '...ooo...',
    '...oyo...',
    '..ooooo..',
    '.orrrrro.',
    'orwrrrrRo',
    'orwrrrrRo',
    'orrrrrrRo',
    'orrrrrRRo',
    '.orrrRRo.',
    '..ooooo..',
  ];
  S.ballRed = sprite(BALL);
  S.ballBlue = sprite(BALL, { r: PAL.b, R: PAL.B });
  S.ballGreen = sprite(BALL, { r: PAL.g, R: PAL.G });

  S.bell = sprite([
    '.....o.....',
    '....oyo....',
    '...oyyYo...',
    '..oyyyyYo..',
    '..owyyyYo..',
    '..owyyyYo..',
    '.oyyyyyyYo.',
    'oyyyyyyyyYo',
    'ooooooooooo',
    '....oYo....',
    '.....o.....',
  ]);

  S.cane = sprite([
    '...ooo...',
    '..orwro..',
    '.orwoowo.',
    '.owo..owo',
    '.oro..oro',
    '.owo...o.',
    '.oro.....',
    '.owo.....',
    '.oro.....',
    '.owo.....',
    '.oro.....',
    '.owo.....',
    '.oro.....',
    '..o......',
  ]);

  S.iconMusic = sprite([
    '....ooooo',
    '....o...o',
    '....ooooo',
    '....o...o',
    '....o...o',
    '..ooo.ooo',
    '.oooooooo',
    '.ooo..ooo',
  ]);

  S.iconSound = sprite([
    '....o....',
    '...oo..o.',
    'oooko.o.o',
    'okkko.o.o',
    'okkko.o.o',
    'oooko.o.o',
    '...oo..o.',
    '....o....',
  ]);

  // стрелки для карусели
  S.arrowRight = sprite([
    '..o....',
    '..oo...',
    'oooyo..',
    'oyyyyo.',
    'oyyyyyo',
    'oyyyyo.',
    'oooyo..',
    '..oo...',
    '..o....',
  ].map(function (r) { return r; }));

  // ---------- иконки достижений и файлов (11x11) ----------
  var I = {};
  I.gift = sprite([
    '...oo.oo...', '..oyyoyyo..', '...ooooo...', 'ooooooooooo', 'orrrryrrrro', 'ooooooooooo',
    '.orrryrrro.', '.orrryrrro.', '.orrryrrro.', '.orrryrrro.', '.ooooooooo.',
  ]);
  I.flame = sprite([
    '.....o.....', '....oro....', '....oro.o..', '...orrroro.', '..orryrrro.', '..oryyyrro.',
    '.orryyyyro.', '.oryywyyro.', '.oryyyyyro.', '..oryyyro..', '...ooooo...',
  ]);
  I.globe = sprite([
    '...ooooo...', '..obbgbbo..', '.obggbbbbo.', 'obbggbbbbbo', 'obbbbbggbbo', 'oyyyyyyyyyo',
    'obbbbbgggbo', 'obbgbbbggbo', '.obggbbbbo.', '..obbbbbo..', '...ooooo...',
  ]);
  I.flag = sprite([
    '.o.........', '.ooooooo...', '.orrrrrro..', '.orrwrrrro.', '.orrrrrro..', '.ooooooo...',
    '.o.........', '.o.........', '.o.........', '.o.........', 'ooo........',
  ]);
  I.trophy = sprite([
    'ooooooooooo', 'oyoywyyyoyo', 'oyoywyyyoYo', '.ooywyyyoo.', '..oyyyyyo..', '...oyyYo...',
    '....oyo....', '....oYo....', '...ooooo...', '..oyyyyYo..', '..ooooooo..',
  ]);
  var BULB = [
    '...ooooo...', '..oyyyyyo..', '.oyywyyyyo.', '.oywyyyyyo.', '.oyyyyyyyo.', '..oyyyyyo..',
    '...oyyyo...', '...ooooo...', '...okkko...', '...ooooo...', '....ooo....',
  ];
  I.bulb = sprite(BULB);
  I.bulb2 = sprite(BULB, { y: '#7fd0ff' });
  I.factory = S.star;
  var CAL = [
    '.o.....o...', 'ooooooooooo', 'orrrrrrrrro', 'ooooooooooo', 'owwwwwwwwwo', 'owowowowowo',
    'owwwwwwwwwo', 'owowowowowo', 'owwwwwwwwwo', 'ooooooooooo',
  ];
  I.cal = sprite(CAL);
  I.cal2 = sprite(CAL, { r: PAL.g });
  I.clock = sprite([
    '...ooooo...', '..owwwwwo..', '.owwwowwwo.', 'owwwwowwwwo', 'owwwwowwwwo', 'owwwwoooowo',
    'owwwwwwwwwo', 'owwwwwwwwwo', '.owwwwwwwo.', '..owwwwwo..', '...ooooo...',
  ]);
  I.scroll = sprite([
    '.ooooooooo.', 'owwwwwwwwwo', '.owkkkkkwo.', '.owwwwwwwo.', '.owkkkkwwo.', '.owwwwwwwo.',
    '.owkkkkkwo.', '.owwwwwwwo.', 'owwwwwwwwwo', '.ooooooooo.',
  ]);
  I.sun = sprite([
    '.....y.....', '..y..y..y..', '...yyyyy...', '..yyyyyyy..', 'yyyyyYyyyyy', '..yyyyyyy..',
    '...yyyyy...', '..y..y..y..', '.....y.....',
  ]);
  I.moon = sprite([
    '...oooo....', '..obbbo....', '.obbbo.....', 'obbbo......', 'obbbo......', 'obbbo......',
    'obbbbo.....', '.obbbbooo..', '..obbbbbo..', '...ooooo...',
  ]);
  I.clip = sprite([
    '...ooo.....', '..o...o....', '..o.o.o....', '..o.o.o....', '..o.o.o....', '..o.o.o....',
    '..o.o.o....', '..o...o....', '...ooo.....',
  ]);
  I.pencil = sprite([
    '.......ooo.', '......orrro', '.....oyyro.', '....oyyyo..', '...oyyyo...', '..oyyyo....',
    '.otyyo.....', '.ottto.....', 'okkoo......', 'oo.........',
  ]);
  I.note = S.iconMusic;
  I.doc = sprite([
    'oooooo...', 'owwwwoo..', 'owwwwowo.', 'owwwwoooo', 'owkkkkkwo', 'owwwwwwwo',
    'owkkkkkwo', 'owwwwwwwo', 'owkkkwwwo', 'owwwwwwwo', 'ooooooooo',
  ]);
  S.icons = I;

  S.sprite = sprite;
  S.PAL = PAL;
  window.BzikPixels = S;
})();
