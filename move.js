/**
 * INTO THE SEED / move.js
 * Vanilla JavaScript. Open index.html directly; no build or network required.
 * Sections: preferences → navigation → story → evolution → combat prototype.
 */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const storage = {
    get(key, fallback = null) { try { return localStorage.getItem('seed-v2:' + key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('seed-v2:' + key, String(value)); } catch { /* Private/file mode: continue without persistence. */ } }
  };
  const root = document.documentElement;
  root.classList.add('js');
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = storage.get('reduced-motion') === null ? systemMotion.matches : storage.get('reduced-motion') === 'true';
  const events = new EventTarget();
  function applyMotion() {
    root.classList.toggle('motion-reduced', reduced);
    $('#motion-toggle').setAttribute('aria-pressed', String(reduced));
    $('#motion-toggle').setAttribute('aria-label', reduced ? '장식 모션 켜기' : '장식 모션 줄이기');
    events.dispatchEvent(new Event('motionchange'));
  }
  let toastTimer;
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
  }
  $('#motion-toggle').addEventListener('click', () => {
    reduced = !reduced; storage.set('reduced-motion', reduced); applyMotion();
    toast(reduced ? '장식 모션을 줄였습니다. 전투 조작은 그대로 이용할 수 있습니다.' : '장식 모션을 켰습니다.');
  });
  systemMotion.addEventListener('change', e => {
    if (storage.get('reduced-motion') === null) { reduced = e.matches; applyMotion(); }
  });
  applyMotion();

  // ---- Scroll reveal, reading progress & responsive navigation ----
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('seen'); reveal.unobserve(entry.target); }
    }), { threshold: .08 });
    $$('.reveal').forEach(el => reveal.observe(el));
  } else $$('.reveal').forEach(el => el.classList.add('seen'));

  const header = $('#site-header'), nav = $('#navigation'), menu = $('.menu-btn');
  function closeMenu() {
    nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '메뉴 열기');
  }
  menu.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  $$('a', nav).forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('pointerdown', e => { if (!header.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
  matchMedia('(min-width:721px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

  const navLinks = $$('a', nav), sections = navLinks.map(a => $(a.getAttribute('href')));
  let scrollQueued = false;
  function scrollUI() {
    scrollQueued = false;
    const max = root.scrollHeight - innerHeight, progress = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
    $('.reading-progress i').style.transform = `scaleX(${progress})`;
    $('#back-to-top').style.setProperty('--progress-offset', 120 * (1 - progress));
    $('#back-to-top').classList.toggle('visible', scrollY > 650);
    header.classList.toggle('scrolled', scrollY > 30);
    let current = -1;
    sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= innerHeight * .4) current = i; });
    navLinks.forEach((a, i) => {
      a.classList.toggle('active', i === current);
      if (i === current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    if (!reduced && scrollY < $('.hero').offsetHeight + 100) {
      $('.hero').style.setProperty('--art-y', `${Math.min(scrollY * .1, 75)}px`);
      $('.hero').style.setProperty('--card-y', `${Math.min(scrollY * -.055, 0)}px`);
    }
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(scrollUI); } }, { passive: true });
  addEventListener('resize', scrollUI, { passive: true });
  $('#back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
    $('.brand').focus({ preventScroll: true });
  });
  scrollUI();

  // ---- Subtle pointer lighting / tilt (fine pointers only) ----
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  $$('.card').forEach(card => {
    card.addEventListener('pointermove', e => {
      if (reduced || !finePointer.matches) return;
      const rect = card.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      card.style.setProperty('--spot-x', x + 'px'); card.style.setProperty('--spot-y', y + 'px');
      card.style.setProperty('--tilt-y', ((x / rect.width - .5) * 5) + 'deg');
      card.style.setProperty('--tilt-x', ((.5 - y / rect.height) * 4) + 'deg');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg'); card.style.setProperty('--tilt-y', '0deg');
    });
  });

  // ---- Shared visibility-aware canvas scheduler for decorative visuals ----
  function visualCanvas(canvas, render) {
    const ctx = canvas.getContext('2d');
    let width = 1, height = 1, visible = true, frame = 0, previous = 0, time = 0;
    function draw(ts = 0) {
      frame = 0;
      const dt = previous ? Math.min((ts - previous) / 1000, .04) : .016;
      previous = ts; if (!reduced) time += dt;
      render(ctx, width, height, time, reduced ? 0 : dt);
      if (visible && !document.hidden && !reduced) frame = requestAnimationFrame(draw);
    }
    function wake() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; previous = 0;
      if (visible && !document.hidden) {
        if (reduced) draw(); else frame = requestAnimationFrame(draw);
      }
    }
    function resize() {
      const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); wake();
    }
    new ResizeObserver(resize).observe(canvas);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; wake();
    }, { rootMargin: '80px' }).observe(canvas);
    document.addEventListener('visibilitychange', wake); events.addEventListener('motionchange', wake);
    resize();
    return { redraw: wake };
  }

  const hero = $('.hero');
  let mouseX = .7, mouseY = .5, smoothX = .7, smoothY = .5;
  hero.addEventListener('pointermove', e => {
    if (!finePointer.matches || reduced) return;
    const rect = hero.getBoundingClientRect(); mouseX = (e.clientX - rect.left) / rect.width; mouseY = (e.clientY - rect.top) / rect.height;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { mouseX = .7; mouseY = .5; });
  const motes = Array.from({ length: 48 }, () => ({ x: Math.random(), y: Math.random(), r: rand(.5, 1.7), s: rand(.006, .018), phase: rand(0, 6.28) }));
  visualCanvas($('#atmosphere'), (ctx, w, h, time, dt) => {
    ctx.clearRect(0, 0, w, h);
    smoothX = lerp(smoothX, mouseX, .035); smoothY = lerp(smoothY, mouseY, .035);
    if (!reduced) hero.style.setProperty('--art-x', (smoothX - .5) * -10 + 'px');
    motes.forEach(p => {
      if (dt) { p.y -= p.s * dt; if (p.y < -.02) p.y = 1.02; }
      const x = p.x * w + (smoothX - .5) * p.r * 9 + Math.sin(time * .35 + p.phase) * 9;
      const y = p.y * h + (smoothY - .5) * p.r * 6;
      ctx.fillStyle = `rgba(192,230,139,${(.18 + Math.sin(time + p.phase) * .12) * (p.x < .4 ? .3 : 1)})`;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
    });
  });

  // ---- Design cards / editable content data ----
  const featureData = [
    ['집중되는 성장', '핵심 스킬의 위력·범위·속도를 강화해 전투 변화를 느끼는 구조입니다. 장비는 보조 성장으로 사용하고, 특성 등 확장 요소는 후속 검증 대상으로 계획합니다.', '한 번의 선택이,\n더 넓은 전장을 만든다.'],
    ['가벼운 조작, 선명한 개입', '공격은 자동으로 이루어집니다. 플레이어는 적의 흐름을 읽고 이동·회피로 생존하는 데 집중합니다. 자동 전투의 편리함에 직접 조작의 손맛을 더합니다.', '손은 가볍게.\n판단은 날카롭게.'],
    ['돌아올 이유가 있는 방치', '미접속 보상은 다음 도전을 준비하는 수단입니다. 보상을 받아 강화한 뒤, 직접 탑에 도전하며 성장과 돌파를 이어갑니다. 세부 보상 수치는 미확정입니다.', '잠깐의 쉼도,\n다음 도약의 준비.']
  ];
  $$('[data-feature-select]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.featureSelect), data = featureData[index];
    $$('[data-feature-select]').forEach((b, i) => {
      b.setAttribute('aria-expanded', String(i === index)); b.closest('.card').classList.toggle('is-selected', i === index);
    });
    $('#feature-index').textContent = String(index + 1).padStart(2, '0');
    $('#feature-title').textContent = data[0]; $('#feature-description').textContent = data[1]; $('#feature-quote').textContent = data[2];
    if (innerWidth < 721) $('#feature-detail').scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
  }));

  // ---- Accessible journal dialog (native focus trap and Escape) ----
  const dialog = $('#journal-dialog');
  let journalOpener = null, previousOverflow = '';
  const logData = [
    ['ENTRY 001 / ANOMALY', '하늘을 가르는 탑.', '어느 날, 세상의 한가운데 거대한 탑이 나타났다. 끝을 확인할 수 없는 높이. 안으로 들어간 조사원들은 그 안에서 새로운 힘과 마주한다. 당신도 그중 한 사람이다.', '조사 목표: 탑의 내부를 탐색하고 기원을 추적할 것.', ''],
    ['ENTRY 002 / THE SEED', '작은 결정, 미지의 힘.', '조사 도중 마주한 정체불명의 힘, 시드. 그것은 당신에게 단 하나의 스킬을 깨운다. 처음엔 작은 파동이지만, 탑을 오르며 성장한 힘은 전장의 흐름마저 바꾼다. 시드의 기원은 아직 밝혀지지 않았다.', '관측 메모: 힘의 위력·범위·속도에 변화 가능성이 있음.', 'seed'],
    ['ENTRY 003 / THE ASCENT', '다음 층을 향하여.', '이동과 회피로 적의 흐름을 읽고, 자동 공격으로 길을 열 것. 도전이 끝나면 재화를 모아 스킬과 장비를 강화할 것. 쉬는 동안 쌓인 보상도 다음 도전의 준비가 된다. 정상에 닿기 전까지, 조사는 계속된다.', '등반 지침: 보상 수령 → 강화 → 탑 도전 → 결과 확인 → 새 목표.', 'ascent']
  ];
  const logTabs = $$('[data-log]');
  function setLog(index, focus = false) {
    const data = logData[index];
    logTabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    $('#journal-panel').setAttribute('aria-labelledby', logTabs[index].id);
    $('#journal-number').textContent = data[0]; $('#journal-title').textContent = data[1];
    $('#journal-text').textContent = data[2]; $('#journal-note').textContent = data[3];
    $('.journal-visual').className = 'journal-visual ' + data[4];
    if (focus) logTabs[index].focus();
  }
  function tabKeyboard(event, index, count, setter) {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % count;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + count) % count;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = count - 1;
    if (next !== undefined) { event.preventDefault(); setter(next, true); }
  }
  logTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setLog(index));
    tab.addEventListener('keydown', e => tabKeyboard(e, index, logTabs.length, setLog));
  });
  $$('[data-open-journal]').forEach(button => button.addEventListener('click', () => {
    journalOpener = button; previousOverflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden'; events.dispatchEvent(new Event('overlayopen'));
  }));
  $('#close-journal').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    const rect = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = previousOverflow; journalOpener?.focus({ preventScroll: true }); });

  // ---- Play loop navigator ----
  const loopDescriptions = [
    '탑에 들어가기 전, 쌓여 있는 보상을 받으세요. 짧은 접속도 다음 도전의 준비가 됩니다.',
    '위력·범위·속도 강화에 재화를 사용하세요. 장비는 하나의 핵심 스킬을 보조합니다.',
    '공격은 자동으로. 이동과 회피로 안전한 위치를 찾아 한 층 더 높은 곳에 도전하세요.',
    '돌파했다면 다음 층으로, 막혔다면 강화 후 재도전. 실패도 다음 성장을 위한 과정입니다.',
    '시드 진화와 새 조사 기록을 다음 목표로 삼으세요. 확장 요소는 후속 검증을 통해 구체화됩니다.'
  ];
  let loopIndex = 0;
  function setStep(index) {
    loopIndex = index;
    $$('.loop-step').forEach((step, i) => {
      step.classList.toggle('active', i === index); $('button', step).setAttribute('aria-pressed', String(i === index));
    });
    $('#loop-counter').textContent = `STEP 0${index + 1} / 05`; $('#loop-description').textContent = loopDescriptions[index];
  }
  $$('[data-step]').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.step))));
  $('#loop-next').addEventListener('click', () => setStep((loopIndex + 1) % 5));

  // ---- Skill simulation: animated, three-stage radial effects ----
  const stages = [
    { name: 'SEED PULSE', caption: '작은 힘의 시작', text: '작은 파동, 무한한 잠재력. 가장 가까운 위협부터 밀어냅니다.', radius: .19, interval: 2.1, rings: 1, bars: [30, 25, 20], values: ['BASIC', 'BASIC', '단일'] },
    { name: 'VERDANT BLOOM', caption: '확장되는 파동', text: '퍼져 나가는 힘. 더 넓은 범위와 잦아진 타격을 확인하세요.', radius: .31, interval: 1.45, rings: 2, bars: [63, 58, 60], values: ['WIDE', 'FAST', '파동'] },
    { name: 'SEED ASCENSION', caption: '전장을 뒤덮는 진화', text: '더 강하고, 더 빠르게. 겹쳐지는 파동이 전장을 휩씁니다.', radius: .43, interval: .95, rings: 3, bars: [96, 90, 95], values: ['VAST', 'RAPID', '확산'] }
  ];
  let stage = 0, stageChanged = 0;
  const evoTabs = $$('.evo-tab');
  let evoDrawing;
  function setStage(index, focus = false) {
    stage = index; stageChanged = performance.now();
    const data = stages[index];
    evoTabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    $('#evo-panel').setAttribute('aria-labelledby', evoTabs[index].id);
    $('#skill-name').textContent = data.name; $('#skill-description').textContent = data.text;
    $('#evo-state').textContent = 'SEED / STAGE 0' + (index + 1); $('#sim-stage').textContent = index + 1;
    $('#evo-caption').textContent = data.caption;
    ['range', 'speed', 'form'].forEach((name, i) => {
      $('#' + name + '-bar').style.width = data.bars[i] + '%'; $('#' + name + '-text').textContent = data.values[i];
    });
    evoDrawing?.redraw();
    if (focus) evoTabs[index].focus();
  }
  evoTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setStage(index));
    tab.addEventListener('keydown', e => tabKeyboard(e, index, 3, setStage));
  });
  function diamond(ctx, x, y, size, color, angle = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .72, 0);
    ctx.lineTo(0, size); ctx.lineTo(-size * .72, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  evoDrawing = visualCanvas($('#evolution-canvas'), (ctx, w, h, time) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, data = stages[stage], size = Math.min(w, h), radius = size * data.radius;
    ctx.strokeStyle = '#8cad5b13'; ctx.lineWidth = 1;
    for (let x = (w % 28) / 2; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = (h % 28) / 2; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
    glow.addColorStop(0, '#b7ec7225'); glow.addColorStop(.55, '#b7ec720a'); glow.addColorStop(1, '#b7ec7200');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#bde88c44'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < data.rings; i++) {
      const phase = reduced ? .7 - i * .15 : ((time / data.interval + i / data.rings) % 1);
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, phase * radius), 0, Math.PI * 2);
      ctx.lineWidth = 1.5 - i * .25; ctx.strokeStyle = `rgba(195,242,144,${(1 - phase) * .7})`; ctx.stroke();
    }
    if (stage === 2) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(reduced ? .3 : time * .14);
      ctx.strokeStyle = '#bce99333'; ctx.lineWidth = .7;
      for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(radius * .7, 0); ctx.lineTo(radius * .87, 0); ctx.stroke(); diamond(ctx, radius * .92, 0, 3, '#c7f495aa'); }
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4 + .7, distance = size * (.16 + (i % 4) * .055);
      const x = cx + Math.cos(angle) * distance * 1.2, y = cy + Math.sin(angle) * distance;
      const hit = distance < radius && (reduced || (time % data.interval) < .32);
      diamond(ctx, x, y, hit ? 4 : 6, hit ? '#d4fba68c' : '#7c806075', Math.PI / 4);
      if (hit && !reduced) { ctx.fillStyle = '#d3f7a799'; ctx.font = '9px Arial'; ctx.textAlign = 'center'; ctx.fillText(stage === 2 ? 'CRIT' : 'HIT', x, y - 16 - ((time % data.interval) * 25)); }
    }
    ctx.save(); ctx.shadowBlur = reduced ? 0 : 22; ctx.shadowColor = '#c6f78b'; diamond(ctx, cx, cy + (reduced ? 0 : Math.sin(time * 2) * 2), 13, '#d8fbb6'); ctx.restore();
    ctx.strokeStyle = '#d2f6a866'; ctx.beginPath(); ctx.ellipse(cx, cy + 22, 15, 4, 0, 0, Math.PI * 2); ctx.stroke();
  });
  setStage(0);

  // ---- Optional synthesized effects: no audio files / off by default ----
  const audio = { context: null, enabled: storage.get('sound', 'false') === 'true' };
  function audioUI() {
    $('#sound-toggle').textContent = audio.enabled ? 'SOUND ON' : 'SOUND OFF';
    $('#sound-toggle').setAttribute('aria-pressed', String(audio.enabled));
    $('#sound-toggle').setAttribute('aria-label', audio.enabled ? '효과음 끄기' : '효과음 켜기');
  }
  function unlockAudio() {
    if (!audio.enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { audio.enabled = false; audioUI(); return; }
      if (!audio.context) audio.context = new Audio();
      if (audio.context.state === 'suspended') audio.context.resume().catch(() => {});
    } catch { audio.enabled = false; audioUI(); }
  }
  function tone(type) {
    if (!audio.enabled || !audio.context || audio.context.state !== 'running') return;
    const settings = { pulse: [180, 80, .09, .018], hit: [510, 220, .06, .018], dodge: [250, 700, .12, .025], upgrade: [380, 1000, .3, .035], hurt: [120, 60, .16, .03], clear: [550, 1100, .5, .035] };
    const [from, to, duration, volume] = settings[type] || settings.hit;
    const ctx = audio.context, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type === 'hurt' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  $('#sound-toggle').addEventListener('click', () => { audio.enabled = !audio.enabled; storage.set('sound', audio.enabled); unlockAudio(); audioUI(); if (audio.enabled) tone('upgrade'); });
  audioUI();

  // ---- Combat: deterministic state machine + one animation loop ----
  (() => {
    const canvas = $('#game'), ctx = canvas.getContext('2d'), overlay = $('#game-overlay');
    const targetKills = [8, 12, 1], costs = [0, 4, 8];
    const state = {
      mode: 'ready', wave: 0, waveKills: 0, spawned: 0, kills: 0, seeds: 0, level: 1,
      elapsed: 0, spawnTimer: .7, attackTimer: .5, transition: 0, dodgeCD: 0, invulnerable: 0,
      shake: 0, hitFlash: 0, enemies: [], particles: [], pulses: [], labels: [], pickups: [], dangers: [],
      player: { x: 0, y: 0, hp: 100, dx: 0, dy: -1 }, keys: {}, pointer: null
    };
    let width = 700, height = 480, dpr = 1, frame = 0, previous = 0, hudTimer = 0, noticeTimer = 0;
    let best = Number(storage.get('best-time', '0')) || 0;
    const timeString = seconds => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
    function bestUI() { $('#best-record').textContent = best > 0 ? timeString(best) : '—'; }
    function radius() { return Math.min(width, height) * [0, .21, .29, .38][state.level]; }
    function attackInterval() { return [0, 1.15, .84, .6][state.level]; }
    function scale() { return Math.min(width, height) / 420; }
    function updateHUD() {
      const active = state.mode === 'running', paused = state.mode === 'paused';
      $('#game-hp').textContent = `${Math.max(0, Math.ceil(state.player.hp))} / 100`;
      $('#health-fill').style.width = Math.max(0, state.player.hp) + '%';
      $('#health-fill').style.filter = state.player.hp < 30 ? 'hue-rotate(-70deg)' : '';
      $('#game-score').textContent = String(state.kills).padStart(2, '0');
      $('#seed-count').textContent = String(state.seeds).padStart(2, '0');
      $('#game-time').textContent = timeString(state.elapsed);
      $('#wave-label').textContent = `WAVE 0${state.wave + 1} / 03`;
      const nextCost = costs[state.level] || 0;
      $('#upgrade').disabled = !active || state.level >= 3 || state.seeds < nextCost;
      $('#upgrade-label').innerHTML = state.level >= 3 ? '최종 진화<small>MAX LEVEL</small>' : `강화 LV.${state.level}<small>시드 ${nextCost}개 · E</small>`;
      $('#dodge').disabled = !active || state.dodgeCD > 0;
      $('#dodge-label').innerHTML = state.dodgeCD > 0 ? `재충전<small>${state.dodgeCD.toFixed(1)}s</small>` : '회피<small>SPACE</small>';
      $('#pause').disabled = !active && !paused; $('#pause').textContent = paused ? '▶' : 'Ⅱ';
      $('#pause').setAttribute('aria-label', paused ? '전투 계속하기' : '전투 일시정지');
      $('#restart').disabled = state.mode === 'ready';
      const done = state.mode === 'cleared' ? 3 : state.wave;
      [1, 2, 3].forEach(i => { $('#mission-' + i).textContent = i <= done ? '✓' : '○'; $('#mission-' + i).classList.toggle('done', i <= done); });
      const boss = state.enemies.find(e => e.type === 'boss');
      $('#boss-health').hidden = !boss || !active && !paused;
      if (boss) { $('#boss-fill').style.width = clamp(boss.hp / boss.maxHP * 100, 0, 100) + '%'; $('#boss-hp-text').textContent = Math.ceil(boss.hp / boss.maxHP * 100) + '%'; }
      $('#wave-progress-fill').style.width = (state.mode === 'cleared' ? 100 : (state.wave + state.waveKills / targetKills[state.wave]) / 3 * 100) + '%';
    }
    function setStatus(text) { $('#game-status').textContent = 'SIMULATION / ' + text; }
    function announce(text) {
      $('#wave-announcement').textContent = text; $('#wave-announcement').classList.add('show');
      clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('#wave-announcement').classList.remove('show'), 2100);
    }
    function burst(x, y, color = '#c6f78b', count = 12) {
      if (reduced) return;
      for (let i = 0; i < count && state.particles.length < 180; i++) {
        const angle = rand(0, Math.PI * 2), speed = rand(25, 110);
        state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rand(.3, .7), max: .7, color, r: rand(1, 2.5) });
      }
    }
    function label(x, y, text, color = '#d4f7b3') {
      if (state.labels.length < 25) state.labels.push({ x, y, text, color, life: .9 });
    }
    function spawnEnemy(type = 'normal') {
      const edge = Math.floor(rand(0, 4)), pad = 12;
      const x = edge === 0 ? pad : edge === 1 ? width - pad : rand(pad, width - pad);
      const y = edge === 2 ? pad : edge === 3 ? height - pad : rand(pad, height - pad);
      const hp = type === 'boss' ? 95 : type === 'elite' ? 4 : 1.8;
      state.enemies.push({
        x: type === 'boss' ? width / 2 : x, y: type === 'boss' ? 95 : y,
        type, hp, maxHP: hp, r: type === 'boss' ? 25 : type === 'elite' ? 10 : 7,
        speed: (type === 'boss' ? 22 : type === 'elite' ? 36 : rand(31, 42)) * scale(),
        hit: 0, phase: rand(0, 6.28), cast: type === 'boss' ? 3 : 0
      });
      state.spawned++;
    }
    function begin() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; unlockAudio(); clearTimeout(noticeTimer); $('#wave-announcement').classList.remove('show');
      Object.assign(state, {
        mode: 'running', wave: 0, waveKills: 0, spawned: 0, kills: 0, seeds: 0, level: 1,
        elapsed: 0, spawnTimer: .4, attackTimer: .4, transition: 0, dodgeCD: 0, invulnerable: 1,
        shake: 0, hitFlash: 0, enemies: [], particles: [], pulses: [], labels: [], pickups: [], dangers: [],
        keys: {}, pointer: null, player: { x: width / 2, y: height * .58, hp: 100, dx: 0, dy: -1 }
      });
      overlay.classList.add('hidden'); $('#boss-health').hidden = true; setStatus('LIVE');
      canvas.focus({ preventScroll: true }); updateHUD(); announce('WAVE 01 / EXPLORE');
      previous = performance.now(); frame = requestAnimationFrame(tick);
    }
    function end(won) {
      state.mode = won ? 'cleared' : 'dead'; state.keys = {}; state.pointer = null;
      clearTimeout(noticeTimer); $('#wave-announcement').classList.remove('show');
      if (won) {
        if (!best || state.elapsed < best) { best = state.elapsed; storage.set('best-time', best); bestUI(); }
        tone('clear'); $('#overlay-kicker').textContent = 'THE FIRST ASCENT / COMPLETE';
        $('#overlay-title').textContent = '당신의 가능성이 깨어났다.';
        $('#overlay-desc').textContent = `수호자 격파! ${timeString(state.elapsed)} · ${state.kills}마리 처치 · 스킬 LV.${state.level}. 다음 층을 향한 준비가 되었습니다.`;
      } else {
        tone('hurt'); $('#overlay-kicker').textContent = 'THE ASCENT IS NOT OVER';
        $('#overlay-title').textContent = '다시, 더 강해질 시간.';
        $('#overlay-desc').textContent = `${state.kills}마리 처치 · ${timeString(state.elapsed)} 생존. 적을 처치한 시드로 강화하고, 붉은 예고 범위는 회피하세요.`;
      }
      $('#start-game').innerHTML = '다시 도전 <span>↗</span>'; overlay.classList.remove('hidden');
      setStatus(won ? 'CLEAR' : 'RETRY'); updateHUD(); $('#start-game').focus({ preventScroll: true });
    }
    function pause(value = state.mode === 'running') {
      if (!['running', 'paused'].includes(state.mode)) return;
      state.mode = value ? 'paused' : 'running'; state.keys = {}; state.pointer = null;
      setStatus(value ? 'PAUSED' : 'LIVE'); updateHUD();
      if (value) {
        if (frame) cancelAnimationFrame(frame); frame = 0; draw();
      } else {
        unlockAudio(); previous = performance.now(); if (!frame) frame = requestAnimationFrame(tick); canvas.focus({ preventScroll: true });
      }
    }
    function upgrade() {
      if (state.mode !== 'running' || state.level >= 3) return;
      const cost = costs[state.level];
      if (state.seeds < cost) { toast(`강화에 시드 ${cost}개가 필요합니다.`); return; }
      state.seeds -= cost; state.level++; state.attackTimer = .08;
      state.player.hp = Math.min(100, state.player.hp + 12);
      tone('upgrade'); burst(state.player.x, state.player.y, '#dcffb4', 26);
      label(state.player.x, state.player.y - 25, 'EVOLUTION ' + state.level);
      announce(state.level === 3 ? 'SEED ASCENSION' : 'VERDANT BLOOM'); updateHUD();
    }
    function dodge() {
      if (state.mode !== 'running' || state.dodgeCD > 0) return;
      const p = state.player, fromX = p.x, fromY = p.y;
      p.x = clamp(p.x + p.dx * 85 * scale(), 13, width - 13); p.y = clamp(p.y + p.dy * 85 * scale(), 13, height - 13);
      state.invulnerable = .5; state.dodgeCD = 2.5; tone('dodge');
      if (!reduced) {
        state.pulses.push({ x: fromX, y: fromY, max: 24, life: .35, duration: .35, color: '#abdd8a' });
        burst(fromX, fromY, '#abdd8a', 8);
      }
      updateHUD();
    }
    function hurt(amount) {
      if (state.invulnerable > 0 || state.mode !== 'running') return;
      state.player.hp -= amount; state.invulnerable = .75;
      if (!reduced) { state.shake = 4; state.hitFlash = .13; }
      label(state.player.x, state.player.y - 16, '-' + amount, '#edac8a'); tone('hurt');
    }
    function hitEnemy(enemy, damage) {
      enemy.hp -= damage; enemy.hit = .18;
      label(enemy.x, enemy.y - enemy.r - 8, String(damage));
      if (enemy.hp <= 0) {
        state.kills++; state.waveKills++;
        const gain = enemy.type === 'boss' ? 8 : enemy.type === 'elite' ? 2 : 1;
        state.seeds += gain; burst(enemy.x, enemy.y, enemy.type === 'boss' ? '#eec08b' : '#c6f78b', enemy.type === 'boss' ? 35 : 10);
        if (enemy.type !== 'boss' && Math.random() < .26) state.pickups.push({ x: enemy.x, y: enemy.y, life: 14 });
      }
    }
    function simulate(dt) {
      const p = state.player;
      state.elapsed += dt; state.dodgeCD = Math.max(0, state.dodgeCD - dt);
      state.invulnerable = Math.max(0, state.invulnerable - dt); state.shake = Math.max(0, state.shake - dt * 18);
      state.hitFlash = Math.max(0, state.hitFlash - dt); state.attackTimer -= dt;
      let mx = 0, my = 0;
      if (state.keys.ArrowLeft || state.keys.a) mx--;
      if (state.keys.ArrowRight || state.keys.d) mx++;
      if (state.keys.ArrowUp || state.keys.w) my--;
      if (state.keys.ArrowDown || state.keys.s) my++;
      if (state.pointer) {
        const dx = state.pointer.x - p.x, dy = state.pointer.y - p.y;
        if (Math.hypot(dx, dy) > 7) { mx = dx; my = dy; } else { mx = 0; my = 0; }
      }
      const magnitude = Math.hypot(mx, my);
      if (magnitude) {
        mx /= magnitude; my /= magnitude; p.dx = mx; p.dy = my;
        const move = Math.min(150 * scale() * dt, state.pointer ? Math.hypot(state.pointer.x - p.x, state.pointer.y - p.y) : Infinity);
        p.x = clamp(p.x + mx * move, 13, width - 13); p.y = clamp(p.y + my * move, 13, height - 13);
      }
      if (state.transition > 0) {
        state.transition -= dt;
        if (state.transition <= 0) {
          state.transition = 0;
          state.wave++; state.waveKills = 0; state.spawned = 0; state.spawnTimer = .3;
          p.hp = Math.min(100, p.hp + 18); state.invulnerable = 1; state.dangers = [];
          announce(state.wave === 2 ? 'WAVE 03 / THE GUARDIAN' : 'WAVE 02 / BREAKTHROUGH');
          updateHUD();
        }
      } else {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.spawned < targetKills[state.wave]) {
          if (state.wave === 2) spawnEnemy('boss');
          else spawnEnemy(state.wave === 1 && state.spawned % 3 === 2 ? 'elite' : 'normal');
          state.spawnTimer = state.wave === 0 ? .72 : .58;
        }
      }
      state.enemies.forEach((enemy, index) => {
        enemy.hit = Math.max(0, enemy.hit - dt);
        const dx = p.x - enemy.x, dy = p.y - enemy.y, distance = Math.hypot(dx, dy) || 1;
        const stopDistance = enemy.type === 'boss' ? 35 : 3;
        if (distance > stopDistance) { enemy.x += dx / distance * enemy.speed * dt; enemy.y += dy / distance * enemy.speed * dt; }
        // Small crowd separation keeps silhouettes readable.
        state.enemies.forEach((other, j) => {
          if (j <= index) return;
          const sx = enemy.x - other.x, sy = enemy.y - other.y, d = Math.hypot(sx, sy) || 1;
          if (d < enemy.r + other.r + 3) { const push = dt * 18; enemy.x += sx / d * push; enemy.y += sy / d * push; other.x -= sx / d * push; other.y -= sy / d * push; }
        });
        if (distance < enemy.r + 9) hurt(enemy.type === 'boss' ? 18 : enemy.type === 'elite' ? 12 : 8);
        if (enemy.type === 'boss') {
          enemy.cast -= dt;
          if (enemy.cast <= 0) {
            enemy.cast = enemy.hp < 45 ? 2.2 : 3;
            state.dangers.push({ x: p.x, y: p.y, r: 56 * scale(), life: 1.15, duration: 1.15 });
            if (enemy.hp < 45) state.dangers.push({ x: clamp(p.x + 65 * scale(), 30, width - 30), y: clamp(p.y - 55 * scale(), 30, height - 30), r: 45 * scale(), life: 1.5, duration: 1.5 });
          }
        }
      });
      if (state.attackTimer <= 0) {
        state.attackTimer = attackInterval(); tone('pulse');
        state.pulses.push({ x: p.x, y: p.y, max: radius(), life: .48, duration: .48, color: '#c6f78b' });
        const damage = [0, 2, 3, 5][state.level];
        let hit = false;
        state.enemies.forEach(enemy => { if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= radius() + enemy.r) { hitEnemy(enemy, damage); hit = true; } });
        if (hit) tone('hit');
        state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
      }
      state.dangers.forEach(danger => {
        danger.life -= dt;
        if (danger.life <= 0) {
          if (Math.hypot(p.x - danger.x, p.y - danger.y) < danger.r + 6) hurt(22);
          state.pulses.push({ x: danger.x, y: danger.y, max: danger.r, life: .35, duration: .35, color: '#d59a70' });
          burst(danger.x, danger.y, '#d59a70', 10);
        }
      });
      state.dangers = state.dangers.filter(d => d.life > 0);
      state.pickups.forEach(item => {
        item.life -= dt;
        const dx = p.x - item.x, dy = p.y - item.y, d = Math.hypot(dx, dy);
        if (d < 85 * scale() && d > 1) { item.x += dx / d * dt * 90; item.y += dy / d * dt * 90; }
        if (d < 20) { p.hp = Math.min(100, p.hp + 15); item.life = 0; label(p.x, p.y - 20, '+15 HP', '#a1e6c2'); }
      });
      state.pickups = state.pickups.filter(item => item.life > 0);
      state.particles.forEach(particle => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .97; particle.vy *= .97; particle.life -= dt; });
      state.particles = state.particles.filter(particle => particle.life > 0);
      state.pulses.forEach(pulse => pulse.life -= dt); state.pulses = state.pulses.filter(pulse => pulse.life > 0);
      state.labels.forEach(label => { label.y -= dt * 24; label.life -= dt; }); state.labels = state.labels.filter(label => label.life > 0);
      if (p.hp <= 0) { end(false); return; }
      if (!state.transition && state.waveKills >= targetKills[state.wave]) {
        if (state.wave === 2) { end(true); return; }
        state.transition = 2; announce('WAVE CLEAR / RECOVER'); tone('upgrade'); updateHUD();
      }
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0a140e'; ctx.fillRect(0, 0, width, height);
      ctx.save();
      if (!reduced && state.shake > 0) ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
      const ambient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * .7);
      ambient.addColorStop(0, '#2c442221'); ambient.addColorStop(1, '#11200e00'); ctx.fillStyle = ambient; ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = .6; ctx.strokeStyle = '#9bbe6c12';
      for (let x = width % 32 / 2; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = height % 32 / 2; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.strokeStyle = '#9bbe6c18'; ctx.beginPath(); ctx.arc(width / 2, height / 2, Math.min(width, height) * .4, 0, Math.PI * 2); ctx.stroke();
      // Corner brackets.
      ctx.strokeStyle = '#829f5a55'; ctx.lineWidth = 1;
      [[12, 12, 1, 1], [width - 12, 12, -1, 1], [12, height - 12, 1, -1], [width - 12, height - 12, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy * 12); ctx.lineTo(x, y); ctx.lineTo(x + dx * 12, y); ctx.stroke();
      });
      state.dangers.forEach(d => {
        const progress = 1 - d.life / d.duration;
        ctx.fillStyle = `rgba(211,133,88,${.04 + progress * .12})`; ctx.strokeStyle = '#dba27899';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#dfa47744'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * progress, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e1a476aa'; ctx.beginPath(); ctx.moveTo(d.x - 5, d.y); ctx.lineTo(d.x + 5, d.y); ctx.moveTo(d.x, d.y - 5); ctx.lineTo(d.x, d.y + 5); ctx.stroke();
      });
      state.pickups.forEach(item => {
        ctx.strokeStyle = '#9fd8ba'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(item.x, item.y, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(item.x - 3, item.y); ctx.lineTo(item.x + 3, item.y); ctx.moveTo(item.x, item.y - 3); ctx.lineTo(item.x, item.y + 3); ctx.stroke();
      });
      const p = state.player, range = radius();
      ctx.beginPath(); ctx.arc(p.x, p.y, range, 0, Math.PI * 2); ctx.fillStyle = '#b3e57b04'; ctx.fill();
      ctx.setLineDash([2, 7]); ctx.strokeStyle = '#b3e57b25'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      state.pulses.forEach(pulse => {
        const phase = 1 - pulse.life / pulse.duration;
        const r = reduced ? pulse.max : pulse.max * (1 - (1 - phase) ** 2);
        ctx.save(); ctx.globalAlpha = (1 - phase) * .8; ctx.strokeStyle = pulse.color; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.arc(pulse.x, pulse.y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
        if (!reduced) { ctx.globalAlpha *= .25; ctx.fillStyle = pulse.color; ctx.fill(); }
        ctx.restore();
      });
      state.enemies.forEach(enemy => {
        const boss = enemy.type === 'boss', elite = enemy.type === 'elite';
        ctx.save(); ctx.translate(enemy.x, enemy.y);
        const color = enemy.hit > 0 ? '#e2ffc0' : boss ? '#d3a36b' : elite ? '#bc9c6c' : '#8d946a';
        ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(0, enemy.r + 5, enemy.r * 1.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        if (boss) {
          ctx.strokeStyle = '#d6a16a66'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 10, 0, Math.PI * 2); ctx.stroke();
          ctx.rotate(reduced ? 0 : state.elapsed * .22);
          ctx.strokeStyle = color; ctx.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (enemy.r + 6), Math.sin(a) * (enemy.r + 6)); ctx.lineTo(Math.cos(a) * (enemy.r + 14), Math.sin(a) * (enemy.r + 14)); ctx.stroke(); }
          diamond(ctx, 0, 0, enemy.r, color); diamond(ctx, 0, 0, enemy.r * .4, '#3b3022');
        } else {
          diamond(ctx, 0, 0, enemy.r, color, Math.PI / 4);
          if (elite) { ctx.strokeStyle = '#d9bb8e55'; ctx.strokeRect(-enemy.r - 3, -enemy.r - 3, (enemy.r + 3) * 2, (enemy.r + 3) * 2); }
        }
        ctx.restore();
      });
      // Player: glow + invulnerability flicker.
      ctx.save();
      ctx.globalAlpha = state.invulnerable > 0 && !reduced ? .55 + Math.sin(state.elapsed * 32) * .2 : 1;
      ctx.shadowBlur = reduced ? 0 : 18; ctx.shadowColor = '#c6f78b';
      diamond(ctx, p.x, p.y, 12, '#d7fbb4');
      ctx.restore();
      ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(p.x + p.dx * 3, p.y + p.dy * 3, 1.5, 0, Math.PI * 2); ctx.fill();
      state.particles.forEach(particle => {
        ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1); ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.r, particle.r);
      }); ctx.globalAlpha = 1;
      state.labels.forEach(label => {
        ctx.globalAlpha = clamp(label.life * 2, 0, 1); ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = label.color;
        ctx.fillText(label.text, label.x, label.y);
      }); ctx.globalAlpha = 1; ctx.textAlign = 'left';
      if (state.pointer) {
        ctx.strokeStyle = '#c6f78b55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(state.pointer.x, state.pointer.y, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(state.pointer.x - 4, state.pointer.y); ctx.lineTo(state.pointer.x + 4, state.pointer.y); ctx.stroke();
      }
      ctx.restore();
      if (state.hitFlash > 0 && !reduced) { ctx.fillStyle = `rgba(184,95,63,${state.hitFlash * .65})`; ctx.fillRect(0, 0, width, height); }
      if (state.mode === 'paused') {
        ctx.fillStyle = '#07110ce6'; ctx.fillRect(0, 0, width, height); ctx.textAlign = 'center';
        ctx.fillStyle = '#c6f78b'; ctx.font = '24px Arial'; ctx.fillText('PAUSED', width / 2, height / 2 - 10);
        ctx.fillStyle = '#8fa77a'; ctx.font = '11px sans-serif'; ctx.fillText('▶ 버튼 또는 ESC로 계속하기', width / 2, height / 2 + 21); ctx.textAlign = 'left';
      }
    }
    function tick(ts) {
      frame = 0;
      if (state.mode !== 'running') return;
      const dt = Math.min((ts - previous) / 1000, .04) || .016; previous = ts;
      simulate(dt); draw(); hudTimer += dt;
      if (hudTimer > .1) { updateHUD(); hudTimer = 0; }
      if (state.mode === 'running') frame = requestAnimationFrame(tick);
    }
    function resize() {
      const rect = canvas.getBoundingClientRect(), oldW = width, oldH = height;
      width = Math.max(rect.width, 1); height = Math.max(rect.height, 1); dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.player.x === 0) { state.player.x = width / 2; state.player.y = height / 2; }
      else {
        [state.player, ...state.enemies, ...state.pickups, ...state.dangers, ...state.pulses].forEach(p => {
          p.x = clamp(p.x / oldW * width, 12, width - 12); p.y = clamp(p.y / oldH * height, 12, height - 12);
        });
        state.enemies.forEach(enemy => { enemy.speed = (enemy.type === 'boss' ? 22 : enemy.type === 'elite' ? 36 : 36) * scale(); });
      }
      state.pointer = null; draw();
    }
    new ResizeObserver(resize).observe(canvas);
    $('#start-game').addEventListener('click', begin);
    $('#upgrade').addEventListener('click', () => { upgrade(); canvas.focus({ preventScroll: true }); });
    $('#dodge').addEventListener('click', () => { dodge(); canvas.focus({ preventScroll: true }); });
    $('#pause').addEventListener('click', () => pause());
    $('#restart').addEventListener('click', begin);
    canvas.addEventListener('keydown', event => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', ' ', 'e', 'Escape'].includes(key)) {
        event.preventDefault();
        if (key === 'Escape' && !event.repeat) { pause(); return; }
        if (state.mode !== 'running') return;
        state.keys[key] = true;
        if (key === ' ' && !event.repeat) dodge();
        if (key === 'e' && !event.repeat) upgrade();
      }
    });
    addEventListener('keyup', event => { state.keys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
    canvas.addEventListener('blur', () => { state.keys = {}; state.pointer = null; });
    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: clamp((event.clientX - rect.left) / rect.width * width, 12, width - 12), y: clamp((event.clientY - rect.top) / rect.height * height, 12, height - 12) };
    }
    let pointerId = null;
    canvas.addEventListener('pointerdown', event => {
      if (state.mode !== 'running' || pointerId !== null) return;
      canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
      pointerId = event.pointerId; state.pointer = pointerPosition(event);
    });
    canvas.addEventListener('pointermove', event => { if (event.pointerId === pointerId && state.pointer) state.pointer = pointerPosition(event); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, event => {
      if (event.pointerId === pointerId) { state.pointer = null; pointerId = null; }
    }));
    addEventListener('blur', () => { if (state.mode === 'running') pause(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'running') pause(true); });
    events.addEventListener('overlayopen', () => { if (state.mode === 'running') pause(true); });
    events.addEventListener('motionchange', () => { state.particles = []; state.shake = 0; draw(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting && state.mode === 'running') pause(true);
    }, { threshold: .12 }).observe(canvas);
    bestUI(); resize(); updateHUD();
  })();
})();
