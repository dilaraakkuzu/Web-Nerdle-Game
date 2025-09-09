// --- Oyun ayarları ---
const MAX_ROWS = 6;        // deneme sayısı
const TARGET_LEN = 8;      // klasik Nerdle uzunluğu

// --- Yardımcılar ---
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function noLeadingZero(n) { const s = String(n); return s === "0" || !/^0\d+/.test(s); }

function generateEquation8() {
  // Tam 8 karakter üreten rastgele fakat geçerli eşitlik üretici
  // Format: a op b = c, op ∈ {+,-,*,/}
  const ops = ['+','-','*','/'];
  for (let tries = 0; tries < 5000; tries++) {
    const op = ops[randInt(0, ops.length-1)];
    let a, b, c;
    if (op === '+') {
      a = randInt(1, 95); b = randInt(1, 95); c = a + b;
    } else if (op === '-') {
      a = randInt(2, 99); b = randInt(1, a-1); c = a - b; // negatif sonuç yok
    } else if (op === '*') {
      a = randInt(2, 19); b = randInt(2, 19); c = a * b;
    } else { // division
      b = randInt(2, 19);
      c = randInt(2, 50);
      a = b * c; // tam bölünebilirlik
    }
    if (!noLeadingZero(a) || !noLeadingZero(b) || !noLeadingZero(c)) continue;
    const s = `${a}${op}${b}=${c}`;
    if (s.length === TARGET_LEN) return s;
  }
  // Yedek seçenek
  return "12+34=46"; // 8 karakter
}

function isValidChars(s) {
  return /^[0-9+\-*/=]{1,}$/.test(s);
}

function evaluateExpr(expr) {
  // Sadece 0-9 + - * / karakterleri içermeli
  if (!/^\d+(?:[+\-*/]\d+)*$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function("\"use strict\"; return (" + expr + ");")();
    if (typeof val !== 'number' || !isFinite(val)) return null;
    return val;
  } catch {
    return null;
  }
}

function isValidEquation8(s) {
  if (s.length !== TARGET_LEN) return false;
  if (!isValidChars(s)) return false;
  const parts = s.split('=');
  if (parts.length !== 2) return false;
  const [L, R] = parts;
  const lv = evaluateExpr(L);
  const rv = evaluateExpr(R);
  if (lv === null || rv === null) return false;
  return Math.abs(lv - rv) < 1e-9;
}

// Wordle benzeri değerlendirme
function scoreGuess(guess, target) {
  const res = Array(TARGET_LEN).fill('absent');
  const tArr = target.split('');
  const gArr = guess.split('');
  const counts = {};
  for (let i=0;i<TARGET_LEN;i++) {
    const t = tArr[i];
    if (gArr[i] === t) {
      res[i] = 'correct';
    } else {
      counts[t] = (counts[t]||0)+1;
    }
  }
  for (let i=0;i<TARGET_LEN;i++) {
    if (res[i] === 'correct') continue;
    const ch = gArr[i];
    if (counts[ch] > 0) {
      res[i] = 'present';
      counts[ch]--;
    }
  }
  return res;
}

// --- UI Kurulum ---
let answer = generateEquation8();
let currentRow = 0;
let current = '';
let gameOver = false;

const board = $('#board');
const msg = $('#message');
const kb1 = $('#kb1');
const kb2 = $('#kb2');
const kb3 = $('#kb3');
const newBtn = $('#newBtn');
const toggleReveal = $('#toggleReveal');

function buildBoard() {
  board.style.setProperty('--cols', TARGET_LEN);
  board.innerHTML = '';
  for (let r=0; r<MAX_ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = r;
    for (let c=0; c<TARGET_LEN; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

const KEY_ROWS = [
  ['7','8','9','+','-'],
  ['4','5','6','*','/'],
  ['1','2','3','0','=','⌫','ENTER']
];

function buildKeyboard() {
  const rows = [kb1, kb2, kb3];
  KEY_ROWS.forEach((keys, i) => {
    rows[i].innerHTML = '';
    keys.forEach(k => {
      const b = document.createElement('button');
      b.className = 'key' + (k==='ENTER' ? ' wide' : '');
      b.textContent = k;
      b.dataset.key = k;
      b.addEventListener('click', () => onVirtualKey(k));
      rows[i].appendChild(b);
    });
  });
}

function setMessage(text, isError=false) {
  msg.textContent = text || '';
  msg.className = 'msg' + (isError ? ' error' : '');
}

function updateRowUI() {
  const rowEl = document.querySelector(`.row[data-row="${currentRow}"]`);
  const tiles = Array.from(rowEl.querySelectorAll('.tile'));
  tiles.forEach((t, i) => {
    t.textContent = current[i] || '';
    t.classList.toggle('filled', !!current[i]);
  });
}

function colorKeyboard(guess, colors) {
  guess.split('').forEach((ch, i) => {
    const key = document.querySelector(`.key[data-key="${CSS.escape(ch)}"]`);
    if (!key) return;
    const state = colors[i];
    const order = { correct: 3, present: 2, absent: 1 };
    const curr = key.dataset.state || '';
    if (!curr || order[state] > order[curr]) {
      key.dataset.state = state;
      key.classList.remove('correct','present','absent');
      key.classList.add(state);
    }
  });
}

function revealRow(guess, colors) {
  const rowEl = document.querySelector(`.row[data-row="${currentRow}"]`);
  const tiles = Array.from(rowEl.querySelectorAll('.tile'));
  tiles.forEach((t, i) => {
    setTimeout(() => {
      t.classList.add('reveal');
      t.classList.remove('correct','present','absent');
      t.classList.add(colors[i]);
    }, i * 120);
  });
}

function submitGuess() {
  if (gameOver) return;
  if (current.length !== TARGET_LEN) {
    setMessage(`Tam ${TARGET_LEN} karakter gir.`, true);
    return;
  }
  if (!isValidEquation8(current)) {
    setMessage('Geçerli bir eşitlik değil. Ör: 12+34=46', true);
    return;
  }
  setMessage('');
  const colors = scoreGuess(current, answer);
  revealRow(current, colors);
  colorKeyboard(current, colors);
  if (current === answer) {
    setMessage(`Tebrikler! Cevap: ${answer}`);
    gameOver = true;
    return;
  }
  currentRow++;
  current = '';
  if (currentRow >= MAX_ROWS) {
    setMessage(`Oyun bitti. Cevap: ${answer}`);
    gameOver = true;
  }
  updateRowUI();
}

function addChar(ch) {
  if (gameOver) return;
  if (current.length >= TARGET_LEN) return;
  current += ch;
  updateRowUI();
}

function backspace() {
  if (gameOver) return;
  current = current.slice(0, -1);
  updateRowUI();
}

function onVirtualKey(k) {
  if (k === 'ENTER') return submitGuess();
  if (k === '⌫') return backspace();
  if (/^[0-9+\-*/=]$/.test(k)) addChar(k);
}

function onKeyDown(e) {
  if (e.key === 'Enter') return submitGuess();
  if (e.key === 'Backspace') return backspace();
  if (/^[0-9+\-*/=]$/.test(e.key)) addChar(e.key);
}

function newGame() {
  answer = generateEquation8();
  currentRow = 0; current = ''; gameOver = false;
  setMessage('');
  buildBoard(); updateRowUI();
  document.querySelectorAll('.key').forEach(k => { k.dataset.state=''; k.classList.remove('correct','present','absent'); });
  renderReveal();
}

function renderReveal() {
  if (toggleReveal.checked) {
    setMessage(`Cevap: ${answer}`);
  } else {
    if (!gameOver) setMessage('');
  }
}

// İlk kurulum
buildBoard(); buildKeyboard(); updateRowUI();
document.addEventListener('keydown', onKeyDown);
newBtn.addEventListener('click', newGame);
toggleReveal.addEventListener('change', renderReveal);
renderReveal();
