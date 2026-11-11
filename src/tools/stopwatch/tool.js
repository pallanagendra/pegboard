import {
  SW_EMPTY, swElapsed, swStart, swStop, swLap, lapExtremes, stopwatchParts, formatStopwatch, lapsToText,
  TIMER_EMPTY, durationFromParts, partsFromDuration, timerRemaining, timerSet, timerStart, timerPause,
  timerReset, timerAdd, timerDone, formatTimer, describeDuration,
} from './logic.js';
import { copyText } from '../../assets/js/ui.js';

const $ = (sel) => document.querySelector(sel);
const baseTitle = document.title;
const clockTime = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// ---------------- storage (this browser only)
function load(key, fallback, valid) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && valid(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

let sw = load('tool:stopwatch', SW_EMPTY, (v) => isNum(v.elapsed) && Array.isArray(v.laps) && (!v.running || isNum(v.startedAt)));
let tm = load('tool:timer', TIMER_EMPTY, (v) => isNum(v.duration) && isNum(v.remaining) && (!v.running || isNum(v.endsAt)));

// ---------------- stopwatch
const swMain = $('[data-sw-main]');
const swFraction = $('[data-sw-fraction]');
const swSub = $('[data-sw-sub]');
const swToggle = $('[data-sw-toggle]');
const swLapBtn = $('[data-sw-lap]');
const swReset = $('[data-sw-reset]');
const lapsWrap = $('[data-laps-wrap]');
const lapsBody = $('[data-laps]');

function renderSwTime(now) {
  const elapsed = swElapsed(sw, now);
  const p = stopwatchParts(elapsed);
  swMain.textContent = p.main;
  swFraction.textContent = p.fraction;
  if (sw.running) {
    const lapStart = sw.laps.length ? sw.laps[sw.laps.length - 1].total : 0;
    swSub.textContent = sw.laps.length ? `Lap ${sw.laps.length + 1}: ${formatStopwatch(elapsed - lapStart)}` : 'Running';
  }
}

function renderSw() {
  const now = Date.now();
  const elapsed = swElapsed(sw, now);
  swToggle.textContent = sw.running ? 'Stop' : elapsed > 0 ? 'Resume' : 'Start';
  swToggle.classList.toggle('is-running', sw.running);
  swLapBtn.disabled = !sw.running;
  swReset.disabled = sw.running || (elapsed === 0 && !sw.laps.length);
  if (!sw.running) swSub.textContent = elapsed > 0 ? 'Stopped' : 'Ready';
  renderSwTime(now);

  lapsWrap.hidden = sw.laps.length === 0;
  const { fastest, slowest } = lapExtremes(sw.laps);
  lapsBody.innerHTML = sw.laps
    .map((l, i) => {
      const tag = i === fastest ? ' <span class="lap-tag lap-tag--fast">Fastest</span>' : i === slowest ? ' <span class="lap-tag lap-tag--slow">Slowest</span>' : '';
      return `<tr><td>${i + 1}${tag}</td><td>${formatStopwatch(l.split)}</td><td>${formatStopwatch(l.total)}</td></tr>`;
    })
    .reverse()
    .join('');
}

function swToggleRun() {
  const now = Date.now();
  sw = sw.running ? swStop(sw, now) : swStart(sw, now);
  save('tool:stopwatch', sw);
  renderSw();
  wake();
  loop();
}
function swDoLap() {
  if (!sw.running) return;
  sw = swLap(sw, Date.now());
  save('tool:stopwatch', sw);
  renderSw();
}
function swDoReset() {
  if (sw.running) return;
  sw = { ...SW_EMPTY, laps: [] };
  save('tool:stopwatch', sw);
  renderSw();
}

swToggle.addEventListener('click', swToggleRun);
swLapBtn.addEventListener('click', swDoLap);
swReset.addEventListener('click', swDoReset);
$('[data-copy-laps]').addEventListener('click', () => copyText(lapsToText(sw.laps), 'Laps copied'));

// ---------------- timer
const setup = $('[data-timer-setup]');
const parts = [...document.querySelectorAll('[data-part]')];
const ring = $('[data-timer-ring]');
const bar = $('[data-timer-bar]');
const tmDisplay = $('[data-timer-display]');
const tmSub = $('[data-timer-sub]');
const tmAnnounce = $('[data-timer-announce]');
const tmToggle = $('[data-tm-toggle]');
const tmAddBtn = $('[data-tm-add]');
const soundBox = $('[data-tm-sound]');
soundBox.checked = load('tool:timer-sound', { on: true }, (v) => typeof v.on === 'boolean').on;

const finished = () => !tm.running && tm.remaining <= 0 && tm.duration > 0;

function fillParts() {
  const p = partsFromDuration(tm.duration);
  parts.forEach((el) => { el.value = p[el.dataset.part] || ''; });
}

function renderTmTime(now) {
  const rem = timerRemaining(tm, now);
  const text = formatTimer(rem);
  tmDisplay.textContent = text;
  tmDisplay.classList.toggle('is-long', text.length > 5);
  const share = tm.duration > 0 ? rem / tm.duration : 0;
  bar.style.strokeDashoffset = String(1000 * (1 - share));
}

function renderTm() {
  const now = Date.now();
  const rem = timerRemaining(tm, now);
  const done = finished();
  tmToggle.textContent = tm.running ? 'Pause' : alarm ? 'Stop sound' : done ? 'Restart' : rem < tm.duration ? 'Resume' : 'Start';
  tmToggle.disabled = !tm.running && tm.duration <= 0;
  tmToggle.classList.toggle('is-running', tm.running);
  setup.disabled = tm.running;
  ring.classList.toggle('is-done', done);
  ring.classList.toggle('is-running', tm.running);
  if (tm.running) tmSub.textContent = `Ends at ${clockTime(tm.endsAt)}`;
  else if (done) tmSub.textContent = tm.finishedAt ? `Time’s up at ${clockTime(tm.finishedAt)}` : 'Time’s up';
  else if (rem < tm.duration) tmSub.textContent = `Paused, ${describeDuration(tm.duration)} timer`;
  else tmSub.textContent = tm.duration > 0 ? describeDuration(tm.duration) : 'Set a time';
  renderTmTime(now);
}

function setFromParts() {
  if (tm.running) return;
  const d = durationFromParts(...parts.map((el) => el.value));
  if (!Number.isFinite(d)) return;
  stopAlarm();
  tm = timerSet(tm, d);
  save('tool:timer', tm);
  renderTm();
}

function tmStart() {
  unlockAudio();
  if (finished()) tm = timerReset(tm);
  tm = timerStart(tm, Date.now());
  save('tool:timer', tm);
  renderTm();
  wake();
  loop();
}

function tmToggleRun() {
  if (alarm) {
    stopAlarm();
    tm = timerReset(tm);
    save('tool:timer', tm);
    renderTm();
    return;
  }
  if (tm.running) {
    tm = timerPause(tm, Date.now());
    save('tool:timer', tm);
    renderTm();
    wake();
  } else {
    tmStart();
  }
}

function tmFinish() {
  const at = tm.endsAt;
  tm = { ...tm, running: false, endsAt: null, remaining: 0, finishedAt: at };
  save('tool:timer', tm);
  renderTm();
  tmAnnounce.textContent = 'Time’s up.';
  if (soundBox.checked) startAlarm();
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* not supported */ }
  wake();
}

tmToggle.addEventListener('click', tmToggleRun);
$('[data-tm-reset]').addEventListener('click', () => {
  stopAlarm();
  tm = timerReset(tm);
  save('tool:timer', tm);
  renderTm();
  wake();
});
tmAddBtn.addEventListener('click', () => {
  unlockAudio();
  stopAlarm();
  const wasDone = finished();
  tm = timerAdd(tm, 60000, Date.now());
  if (wasDone) tm = timerStart({ ...tm, duration: tm.remaining }, Date.now()); // a snooze: a fresh 1-minute timer
  fillParts();
  save('tool:timer', tm);
  renderTm();
  wake();
  loop();
});
parts.forEach((el) => el.addEventListener('input', setFromParts));
document.querySelectorAll('[data-preset]').forEach((chip) => {
  chip.addEventListener('click', () => {
    stopAlarm();
    tm = timerSet(tm, Number(chip.dataset.preset) * 1000);
    fillParts();
    tmStart();
  });
});
soundBox.addEventListener('change', () => {
  save('tool:timer-sound', { on: soundBox.checked });
  if (!soundBox.checked) stopAlarm();
});

// ---------------- sound: a few soft beeps, made on the spot (no audio files)
let audio;
let alarm = null;
function unlockAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}
function startAlarm() {
  if (!audio) return;
  stopAlarm();
  const nodes = [];
  const t0 = audio.currentTime + 0.05;
  for (let round = 0; round < 4; round++) {
    for (let b = 0; b < 3; b++) {
      const start = t0 + round * 1.5 + b * 0.32;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.25);
      nodes.push(osc);
    }
  }
  alarm = { nodes, timer: setTimeout(() => { alarm = null; renderTm(); }, 6200) };
  renderTm();
}
function stopAlarm() {
  if (!alarm) return;
  clearTimeout(alarm.timer);
  alarm.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
  alarm = null;
  renderTm();
}

// ---------------- keep the screen on while something is running (where the browser allows it)
let lock = null;
async function wake() {
  const want = sw.running || tm.running;
  try {
    if (want && !lock && document.visibilityState === 'visible' && navigator.wakeLock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!want && lock) {
      await lock.release();
      lock = null;
    }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    wake();
    loop();
  }
});

// ---------------- the clock: smooth digits while visible, a slower check that also runs in background tabs
let frame = 0;
function loop() {
  if (frame) return;
  const step = () => {
    frame = 0;
    const now = Date.now();
    if (sw.running) renderSwTime(now);
    if (tm.running) {
      if (timerDone(tm, now)) tmFinish();
      else renderTmTime(now);
    }
    if ((sw.running || tm.running) && document.visibilityState === 'visible') frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}
setInterval(() => {
  const now = Date.now();
  if (tm.running && timerDone(tm, now)) tmFinish();
  if (tm.running) document.title = `${formatTimer(timerRemaining(tm, now))} · Timer`;
  else if (finished() && alarm) document.title = 'Time’s up! · Timer';
  else if (sw.running) document.title = `${stopwatchParts(swElapsed(sw, now)).main} · Stopwatch`;
  else if (document.title !== baseTitle) document.title = baseTitle;
}, 250);

// ---------------- modes
const panels = { stopwatch: $('[data-panel="stopwatch"]'), timer: $('[data-panel="timer"]') };
let mode = 'stopwatch';
function setMode(next, updateUrl = true) {
  mode = next;
  document.getElementById(`sw-mode-${mode}`).checked = true;
  panels.stopwatch.hidden = mode !== 'stopwatch';
  panels.timer.hidden = mode !== 'timer';
  save('tool:clock-mode', { mode });
  if (updateUrl) history.replaceState(null, '', mode === 'timer' ? '#timer' : location.pathname + location.search);
}
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => setMode(r.value)));

// ---------------- full screen: big digits for a room, a class or a kitchen
const fsBtn = $('[data-fullscreen]');
if (!document.fullscreenEnabled) fsBtn.hidden = true;
fsBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await panels[mode].requestFullscreen();
  } catch { /* refused: carry on in the page */ }
});
document.addEventListener('fullscreenchange', () => {
  fsBtn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
});

// ---------------- keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
  const key = e.key.toLowerCase();
  if (key === ' ') {
    if (t.closest('button, a, label, summary')) return; // the focused control handles Space itself
    e.preventDefault();
    if (mode === 'timer') tmToggleRun();
    else swToggleRun();
  } else if (key === 'l' && mode === 'stopwatch') {
    swDoLap();
  } else if (key === 'r') {
    if (mode === 'timer') $('[data-tm-reset]').click();
    else swDoReset();
  }
});

// ---------------- start up
if (tm.running && timerDone(tm, Date.now())) {
  // it ran out while the page was closed: show that quietly (browsers block sound without a click)
  tm = { ...tm, running: false, endsAt: null, remaining: 0, finishedAt: tm.endsAt };
  save('tool:timer', tm);
}
const savedMode = load('tool:clock-mode', { mode: 'stopwatch' }, (v) => v.mode === 'stopwatch' || v.mode === 'timer').mode;
setMode(location.hash === '#timer' ? 'timer' : tm.running && !sw.running ? 'timer' : savedMode, location.hash === '#timer');
fillParts();
renderSw();
renderTm();
wake();
loop();
