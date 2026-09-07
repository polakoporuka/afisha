/* Афиша матча — генератор. Полностью локально, без зависимостей.
 * Отрисовка целиком на Canvas 2D: превью и экспорт используют один и тот же код,
 * поэтому PNG на выходе пиксель-в-пиксель совпадает с тем, что видно на экране. */
(function () {
  'use strict';

  const ASSETS = window.AFISHA_ASSETS;
  if (!ASSETS) { alert('Не найден assets/data.js. Запустите build_assets.py'); return; }

  /* =====================================================================
   *  1. РАЗМЕТКА ФОРМАТОВ (числа сняты с PSD-шаблонов, координаты в px холста)
   * ===================================================================== */
  const C = {
    white: '#F5F5F5',
    name: '#FFFEFE',
    green: '#016F45',      // обводка зелёного заголовка
    dateGreen: '#0B7246',  // обводка даты
  };

  // Заголовок: зелёный контур + белая строка. Для каждого языка свои размеры/базовые линии.
  const HEAD = {
    next: {
      ru: { g: { text: 'СЛЕДУЮЩИЙ', size: 167, base: 480 }, w: { text: 'МАТЧ', size: 221, base: 633, track: 0.05 } },
      sr: { g: { text: 'SLEDEĆA',   size: 220, base: 534 }, w: { text: 'UTAKMICA', size: 161, base: 624, track: -0.05 } },
    },
    // товарищеский матч: зелёное слово длиннее, поэтому подбирается по ширине (fitSize в render)
    friendly: {
      ru: { g: { text: 'ТОВАРИЩЕСКИЙ', size: 220, base: 495, maxW: 1000 }, w: { text: 'МАТЧ', size: 221, base: 633, track: 0.05 } },
      sr: { g: { text: 'PRIJATELJSKA', size: 220, base: 495, maxW: 945 }, w: { text: 'UTAKMICA', size: 161, base: 624, track: -0.05 } },
    },
    score: {
      ru: { g: { text: 'РЕЗУЛЬТАТ', size: 209, base: 528 }, w: { text: 'МАТЧА', size: 173, base: 633, track: -0.05 } },
      sr: { g: { text: 'REZULTAT',  size: 225, base: 535 }, w: { text: 'UTAKMICE', size: 161, base: 624, track: -0.05 } },
    },
  };

  const NEXT_9x16 = {
    w: 1080, h: 1920, bg: 'next_9x16', s: 1,
    headTop: 0,                    // сдвиг заголовка (0 для 9:16)
    cols: { L: 240, R: 840, logoY: 835, logoH: 298, logoMaxW: 360, nameY: 1065, nameSize: 49, nameMaxW: 400 },
    vs: { base: 909, size: 176, track: -0.05 },
    time: { base: 1313, size: 176, track: -0.05, maxW: 900 },
    date: { base: 1427, size: 101, stroke: 3, maxW: 900 },
    stadium: { base: 1514, size: 68, track: -0.05, maxW: 960 },
    strokeG: 4,
  };

  // 1:1 анонс в исходнике — это 9:16-макет, вписанный в квадрат (масштаб 0.8426, сдвиг 85/-231).
  function scaledNext1x1() {
    const s = 910 / 1080, ox = 85, oy = -231;
    const sx = (x) => Math.round(ox + x * s), sy = (y) => Math.round(oy + y * s), sz = (v) => Math.round(v * s);
    const b = NEXT_9x16;
    return {
      w: 1080, h: 1080, bg: 'next_1x1', s: s, headScale: s, headOff: { x: ox, y: oy },
      cols: { L: sx(b.cols.L), R: sx(b.cols.R), logoY: sy(b.cols.logoY), logoH: sz(b.cols.logoH), logoMaxW: sz(b.cols.logoMaxW), nameY: sy(b.cols.nameY), nameSize: sz(b.cols.nameSize), nameMaxW: sz(b.cols.nameMaxW) },
      vs: { base: sy(b.vs.base), size: sz(b.vs.size), track: b.vs.track },
      time: { base: sy(b.time.base), size: sz(b.time.size), track: b.time.track, maxW: sz(b.time.maxW) },
      date: { base: sy(b.date.base), size: sz(b.date.size), stroke: 3 * s, maxW: sz(b.date.maxW) },
      stadium: { base: sy(b.stadium.base), size: sz(b.stadium.size), track: b.stadium.track, maxW: sz(b.stadium.maxW) },
      strokeG: 4 * s,
    };
  }

  const LAYOUTS = {
    next: { '9x16': NEXT_9x16, '1x1': scaledNext1x1() },
    score: {
      '9x16': {
        w: 1080, h: 1920, bg: 'score_9x16', s: 1,
        cols: { L: 240, R: 840, logoY: 840, logoH: 298, logoMaxW: 360, nameY: 1062, nameSize: 49, nameMaxW: 400 },
        vs: { base: 909, size: 176, track: -0.05 },
        score: { base: 1403, size: 282, track: 0.05, maxW: 980 },
        strokeG: 4,
      },
      '1x1': {
        w: 1080, h: 1080, bg: 'score_1x1', s: 1,
        head: { // в 1:1 у счёта свои позиции заголовка
          ru: { g: { size: 209, base: 230 }, w: { size: 173, base: 335 } },
          sr: { g: { size: 225, base: 242 }, w: { size: 161, base: 331 } },
        },
        cols: { L: 225, R: 855, logoY: 545, logoH: 298, logoMaxW: 330, nameY: 772, nameSize: 49, nameMaxW: 380 },
        score: { base: 655, size: 212, track: 0.05, maxW: 330 },
        strokeG: 4,
      },
    },
  };

  const ROT_G = -1.6 * Math.PI / 180;  // наклон зелёного заголовка
  const ROT_W = 0.9 * Math.PI / 180;   // наклон белой строки

  const MONTHS = {
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    sr: ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'],
  };
  const STADIUM_WORD = { ru: 'Стадион', sr: 'Stadion' };

  /* =====================================================================
   *  2. ТЕКСТОВЫЙ ДВИЖОК (трекинг, замер, контур «только снаружи», диакритика)
   * ===================================================================== */
  const TE = {
    supportsLS: ('letterSpacing' in CanvasRenderingContext2D.prototype),
    trailing: 1, // сколько «хвостовых» интервалов включает measureText при letterSpacing (определяется при старте)

    font(size, family) { return `${size}px "${family}"`; },

    // ширина строки без хвостового интервала
    width(ctx, text, size, family, track) {
      ctx.font = this.font(size, family);
      const ls = (track || 0) * size;
      if (this.supportsLS) {
        ctx.letterSpacing = ls + 'px';
        const w = ctx.measureText(text).width - ls * this.trailing;
        ctx.letterSpacing = '0px';
        return w;
      }
      let w = 0; const chars = [...text];
      for (const ch of chars) w += ctx.measureText(ch).width;
      return w + ls * Math.max(0, chars.length - 1);
    },

    // позиции символов (x-смещение начала и ширина глифа) — для дорисовки диакритики
    charBoxes(ctx, text, size, family, track) {
      ctx.font = this.font(size, family);
      const ls = (track || 0) * size; const out = []; let x = 0;
      for (const ch of [...text]) {
        const w = ctx.measureText(ch).width;
        out.push({ ch, x, w });
        x += w + ls;
      }
      return out;
    },

    // рисует строку с началом в x, базовой линией y. mode: 'fill' | 'stroke'
    paint(ctx, text, x, y, size, family, track, mode) {
      ctx.font = this.font(size, family);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const ls = (track || 0) * size;
      if (this.supportsLS) {
        ctx.letterSpacing = ls + 'px';
        if (mode === 'stroke') ctx.strokeText(text, x, y); else ctx.fillText(text, x, y);
        ctx.letterSpacing = '0px';
      } else {
        let cx = x;
        for (const ch of [...text]) {
          if (mode === 'stroke') ctx.strokeText(ch, cx, y); else ctx.fillText(ch, cx, y);
          cx += ctx.measureText(ch).width + ls;
        }
      }
    },

    calibrate() {
      if (!this.supportsLS) return;
      const c = document.createElement('canvas').getContext('2d');
      c.font = '100px sans-serif';
      const w0 = c.measureText('AB').width;
      c.letterSpacing = '10px';
      const w1 = c.measureText('AB').width;
      c.letterSpacing = '0px';
      // разница либо 10 (интервал только между), либо 20 (после каждого символа)
      this.trailing = Math.round((w1 - w0) / 10) - 1;
      if (this.trailing < 0 || this.trailing > 1) this.trailing = 1;
    },
  };

  // Подбор размера под ширину
  function fitSize(ctx, text, size, family, track, maxW, minSize) {
    let s = size;
    while (s > (minSize || size * 0.5) && TE.width(ctx, text, s, family, track) > maxW) s -= Math.max(1, s * 0.02);
    return s;
  }

  // Обычный залитый текст, центр по x
  function fillCentered(ctx, text, cx, base, o) {
    const w = TE.width(ctx, text, o.size, o.family, o.track);
    ctx.save();
    ctx.fillStyle = o.color;
    if (o.rot) { ctx.translate(cx, base); ctx.rotate(o.rot); ctx.translate(-cx, -base); }
    TE.paint(ctx, text, cx - w / 2, base, o.size, o.family, o.track, 'fill');
    ctx.restore();
    return w;
  }

  // Контур «только снаружи» (как Stroke: Outside в Photoshop при Fill 0%)
  let _off = null;
  function outlineCentered(ctx, text, cx, base, o) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (!_off || _off.width !== W || _off.height !== H) { _off = document.createElement('canvas'); _off.width = W; _off.height = H; }
    const c = _off.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const w = TE.width(c, text, o.size, o.family, o.track);
    if (o.rot) { c.translate(cx, base); c.rotate(o.rot); c.translate(-cx, -base); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.lineWidth = o.stroke * 2; c.strokeStyle = o.color;
    TE.paint(c, text, cx - w / 2, base, o.size, o.family, o.track, 'stroke');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    TE.paint(c, text, cx - w / 2, base, o.size, o.family, o.track, 'fill');
    c.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(_off, 0, 0); ctx.restore();
    return w;
  }

  /* --- Названия команд (Maler): у шрифта нет Č Ć Š Ž Đ — дорисовываем знаки сами --- */
  const DIA = { 'Č': ['C', 'caron'], 'Ć': ['C', 'acute'], 'Š': ['S', 'caron'], 'Ž': ['Z', 'caron'], 'Đ': ['D', 'bar'],
                'č': ['c', 'caron'], 'ć': ['c', 'acute'], 'š': ['s', 'caron'], 'ž': ['z', 'caron'], 'đ': ['d', 'bar'] };
  function baseText(t) { return [...t].map((ch) => (DIA[ch] ? DIA[ch][0] : ch)).join(''); }

  function drawMark(ctx, kind, cx, x0, capTop, size, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.11;
    ctx.beginPath();
    if (kind === 'caron') {
      ctx.moveTo(cx - size * 0.19, capTop - size * 0.25);
      ctx.lineTo(cx, capTop - size * 0.10);
      ctx.lineTo(cx + size * 0.19, capTop - size * 0.25);
    } else if (kind === 'acute') {
      ctx.moveTo(cx - size * 0.03, capTop - size * 0.10);
      ctx.lineTo(cx + size * 0.15, capTop - size * 0.27);
    } else if (kind === 'bar') {
      ctx.lineWidth = size * 0.10;
      ctx.moveTo(x0 - size * 0.02, capTop + size * 0.34);
      ctx.lineTo(x0 + size * 0.30, capTop + size * 0.34);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Слово с диакритикой: базовые буквы через шрифт, знаки — поверх
  function drawNameWord(ctx, word, x, base, size, track, color) {
    const plain = baseText(word);
    ctx.fillStyle = color;
    TE.paint(ctx, plain, x, base, size, 'Maler', track, 'fill');
    if (plain === word) return;
    const boxes = TE.charBoxes(ctx, plain, size, 'Maler', track);
    const chars = [...word];
    const capTop = base - size * 0.70;
    for (let i = 0; i < chars.length; i++) {
      const d = DIA[chars[i]]; if (!d) continue;
      const b = boxes[i];
      drawMark(ctx, d[1], x + b.x + b.w / 2, x + b.x, capTop, size, color);
    }
  }

  // Раскладка названия: 1 строка → 2 строки → уменьшение. Возвращает {lines, size}
  const NAME_TRACK = -0.025, NAME_GAP = 0.30, NAME_LH = 0.87;
  function nameWidth(ctx, words, size) {
    let w = 0;
    words.forEach((wd, i) => { w += TE.width(ctx, baseText(wd), size, 'Maler', NAME_TRACK); if (i) w += NAME_GAP * size; });
    return w;
  }
  function splitBalanced(words) {
    // лучшее разбиение на 2 строки по числу символов
    let best = null, bestDiff = Infinity;
    const total = words.join(' ').length;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i), b = words.slice(i);
      const diff = Math.abs(a.join(' ').length - b.join(' ').length);
      if (diff < bestDiff) { bestDiff = diff; best = [a, b]; }
    }
    return best;
  }
  function layoutName(ctx, text, size0, maxW) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return { lines: [], size: size0 };
    const minSize = size0 * 0.62;
    for (let s = size0; s >= minSize; s -= Math.max(0.5, size0 * 0.03)) {
      if (nameWidth(ctx, words, s) <= maxW) return { lines: [words], size: s };
      if (words.length > 1) {
        const sp = splitBalanced(words);
        if (nameWidth(ctx, sp[0], s) <= maxW && nameWidth(ctx, sp[1], s) <= maxW) return { lines: sp, size: s };
      }
    }
    // совсем длинное — 2 строки минимальным размером
    return { lines: words.length > 1 ? splitBalanced(words) : [words], size: minSize };
  }
  function drawName(ctx, text, cx, cy, size0, maxW) {
    const t = (text || '').toUpperCase();
    const { lines, size } = layoutName(ctx, t, size0, maxW);
    if (!lines.length) return;
    const lh = size * NAME_LH, cap = size * 0.70;
    const blockH = cap + (lines.length - 1) * lh;
    let base = cy - blockH / 2 + cap;
    for (const words of lines) {
      const w = nameWidth(ctx, words, size);
      let x = cx - w / 2;
      for (const wd of words) {
        drawNameWord(ctx, wd, x, base, size, NAME_TRACK, C.name);
        x += TE.width(ctx, baseText(wd), size, 'Maler', NAME_TRACK) + NAME_GAP * size;
      }
      base += lh;
    }
  }

  /* =====================================================================
   *  3. ЛОГОТИПЫ
   * ===================================================================== */
  // Обрезка по прозрачности: у логотипов разные поля, поэтому меряем реальный контур один раз и кэшируем
  const trimCache = new WeakMap();
  function logoTrim(img) {
    if (trimCache.has(img)) return trimCache.get(img);
    const W = img.naturalWidth, H = img.naturalHeight;
    let box = { x: 0, y: 0, w: W, h: H };
    try {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const a = x.getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
        if (a[(y * W + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 >= 0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) { /* оставляем полный размер */ }
    trimCache.set(img, box);
    return box;
  }

  // Все логотипы приводятся к одной высоте (logoH); ширина по пропорциям, но не шире logoMaxW
  function logoRect(img, L, side, teamScale, adj) {
    const t = logoTrim(img);
    const s0 = Math.min(L.cols.logoH / t.h, L.cols.logoMaxW / t.w);
    const s = s0 * (teamScale || 1) * (adj ? adj.s : 1);
    const w = t.w * s, h = t.h * s;
    const cx = L.cols[side] + (adj ? adj.dx * L.s : 0), cy = L.cols.logoY + (adj ? adj.dy * L.s : 0);
    return { x: cx - w / 2, y: cy - h / 2, w, h, src: t };
  }

  /* =====================================================================
   *  4. РЕНДЕР ОДНОГО ФОРМАТА
   * ===================================================================== */
  function render(ctx, fmt, st, res) {
    const L = LAYOUTS[st.type][fmt];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);
    ctx.drawImage(res.bgs[L.bg], 0, 0, L.w, L.h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    const lang = st.lang;
    const H = (st.type === 'next' ? HEAD[st.headline === 'friendly' ? 'friendly' : 'next'] : HEAD.score)[lang];
    // заголовок
    let g = { size: H.g.size, base: H.g.base }, w = { size: H.w.size, base: H.w.base };
    if (L.head) { g = L.head[lang].g; w = L.head[lang].w; }
    else if (L.headScale) {
      g = { size: g.size * L.headScale, base: L.headOff.y + g.base * L.headScale };
      w = { size: w.size * L.headScale, base: L.headOff.y + w.base * L.headScale };
    }
    const cx = L.w / 2;
    const gSize = fitSize(ctx, H.g.text, g.size, 'Kino', -0.05, (H.g.maxW || 1000) * (L.headScale || 1), g.size * 0.5);
    outlineCentered(ctx, H.g.text, cx, g.base, { size: gSize, family: 'Kino', track: -0.05, stroke: L.strokeG, color: C.green, rot: ROT_G });
    fillCentered(ctx, H.w.text, cx, w.base, { size: w.size, family: 'Kino', track: H.w.track, color: C.white, rot: ROT_W });

    // логотипы
    for (const side of ['L', 'R']) {
      const team = st.teams[side];
      const img = res.logos[side];
      const adj = st.manual ? st.adjust[fmt][side] : null;
      if (img && img.naturalWidth) {
        const r = logoRect(img, L, side, team.scale, adj);
        ctx.drawImage(img, r.src.x, r.src.y, r.src.w, r.src.h, r.x, r.y, r.w, r.h);
      }
      // название центрируется по логотипу: при ручном сдвиге едет вместе с ним, но размер не меняет
      const nx = L.cols[side] + (adj ? adj.dx * L.s : 0), ny = L.cols.nameY + (adj ? adj.dy * L.s : 0);
      drawName(ctx, team[lang] || team.ru || team.sr || '', nx, ny, L.cols.nameSize, L.cols.nameMaxW);
    }

    if (st.type === 'next') {
      fillCentered(ctx, 'VS', cx, L.vs.base, { size: L.vs.size, family: 'Kino', track: L.vs.track, color: C.white });
      const time = st.time || '';
      if (time) {
        const s = fitSize(ctx, time, L.time.size, 'Kino', L.time.track, L.time.maxW);
        fillCentered(ctx, time, cx, L.time.base, { size: s, family: 'Kino', track: L.time.track, color: C.white });
      }
      const date = formatDate(st.date, lang).toUpperCase();
      if (date) {
        const s = fitSize(ctx, date, L.date.size, 'Kino', 0, L.date.maxW);
        outlineCentered(ctx, date, cx, L.date.base, { size: s, family: 'Kino', track: 0, stroke: L.date.stroke, color: C.dateGreen });
      }
      const stad = stadiumText(st).toUpperCase();
      if (stad) {
        const s = fitSize(ctx, stad, L.stadium.size, 'Kino', L.stadium.track, L.stadium.maxW, L.stadium.size * 0.55);
        fillCentered(ctx, stad, cx, L.stadium.base, { size: s, family: 'Kino', track: L.stadium.track, color: C.white });
      }
    } else {
      if (L.vs) fillCentered(ctx, 'VS', cx, L.vs.base, { size: L.vs.size, family: 'Kino', track: L.vs.track, color: C.white });
      const sc = `${st.scoreL}:${st.scoreR}`;
      const s = fitSize(ctx, sc, L.score.size, 'Kino', L.score.track, L.score.maxW);
      fillCentered(ctx, sc, cx, L.score.base, { size: s, family: 'Kino', track: L.score.track, color: C.white });
    }
  }

  function stadiumText(st) {
    const name = ((st.lang === 'sr' ? st.stadiumSr : st.stadiumRu) || '').trim();
    if (!name) return '';
    return st.stadiumPrefix ? `${STADIUM_WORD[st.lang]} ${name}` : name;
  }

  function formatDate(iso, lang) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return '';
    const d = parseInt(m[3], 10), mo = parseInt(m[2], 10) - 1;
    return lang === 'sr' ? `${d}. ${MONTHS.sr[mo]}` : `${d} ${MONTHS.ru[mo]}`;
  }

  /* =====================================================================
   *  5. СОСТОЯНИЕ И ДАННЫЕ
   * ===================================================================== */
  const LS_STATE = 'afisha_state_v2', LS_TEAMS = 'afisha_teams_v1', LS_STADIUMS = 'afisha_stadiums_v1';

  function loadTeams() {
    const builtin = (ASSETS.teams || []).map((t) => Object.assign({ builtin: true }, t));
    const extra = (window.AFISHA_TEAMS_CUSTOM || []).map((t) => Object.assign({ builtin: true, file: true }, t));
    let local = [];
    try { local = JSON.parse(localStorage.getItem(LS_TEAMS) || '[]'); } catch (e) { local = []; }
    const map = new Map();
    for (const t of builtin.concat(extra, local)) map.set(t.id, t);
    return [...map.values()];
  }
  function saveLocalTeams(teams) {
    try { localStorage.setItem(LS_TEAMS, JSON.stringify(teams.filter((t) => !t.builtin))); }
    catch (e) { alert('Не удалось сохранить команду (переполнено хранилище браузера). Уменьшите размер логотипа.'); }
  }

  let TEAMS = loadTeams();
  const HOME_ID = TEAMS.some((t) => t.id === 'miljakovac') ? 'miljakovac' : (TEAMS[0] ? TEAMS[0].id : '');

  /* --- Транслитерация русской записи сербских названий в сербскую латиницу --- */
  const TR_PAIRS = { 'ль': 'lj', 'нь': 'nj', 'дж': 'dž', 'ль': 'lj' };
  const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'ž', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', ш: 'š', щ: 'šć', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'ju', я: 'ja',
    // сербская кириллица, если вдруг ввели её
    ђ: 'đ', ћ: 'ć', љ: 'lj', њ: 'nj', џ: 'dž', ј: 'j' };
  function translit(src) {
    const chars = [...(src || '')]; let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i], low = ch.toLowerCase();
      const next = chars[i + 1] ? chars[i + 1].toLowerCase() : '';
      let rep = null;
      if (TR_PAIRS[low + next] !== undefined) { rep = TR_PAIRS[low + next]; i++; }
      else if (TR[low] !== undefined) rep = TR[low];
      if (rep === null) { out += ch; continue; }
      const upper = ch !== low;
      const nextUpper = chars[i + 1] ? chars[i + 1] !== chars[i + 1].toLowerCase() : false;
      const prevUpper = i > 0 ? chars[i - 1] !== chars[i - 1].toLowerCase() : false;
      // слово капсом → капсом целиком, иначе только первая буква
      out += upper ? ((nextUpper || (prevUpper && !nextUpper && !chars[i + 1])) ? rep.toUpperCase() : rep.charAt(0).toUpperCase() + rep.slice(1)) : rep;
    }
    return out;
  }

  /* --- Память стадионов: по команде хозяев и общий список для подсказок --- */
  let STADIUMS = { byTeam: {}, list: [] };
  try { STADIUMS = Object.assign(STADIUMS, JSON.parse(localStorage.getItem(LS_STADIUMS) || '{}')); } catch (e) { /* ignore */ }
  function rememberStadium(teamId, ru, sr) {
    ru = (ru || '').trim(); sr = (sr || '').trim();
    if (!ru) return;
    if (teamId && teamId !== '__custom') STADIUMS.byTeam[teamId] = { ru, sr };
    STADIUMS.list = STADIUMS.list.filter((x) => x.ru !== ru);
    STADIUMS.list.unshift({ ru, sr });
    STADIUMS.list = STADIUMS.list.slice(0, 40);
    try { localStorage.setItem(LS_STADIUMS, JSON.stringify(STADIUMS)); } catch (e) { /* ignore */ }
    fillStadiumList();
  }

  const emptyAdj = () => ({ L: { dx: 0, dy: 0, s: 1 }, R: { dx: 0, dy: 0, s: 1 } });
  // по вертикали и по размеру логотипы не двигаются: они выровнены между собой и с текстом
  function sanitizeAdjust(adj) {
    for (const fmt of ['1x1', '9x16']) for (const side of ['L', 'R']) {
      const a = (adj[fmt] = adj[fmt] || emptyAdj())[side] = Object.assign({ dx: 0 }, adj[fmt][side]);
      a.dy = 0; a.s = 1; a.dx = Math.max(-200, Math.min(200, +a.dx || 0));
    }
    return adj;
  }

  const state = {
    type: 'next', headline: 'next',
    lang: 'ru',                       // язык ПРЕДПРОСМОТРА; экспорт всегда делает оба
    teamSel: { L: HOME_ID, R: (TEAMS.find((t) => t.id !== HOME_ID) || TEAMS[0] || { id: '' }).id },
    custom: { L: { ru: '', sr: '', logo: '' }, R: { ru: '', sr: '', logo: '' } },
    date: '', time: '17:00',
    stadiumRu: '', stadiumSr: '', stadiumSrManual: false, stadiumPrefix: true,
    scoreL: 0, scoreR: 0,
    manual: false, adjust: { '1x1': emptyAdj(), '9x16': emptyAdj() },
    showSafe: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(LS_STATE) || 'null');
    if (saved) Object.assign(state, saved, { adjust: sanitizeAdjust(Object.assign({ '1x1': emptyAdj(), '9x16': emptyAdj() }, saved.adjust || {})) });
  } catch (e) { /* ignore */ }
  // при каждом открытии: обычный заголовок, расширенные настройки выключены
  state.headline = 'next'; state.manual = false; state.showSafe = false; state.lang = 'ru';
  if (!state.date) { const d = new Date(); state.date = d.toISOString().slice(0, 10); }
  state._autoStadium = state._autoStadium || '';
  function persist() { try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  function teamFor(side) {
    const id = state.teamSel[side];
    if (id === '__custom') {
      const c = state.custom[side];
      return { id: '__custom', ru: c.ru, sr: c.sr || translit(c.ru), logo: c.logo, scale: 1, stadium_ru: '', stadium_sr: '' };
    }
    return TEAMS.find((t) => t.id === id) || TEAMS[0] || { id: '', ru: '', sr: '', logo: '', scale: 1 };
  }
  function stadiumSr() { return state.stadiumSrManual && state.stadiumSr ? state.stadiumSr : translit(state.stadiumRu); }

  /* =====================================================================
   *  6. РЕСУРСЫ (шрифты, фоны, логотипы)
   * ===================================================================== */
  const res = { bgs: {}, logos: { L: null, R: null } };
  const imgCache = new Map();
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    imgCache.set(src, p);
    return p;
  }
  async function loadFonts() {
    const list = [];
    for (const [fam, url] of Object.entries(ASSETS.fonts)) {
      const ff = new FontFace(fam, `url(${url})`);
      document.fonts.add(ff);
      list.push(ff.load());
    }
    await Promise.all(list);
  }
  async function loadBgs() {
    for (const [k, url] of Object.entries(ASSETS.bgs)) res.bgs[k] = await loadImage(url);
  }

  /* =====================================================================
   *  7. ПРЕВЬЮ + ЭКСПОРТ
   * ===================================================================== */
  const cv = { '1x1': document.getElementById('cv1x1'), '9x16': document.getElementById('cv9x16') };
  let raf = 0;
  function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderAll(); }); }

  async function prepareLogos() {
    res.logos.L = await loadImage(teamFor('L').logo);
    res.logos.R = await loadImage(teamFor('R').logo);
  }
  // снимок состояния для рендера; lang можно переопределить (для экспорта обоих языков)
  function snapshot(lang) {
    return Object.assign({}, state, { lang: lang || state.lang, stadiumSr: stadiumSr(), teams: { L: teamFor('L'), R: teamFor('R') } });
  }
  async function renderAll() {
    await prepareLogos();
    const st = snapshot();
    for (const fmt of ['1x1', '9x16']) {
      const L = LAYOUTS[st.type][fmt];
      const c = cv[fmt];
      if (c.width !== L.w || c.height !== L.h) { c.width = L.w; c.height = L.h; }
      const ctx = c.getContext('2d');
      render(ctx, fmt, st, res);
      if (fmt === '9x16' && state.showSafe) drawSafeZone(ctx, L);
    }
    persist();
  }

  // Зона 4:5 (1080×1350), которую показывает лента Instagram у вертикального поста, и 1:1 — только в превью
  function drawSafeZone(ctx, L) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,0,0,0.28)';
    const t45 = (L.h - 1350) / 2, t11 = (L.h - 1080) / 2;
    ctx.fillRect(0, 0, L.w, t45); ctx.fillRect(0, L.h - t45, L.w, t45);
    ctx.strokeStyle = 'rgba(255,80,80,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([18, 12]);
    ctx.strokeRect(1.5, t45, L.w - 3, 1350);
    ctx.strokeStyle = 'rgba(255,200,0,0.8)';
    ctx.strokeRect(1.5, t11, L.w - 3, 1080);
    ctx.setLineDash([]);
    ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,80,80,0.95)'; ctx.fillText('4:5 лента Instagram', 24, t45 - 14);
    ctx.fillStyle = 'rgba(255,200,0,0.95)'; ctx.fillText('1:1', 24, t11 - 14);
    ctx.restore();
  }

  function slug(s) {
    const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ć: 'c', č: 'c', š: 's', ž: 'z', đ: 'dj' };
    return (s || '').toLowerCase().split('').map((ch) => (map[ch] !== undefined ? map[ch] : ch)).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'team';
  }
  function kindName() { return state.type === 'next' && state.headline === 'friendly' ? 'friendly' : state.type; }
  function baseName() {
    const L = teamFor('L'), R = teamFor('R');
    return `${kindName()}_${slug(L.sr || L.ru)}-${slug(R.sr || R.ru)}`;
  }
  function fileName(lang, fmt) { return `${baseName()}_${lang}_${fmt}.png`; }
  function renderToBlob(lang, fmt) {
    return new Promise(async (resolve) => {
      await prepareLogos();
      const st = snapshot(lang);
      const L = LAYOUTS[st.type][fmt];
      const c = document.createElement('canvas'); c.width = L.w; c.height = L.h;
      render(c.getContext('2d'), fmt, st, res);
      c.toBlob((b) => resolve(b), 'image/png');
    });
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const statusEl = document.getElementById('exportStatus');
  let exporting = false;
  async function exportItems(items, asZip) {
    if (exporting) return; exporting = true;
    statusEl.textContent = 'Рендер…';
    try {
      const files = [];
      for (const [lang, fmt] of items) files.push({ name: fileName(lang, fmt), blob: await renderToBlob(lang, fmt) });
      if (asZip) {
        const parts = [];
        for (const f of files) parts.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
        download(makeZip(parts), baseName() + '.zip');
        statusEl.textContent = 'Готово: ' + baseName() + '.zip (' + files.length + ' файла)';
      } else {
        for (let i = 0; i < files.length; i++) {
          download(files[i].blob, files[i].name);
          if (i < files.length - 1) await new Promise((r) => setTimeout(r, 400));
        }
        statusEl.textContent = 'Готово: ' + files.map((f) => f.name).join(', ');
      }
      if (state.type === 'next') rememberStadium(state.teamSel.L, state.stadiumRu, stadiumSr());
    } catch (e) {
      console.error(e); statusEl.textContent = 'Ошибка: ' + e.message;
    }
    exporting = false;
  }
  const ALL_ITEMS = [['ru', '1x1'], ['ru', '9x16'], ['sr', '1x1'], ['sr', '9x16']];

  /* --- минимальный ZIP (без сжатия) --- */
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    const enc = new TextEncoder(); const chunks = []; const central = []; let offset = 0;
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
    const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
    for (const f of files) {
      const name = enc.encode(f.name); const crc = crc32(f.data); const size = f.data.length;
      const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name]);
      chunks.push(local, f.data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
      offset += local.length + size;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const eocd = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    return new Blob([...chunks, ...central, eocd], { type: 'application/zip' });
  }

  /* =====================================================================
   *  8. UI
   * ===================================================================== */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  function fillTeamSelects() {
    for (const side of ['L', 'R']) {
      const sel = $(`.team[data-side="${side}"] .team__select`);
      sel.innerHTML = '';
      for (const t of TEAMS) {
        const o = document.createElement('option'); o.value = t.id; o.textContent = t.ru || t.sr; sel.appendChild(o);
      }
      const oc = document.createElement('option'); oc.value = '__custom'; oc.textContent = '— своя команда (разово) —'; sel.appendChild(oc);
      if (![...sel.options].some((o) => o.value === state.teamSel[side])) state.teamSel[side] = TEAMS[0] ? TEAMS[0].id : '__custom';
      sel.value = state.teamSel[side];
      $(`.team[data-side="${side}"] .team__custom`).hidden = state.teamSel[side] !== '__custom';
      $(`.team[data-side="${side}"] .team__ru`).value = state.custom[side].ru;
      $(`.team[data-side="${side}"] .team__sr`).value = state.custom[side].sr;
    }
  }
  function fillTimeSelects() {
    const hs = $('#inHour'), ms = $('#inMin');
    if (!hs.options.length) {
      for (let h = 0; h < 24; h++) { const o = document.createElement('option'); o.value = o.textContent = String(h).padStart(2, '0'); hs.appendChild(o); }
      for (let m = 0; m < 60; m += 5) { const o = document.createElement('option'); o.value = o.textContent = String(m).padStart(2, '0'); ms.appendChild(o); }
    }
    const m = /^(\d{1,2}):(\d{2})$/.exec(state.time || '17:00');
    const hh = m ? String(+m[1]).padStart(2, '0') : '17', mm = m ? m[2] : '00';
    if (![...ms.options].some((o) => o.value === mm)) { const o = document.createElement('option'); o.value = o.textContent = mm; ms.appendChild(o); }
    hs.value = hh; ms.value = mm;
  }
  function fillStadiumList() {
    const dl = $('#stadiumList'); dl.innerHTML = '';
    for (const s of STADIUMS.list) { const o = document.createElement('option'); o.value = s.ru; dl.appendChild(o); }
  }
  function syncStadiumSr() {
    const sr = stadiumSr();
    $('#stadiumSrText').textContent = sr ? (state.stadiumPrefix ? STADIUM_WORD.sr + ' ' : '') + sr : '—';
    $('#stadiumSrEdit').hidden = !state.stadiumSrManual;
    $('#inStadiumSr').value = state.stadiumSrManual ? state.stadiumSr : sr;
    $('#stadiumSrAuto').hidden = !state.stadiumSrManual;
  }

  function syncUI() {
    $$('#segType button').forEach((b) => b.classList.toggle('is-on', b.dataset.type === state.type));
    $$('#segLang button').forEach((b) => b.classList.toggle('is-on', b.dataset.lang === state.lang));
    $$('#segHeadline button').forEach((b) => b.classList.toggle('is-on', b.dataset.headline === (state.headline || 'next')));
    $('#blockHeadline').hidden = state.type !== 'next';
    $('#blockNext').hidden = state.type !== 'next';
    $('#blockScore').hidden = state.type !== 'score';
    $('#inDate').value = state.date;
    fillTimeSelects();
    $('#inStadium').value = state.stadiumRu; $('#inStadiumPrefix').checked = state.stadiumPrefix;
    syncStadiumSr();
    $('#inScoreL').value = state.scoreL; $('#inScoreR').value = state.scoreR;
    $('#inManual').checked = state.manual; $('#manualPanel').hidden = !state.manual;
    $('#inSafe').checked = !!state.showSafe;
    for (const fmt of ['1x1', '9x16']) cv[fmt].classList.toggle('is-drag', state.manual);
    sanitizeAdjust(state.adjust);
    buildSliders();
    fillTeamSelects();
  }

  // Стадион хозяев: из памяти, иначе из базы. Подменяем только если поле пустое или было автозаполнено
  function autoStadium() {
    const t = teamFor('L');
    const mem = STADIUMS.byTeam[t.id];
    const ru = mem ? mem.ru : (t.stadium_ru || '');
    const sr = mem ? mem.sr : (t.stadium_sr || '');
    if (!state.stadiumRu || state.stadiumRu === state._autoStadium) {
      state.stadiumRu = ru; state._autoStadium = ru;
      if (sr && sr !== translit(ru)) { state.stadiumSr = sr; state.stadiumSrManual = true; } else { state.stadiumSrManual = false; state.stadiumSr = ''; }
      $('#inStadium').value = ru; syncStadiumSr();
    }
  }

  // Переключатели
  $('#segType').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.type = b.dataset.type; syncUI(); scheduleRender(); });
  $('#segHeadline').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.headline = b.dataset.headline; syncUI(); scheduleRender(); });
  $('#segLang').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.lang = b.dataset.lang; syncUI(); scheduleRender(); });

  // Команды
  for (const side of ['L', 'R']) {
    const root = $(`.team[data-side="${side}"]`);
    $('.team__select', root).addEventListener('change', (e) => {
      state.teamSel[side] = e.target.value;
      $('.team__custom', root).hidden = e.target.value !== '__custom';
      if (side === 'L') autoStadium();
      scheduleRender();
    });
    $('.team__ru', root).addEventListener('input', (e) => { state.custom[side].ru = e.target.value; const srEl = $('.team__sr', root); if (!srEl.dataset.touched) srEl.value = translit(e.target.value); scheduleRender(); });
    $('.team__sr', root).addEventListener('input', (e) => { state.custom[side].sr = e.target.value; e.target.dataset.touched = e.target.value ? '1' : ''; scheduleRender(); });
    $('.team__logo', root).addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      state.custom[side].logo = await fileToDataUrl(f, 900);
      e.target.parentElement.classList.add('is-set'); e.target.nextElementSibling.textContent = f.name;
      scheduleRender();
    });
  }
  $('#btnSwap').addEventListener('click', () => {
    [state.teamSel.L, state.teamSel.R] = [state.teamSel.R, state.teamSel.L];
    [state.custom.L, state.custom.R] = [state.custom.R, state.custom.L];
    [state.scoreL, state.scoreR] = [state.scoreR, state.scoreL];
    for (const fmt of ['1x1', '9x16']) [state.adjust[fmt].L, state.adjust[fmt].R] = [state.adjust[fmt].R, state.adjust[fmt].L];
    autoStadium(); syncUI(); scheduleRender();
  });

  // Матч
  $('#inDate').addEventListener('change', (e) => { state.date = e.target.value; scheduleRender(); });
  const onTime = () => { state.time = $('#inHour').value + ':' + $('#inMin').value; scheduleRender(); };
  $('#inHour').addEventListener('change', onTime); $('#inMin').addEventListener('change', onTime);
  $('#inStadium').addEventListener('input', (e) => { state.stadiumRu = e.target.value; syncStadiumSr(); scheduleRender(); });
  $('#inStadium').addEventListener('change', () => { if (state.stadiumRu.trim()) rememberStadium(state.teamSel.L, state.stadiumRu, stadiumSr()); });
  $('#inStadiumPrefix').addEventListener('change', (e) => { state.stadiumPrefix = e.target.checked; syncStadiumSr(); scheduleRender(); });
  $('#stadiumSrPen').addEventListener('click', () => { state.stadiumSrManual = true; state.stadiumSr = stadiumSr(); syncStadiumSr(); $('#inStadiumSr').focus(); });
  $('#inStadiumSr').addEventListener('input', (e) => { state.stadiumSr = e.target.value; state.stadiumSrManual = true; $('#stadiumSrText').textContent = (state.stadiumPrefix ? STADIUM_WORD.sr + ' ' : '') + stadiumSr(); scheduleRender(); });
  $('#stadiumSrAuto').addEventListener('click', () => { state.stadiumSrManual = false; state.stadiumSr = ''; syncStadiumSr(); scheduleRender(); });
  $('#inScoreL').addEventListener('input', (e) => { state.scoreL = Math.max(0, parseInt(e.target.value, 10) || 0); scheduleRender(); });
  $('#inScoreR').addEventListener('input', (e) => { state.scoreR = Math.max(0, parseInt(e.target.value, 10) || 0); scheduleRender(); });

  // Расширенные настройки
  $('#inManual').addEventListener('change', (e) => { state.manual = e.target.checked; syncUI(); scheduleRender(); });
  $('#inSafe').addEventListener('change', (e) => { state.showSafe = e.target.checked; scheduleRender(); });
  $('#btnResetAdjust').addEventListener('click', () => { state.adjust = { '1x1': emptyAdj(), '9x16': emptyAdj() }; buildSliders(); scheduleRender(); });
  function buildSliders() {
    const host = $('#manualSliders'); host.innerHTML = '';
    for (const fmt of ['1x1', '9x16']) for (const side of ['L', 'R']) {
      const a = state.adjust[fmt][side];
      const box = document.createElement('div'); box.className = 'adj';
      box.innerHTML = `<div class="adj__title">${fmt} · ${side === 'L' ? 'левый' : 'правый'} логотип</div>`;
      const row = document.createElement('div'); row.className = 'adj__row';
      row.innerHTML = `<span>Влево/вправо</span><input type="range" min="-200" max="200" step="1" value="${a.dx}"><output>${a.dx}</output>`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.addEventListener('input', () => { a.dx = parseFloat(inp.value); out.textContent = a.dx; scheduleRender(); });
      box.appendChild(row);
      host.appendChild(box);
    }
  }

  // Перетаскивание логотипов на превью (только по горизонтали)
  for (const fmt of ['1x1', '9x16']) {
    const c = cv[fmt]; let drag = null;
    const toCanvas = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
    c.addEventListener('pointerdown', (e) => {
      if (!state.manual) return;
      const st = snapshot(); const L = LAYOUTS[st.type][fmt]; const p = toCanvas(e);
      for (const side of ['R', 'L']) {
        const img = res.logos[side]; if (!img) continue;
        const r = logoRect(img, L, side, st.teams[side].scale, st.adjust[fmt][side]);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          drag = { side, start: p, dx0: st.adjust[fmt][side].dx, s: L.s };
          c.setPointerCapture(e.pointerId); c.classList.add('is-dragging'); e.preventDefault(); break;
        }
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return; const p = toCanvas(e);
      const a = state.adjust[fmt][drag.side];
      a.dx = Math.max(-200, Math.min(200, Math.round(drag.dx0 + (p.x - drag.start.x) / drag.s)));
      scheduleRender();
    });
    const end = () => { if (drag) { drag = null; c.classList.remove('is-dragging'); buildSliders(); } };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }

  // Экспорт
  $('#btnExportAll').addEventListener('click', () => exportItems(ALL_ITEMS, true));
  $$('[data-export]').forEach((b) => b.addEventListener('click', () => { const [lang, fmt] = b.dataset.export.split('_'); exportItems([[lang, fmt]], false); }));

  // База команд
  function fileToDataUrl(file, maxSide) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
          if (k >= 1 && file.type === 'image/png') { resolve(fr.result); return; }
          const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        };
        im.onerror = () => resolve('');
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  let dbLogoData = '';
  $('#dbLogo').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    dbLogoData = await fileToDataUrl(f, 900);
    $('#dbLogoName').textContent = f.name; e.target.parentElement.classList.add('is-set');
  });
  $('#dbRu').addEventListener('input', (e) => { const sr = $('#dbSr'); if (!sr.dataset.touched) sr.value = translit(e.target.value); });
  $('#dbSr').addEventListener('input', (e) => { e.target.dataset.touched = e.target.value ? '1' : ''; });
  $('#btnDbAdd').addEventListener('click', () => {
    const ru = $('#dbRu').value.trim(), sr = $('#dbSr').value.trim() || translit(ru);
    if (!ru && !sr) { alert('Введите название команды'); return; }
    if (!dbLogoData) { alert('Выберите логотип'); return; }
    const id = slug(sr || ru) + '_' + Date.now().toString(36);
    const stRu = $('#dbStadRu').value.trim();
    TEAMS.push({ id, ru: ru || sr, sr: sr || ru, logo: dbLogoData, scale: 1, stadium_ru: stRu, stadium_sr: translit(stRu) });
    saveLocalTeams(TEAMS);
    $('#dbRu').value = ''; $('#dbSr').value = ''; $('#dbSr').dataset.touched = ''; $('#dbStadRu').value = '';
    dbLogoData = ''; $('#dbLogoName').textContent = 'Логотип (PNG с прозрачностью)…'; $('#dbLogo').parentElement.classList.remove('is-set');
    state.teamSel.R = id;
    renderDb(); syncUI(); scheduleRender();
  });
  function renderDb() {
    const host = $('#dbList'); host.innerHTML = '';
    for (const t of TEAMS) {
      const el = document.createElement('div'); el.className = 'db__item';
      el.innerHTML = `<img alt=""><div><b></b><small></small></div>${t.builtin ? '<span class="hint">' + (t.file ? 'файл' : 'встроенная') + '</span>' : '<button type="button">удалить</button>'}`;
      el.querySelector('img').src = t.logo; el.querySelector('b').textContent = t.ru; el.querySelector('small').textContent = t.sr;
      const del = el.querySelector('button');
      if (del) del.addEventListener('click', () => { if (!confirm('Удалить «' + t.ru + '»?')) return; TEAMS = TEAMS.filter((x) => x !== t); saveLocalTeams(TEAMS); renderDb(); syncUI(); scheduleRender(); });
      host.appendChild(el);
    }
  }

  // Параметры URL: ?type=next|score&headline=next|friendly&lang=ru|sr&L=<id>&R=<id>&date=YYYY-MM-DD&time=HH:MM&stadium=...&stadiumSr=...&score=7:0&qa=1x1|9x16
  function applyQuery() {
    const q = new URLSearchParams(location.search);
    if (!q.size) return;
    if (q.get('type')) state.type = q.get('type');
    if (q.get('headline')) state.headline = q.get('headline');
    if (q.get('lang')) state.lang = q.get('lang');
    if (q.get('L')) state.teamSel.L = q.get('L');
    if (q.get('R')) state.teamSel.R = q.get('R');
    if (q.get('date')) state.date = q.get('date');
    if (q.get('time')) state.time = q.get('time');
    if (q.has('stadium')) { state.stadiumRu = q.get('stadium'); state._autoStadium = state.stadiumRu; state.stadiumSrManual = false; state.stadiumSr = ''; }
    if (q.has('stadiumSr')) { state.stadiumSr = q.get('stadiumSr'); state.stadiumSrManual = true; }
    if (q.get('score')) { const m = /^(\d+)\D+(\d+)$/.exec(q.get('score')); if (m) { state.scoreL = +m[1]; state.scoreR = +m[2]; } }
    if (q.get('manual') === '1') state.manual = true;
    if (q.get('qa')) {
      document.body.classList.add('qa');
      const keep = q.get('qa');
      for (const fmt of ['1x1', '9x16']) cv[fmt].closest('.preview').hidden = fmt !== keep;
    }
  }

  window.AFISHA = { state, LAYOUTS, HEAD, render, renderAll, snapshot, res, TE, translit };

  /* =====================================================================
   *  9. СТАРТ
   * ===================================================================== */
  (async function init() {
    TE.calibrate();
    applyQuery();
    $('#engineInfo').textContent = 'Текст: ' + (TE.supportsLS ? 'letterSpacing (точный кернинг)' : 'посимвольный режим') + ' · ' + navigator.userAgent.split(') ')[0].replace('(', '');
    try {
      await Promise.all([loadFonts(), loadBgs()]);
    } catch (e) {
      console.error(e);
      alert('Ошибка загрузки шрифтов/фонов: ' + e.message);
    }
    fillStadiumList();
    renderDb(); syncUI();
    if (!state.stadiumRu) autoStadium();
    await renderAll();
    $('#loading').hidden = true;
    if (new URLSearchParams(location.search).get('selftest')) {
      try { const d = cv['1x1'].toDataURL('image/png'); document.title = 'EXPORT_OK ' + d.length; }
      catch (e) { document.title = 'EXPORT_FAIL ' + e.message; }
    }
  })();
})();
