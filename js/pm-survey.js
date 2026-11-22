/* หน้าแบบประเมินความพึงพอใจ การประชุมผู้ปกครอง — ออกแบบให้ตอบบนมือถือทีละขั้น */
(function () {
  const S = window.SURVEY;
  const SV = window.SVStore;
  const { esc } = window.SVU;
  const g = S.GROUPS.parent;
  const $ = id => document.getElementById(id);
  const view = $('view');
  const params = () => new URLSearchParams(location.search);
  const DRAFT = 'pmeet69-draft';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth = reduceMotion ? 'auto' : 'smooth';
  const totalItems = g.sections.reduce((a, s) => a + s.items.length, 0);
  const presetGrade = () => { const c = (params().get('c') || '').trim(); return S.GRADES.find(gr => gr === c || S.GRADE_CODE[gr] === c.toLowerCase()) || ''; };

  let toastT;
  function toast(msg, bad) {
    const t = $('toast'); t.textContent = msg; t.style.background = bad ? '#B42318' : '#4A1D2E';
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000);
  }
  function setUrl(mut, push) {
    const p = new URLSearchParams(location.search);
    mut(p);
    const url = location.pathname + (p.toString() ? '?' + p : '');
    push ? history.pushState(null, '', url) : history.replaceState(null, '', url);
  }
  window.addEventListener('popstate', route);
  const demoNote = () => `<div class="note warn">โหมดทดลอง: คำตอบเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ยังไม่ส่งเข้าระบบจริง</div>`;
  const credit = (extra) => `<footer class="credit ${extra || ''}">
      <div class="cr-badge"><span class="cr-ic" aria-hidden="true">💗</span><span class="cr-tx"><small>พัฒนาโดย</small><b>${esc(S.developer)}</b></span></div>
      <div class="cr-sub">${esc(S.school)} · ปีการศึกษา ${esc(S.year)}</div>
    </footer>`;
  const topbar = () => `<header class="top noprint"><div class="wrap"><div class="bar">
      <img src="assets/favicon.png" alt="">
      <div><div class="t1">ประชุมผู้ปกครองนักเรียน</div><div class="t2">${esc(S.school)}</div></div>
    </div></div></header>`;

  /* ---------------- หน้าแรก ---------------- */
  function renderHome() {
    current = null;
    document.title = 'แบบประเมินความพึงพอใจ | ประชุมผู้ปกครองนักเรียน 2569';
    const c = presetGrade();
    view.innerHTML = `${topbar()}
      <section class="hero"><div class="wrap">
        <img class="logo" src="assets/logo.png" alt="ตราโรงเรียน">
        <div><span class="kicker">💗 ${c ? 'ประชุมผู้ปกครองชั้น ' + esc(c) : esc(S.dateText)}</span></div>
        <h1>แบบประเมินความพึงพอใจ<br><span class="g">การประชุมผู้ปกครองนักเรียน</span></h1>
        <p class="sub">${esc(S.levelText)} ปีการศึกษา ${esc(S.year)}<br>${esc(S.school)}</p>
        <div class="facts">
          <div class="fact"><div class="i">📝</div><div class="k">${totalItems} ข้อ</div><div class="s">แตะเลือกได้เลย</div></div>
          <div class="fact"><div class="i">⏱️</div><div class="k">3–4 นาที</div><div class="s">ตอบบนมือถือ</div></div>
          <div class="fact"><div class="i">🔒</div><div class="k">ไม่ระบุชื่อ</div><div class="s">สรุปผลภาพรวม</div></div>
        </div>
      </div></section>
      <div class="wrap start">
        ${SV.isDemo ? '<div style="margin-bottom:14px">' + demoNote() + '</div>' : ''}
        <button class="btn btn-primary btn-lg" id="startBtn">เริ่มทำแบบประเมิน ›</button>
        <div class="privacy"><span aria-hidden="true">🌸</span><span>ขอบคุณผู้ปกครองทุกท่านที่สละเวลามาร่วมประชุม ความคิดเห็นของท่านจะช่วยให้โรงเรียนพัฒนาการจัดประชุมและการทำงานร่วมกันระหว่างบ้านกับโรงเรียนให้ดียิ่งขึ้น</span></div>
        ${credit()}
      </div>`;
    $('startBtn').onclick = () => { setUrl(p => p.set('s', 1), true); route(); };
  }

  /* ---------------- แบบฟอร์มทีละขั้น ---------------- */
  let current = null;
  const layout = f => f.options.every(o => o.length <= 8) ? (f.options.length > 5 ? 'q-grid' : '') : (f.options.length > 3 || f.options.some(o => o.length > 18) ? 'q-list' : '');
  function chipField(f) {
    const type = f.type === 'check' ? 'checkbox' : 'radio';
    const opt = f.required === false;
    const hint = f.type === 'check' ? 'เลือกได้มากกว่า 1 ข้อ' : '';
    const label = f.label.replace(/\s*\(ตอบได้มากกว่า 1 ข้อ\)/, '');
    return `<fieldset class="q ${layout(f)}" data-field="${f.id}" ${opt ? '' : 'data-adv="1"'}>
      <legend>${esc(label)}${hint ? `<span class="hint">${hint}</span>` : ''}</legend>
      <div class="chips">${f.options.map(o => `<label class="chip"><input type="${type}" name="d_${f.id}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>
    </fieldset>`;
  }

  function renderForm(startStep) {
    document.title = 'ทำแบบประเมิน | ประชุมผู้ปกครองนักเรียน 2569';
    const nSec = g.sections.length;
    const steps = [
      { label: 'ตอนที่ 1 ข้อมูลทั่วไป' },
      ...g.sections.map((s, i) => ({ label: `ด้านที่ ${i + 1}/${nSec} ${s.name.replace(/^ด้าน/, '')}` })),
      { label: 'ตอนที่ 3 ความคิดเห็นเพิ่มเติม' }
    ];
    const totalReq = totalItems + g.demo.filter(f => f.required !== false).length;
    let no = 0;
    const likert = it => { no++; return `
      <div class="item" data-item="${it.id}" data-adv="1" role="radiogroup" aria-labelledby="lb-${it.id}">
        <div class="txt" id="lb-${it.id}"><span class="no">${no}</span><span>${esc(it.text)}</span></div>
        <div class="scale">${S.SCALE.map(sc => `<label><input type="radio" name="a_${it.id}" value="${sc.v}" aria-label="${sc.v} ${sc.label}"><span><i aria-hidden="true">${sc.emoji}</i><small>${sc.label}</small></span></label>`).join('')}</div>
      </div>`; };

    view.innerHTML = `
      <div class="fhead">
        <div class="wrap fh-in">
          <button type="button" class="iconbtn" id="backBtn" aria-label="กลับหน้าแรก">‹</button>
          <div class="fh-t">
            <div class="fh-g">💗 ประเมินการประชุมผู้ปกครอง</div>
            <div class="fh-s" id="stepLabel"></div>
          </div>
          <div class="fh-c" title="จำนวนข้อที่ตอบแล้ว"><b id="progNum">0</b><span>/${totalReq}</span></div>
        </div>
        <div class="fh-track"><div class="fill" id="progFill"></div></div>
      </div>
      <div class="dots" id="dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
      <form id="form" class="wrap fbody" novalidate>
        <section class="step" data-step="0">
          ${SV.isDemo ? demoNote() : ''}
          <div class="note intro">
            <b>คำชี้แจง</b> แบบประเมินมี 3 ตอน ไม่ต้องระบุชื่อ โปรดเลือกระดับความพึงพอใจที่ตรงกับความคิดเห็นของท่านมากที่สุด
            <div class="legend5">${S.SCALE.map(s => `<span>${s.emoji} ${s.label}</span>`).join('')}</div>
          </div>
          <div class="step-h"><span class="tag">ตอนที่ 1</span><h2>ข้อมูลทั่วไป</h2></div>
          <div class="card stack">${g.demo.map(chipField).join('')}</div>
        </section>
        ${g.sections.map((sec, si) => `
          <section class="step" data-step="${si + 1}" hidden>
            <div class="step-h"><span class="tag">ตอนที่ 2 · ด้านที่ ${si + 1}/${nSec}</span><h2>${esc(sec.name)}</h2></div>
            <div class="card items">${sec.items.map(likert).join('')}</div>
          </section>`).join('')}
        <section class="step" data-step="${nSec + 1}" hidden>
          <div class="step-h"><span class="tag">ตอนที่ 3</span><h2>ความคิดเห็นและข้อเสนอแนะ</h2></div>
          <p class="muted small" style="margin:0 0 10px">ไม่บังคับตอบ แต่ทุกความคิดเห็นช่วยให้โรงเรียนดูแลบุตรหลานของท่านได้ดียิ่งขึ้น 💕</p>
          <div class="card stack">
            ${g.open.map(o => `<label class="block"><span class="lbl">${esc(o.label)}</span>
              <textarea class="field" rows="3" maxlength="1000" name="t_${o.id}" enterkeyhint="done" placeholder="พิมพ์ได้เลย (ถ้ามี)"></textarea></label>`).join('')}
          </div>
          <p id="formErr" class="note bad hidden" role="alert" style="margin-top:14px"></p>
        </section>
        ${credit('cr-compact')}
      </form>
      <div class="fbar">
        <div class="wrap fb-in">
          <button type="button" class="btn btn-soft" id="prevBtn">‹ ย้อนกลับ</button>
          <button type="button" class="btn btn-primary" id="nextBtn">ถัดไป ›</button>
        </div>
      </div>`;

    const form = $('form');
    const stepEls = [...form.querySelectorAll('.step')];
    let step = 0;
    restoreDraft(form);
    const c = presetGrade();
    if (c && !form.querySelector('[name="d_grade"]:checked')) {
      const r = [...form.querySelectorAll('[name="d_grade"]')].find(x => x.value === c); if (r) r.checked = true;
    }

    const isAnswered = el => !!el.querySelector('input:checked');
    const reqIn = el => [...el.querySelectorAll('[data-adv]')];

    function update() {
      let done = 0;
      form.querySelectorAll('[data-adv]').forEach(el => { if (isAnswered(el)) { done++; el.classList.remove('missing'); } });
      $('progNum').textContent = done;
      $('progFill').style.width = (done * 100 / totalReq) + '%';
      $('nextBtn').classList.toggle('ready', reqIn(stepEls[step]).every(isAnswered));
      [...$('dots').children].forEach((d, k) => { d.className = k === step ? 'on' : (k < stepEls.length - 1 && reqIn(stepEls[k]).every(isAnswered) ? 'done' : ''); });
    }

    function showStep(i, push) {
      step = Math.max(0, Math.min(steps.length - 1, i));
      stepEls.forEach((el, k) => { el.hidden = k !== step; });
      $('stepLabel').textContent = `ขั้น ${step + 1}/${steps.length} · ${steps[step].label}`;
      $('prevBtn').textContent = step === 0 ? '‹ หน้าแรก' : '‹ ย้อนกลับ';
      const last = step === steps.length - 1;
      $('nextBtn').textContent = last ? 'ส่งแบบประเมิน 💌' : 'ถัดไป ›';
      $('nextBtn').classList.toggle('send', last);
      window.scrollTo({ top: 0, behavior: 'auto' });
      setUrl(p => p.set('s', step + 1), push);
      update();
      const h = stepEls[step].querySelector('.step-h h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    function markMissing(container) {
      const miss = reqIn(container).filter(el => !isAnswered(el));
      miss.forEach(el => el.classList.add('missing'));
      return miss;
    }
    function scrollToEl(el) {
      const y = el.getBoundingClientRect().top + window.scrollY - (document.querySelector('.fhead').offsetHeight + 12);
      window.scrollTo({ top: y, behavior: smooth });
    }

    /* ตอบแล้วเลื่อนไปข้อถัดไปที่ยังไม่ได้ตอบ */
    let advT;
    form.addEventListener('change', e => {
      update(); saveDraft(form);
      const host = e.target.closest('[data-adv]');
      if (!host || e.target.type !== 'radio') return;
      clearTimeout(advT);
      advT = setTimeout(() => {
        const list = reqIn(stepEls[step]);
        const idx = list.indexOf(host);
        const next = list.slice(idx + 1).find(el => !isAnswered(el)) || list.find(el => !isAnswered(el));
        if (next) scrollToEl(next);
        else { const nb = $('nextBtn'); nb.classList.remove('pulse'); void nb.offsetWidth; nb.classList.add('pulse'); }
      }, 280);
    });
    form.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') saveDraft(form); });
    form.addEventListener('submit', e => e.preventDefault());

    const goHome = () => { setUrl(p => p.delete('s'), true); route(); };
    $('backBtn').onclick = goHome;
    $('prevBtn').onclick = () => { if (step === 0) goHome(); else showStep(step - 1, true); };
    $('nextBtn').onclick = async () => {
      if (step < steps.length - 1) {
        const miss = markMissing(stepEls[step]);
        if (miss.length) { toast(`ยังไม่ได้ตอบ ${miss.length} ข้อ (ข้อที่มีสีแดง)`, true); scrollToEl(miss[0]); return; }
        showStep(step + 1, true);
        return;
      }
      for (let k = 0; k < stepEls.length - 1; k++) {
        const miss = markMissing(stepEls[k]);
        if (miss.length) { showStep(k, true); setTimeout(() => scrollToEl(miss[0]), 50); toast(`ยังไม่ได้ตอบ ${miss.length} ข้อ`, true); return; }
      }
      const err = $('formErr'); err.classList.add('hidden');
      const btn = $('nextBtn'); btn.disabled = true; btn.textContent = 'กำลังส่ง...';
      try {
        const latest = await withTimeout(SV.getConfig(), 8000).catch(() => cfgCache);
        if (latest && latest.open === false) { renderClosed(latest); return; }
        const doc = collect(form);
        await withTimeout(SV.submit(doc), 20000);
        clearDraft();
        renderDone(doc.demo.grade);
      } catch (ex) {
        console.error(ex);
        const c = (ex && ex.code) || '';
        err.textContent = c.includes('permission-denied') ? 'ระบบปิดรับแบบประเมินแล้ว หรือข้อมูลไม่ถูกต้อง' : 'ส่งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วกด “ส่งแบบประเมิน” อีกครั้ง (คำตอบยังอยู่ครบ)';
        err.classList.remove('hidden');
        err.scrollIntoView({ behavior: smooth, block: 'center' });
        btn.disabled = false; btn.textContent = 'ส่งแบบประเมิน 💌';
      }
    };

    let start = startStep == null ? 0 : startStep;
    for (let k = 0; k < start && k < stepEls.length - 1; k++) { if (!reqIn(stepEls[k]).every(isAnswered)) { start = k; break; } }
    showStep(start, false);
    current = { showStep: i => showStep(i, false) };
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  function collect(form) {
    const doc = { group: g.id, demo: {}, ans: {}, text: {}, v: 1 };
    const pick = (name, multi) => multi ? [...form.querySelectorAll(`[name="${name}"]:checked`)].map(i => i.value) : ((form.querySelector(`[name="${name}"]:checked`) || {}).value || '');
    g.demo.forEach(f => { const v = pick('d_' + f.id, f.type === 'check'); if (v && v.length) doc.demo[f.id] = v; });
    g.sections.forEach(s => s.items.forEach(it => { const v = pick('a_' + it.id); if (v) doc.ans[it.id] = Number(v); }));
    g.open.forEach(o => { const v = (form.querySelector(`[name="t_${o.id}"]`).value || '').trim().slice(0, 1000); if (v) doc.text[o.id] = v; });
    return doc;
  }

  /* ----- ร่างคำตอบ (กันหายเมื่อรีเฟรชหรือสลับแอป) ----- */
  function saveDraft(form) {
    const d = {};
    form.querySelectorAll('input:checked').forEach(i => { (d[i.name] = d[i.name] || []).push(i.value); });
    form.querySelectorAll('textarea').forEach(t => { if (t.value) d[t.name] = t.value; });
    try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) {}
  }
  function restoreDraft(form) {
    let d; try { d = JSON.parse(sessionStorage.getItem(DRAFT) || 'null'); } catch (e) {}
    if (!d) return;
    Object.keys(d).forEach(name => {
      if (typeof d[name] === 'string') { const t = form.querySelector(`[name="${name}"]`); if (t) t.value = d[name]; return; }
      d[name].forEach(v => { const i = [...form.querySelectorAll(`[name="${name}"]`)].find(x => x.value === v); if (i) i.checked = true; });
    });
  }
  function clearDraft() { try { sessionStorage.removeItem(DRAFT); } catch (e) {} }

  /* ---------------- หลังส่ง / ปิดรับ ---------------- */
  function confetti() {
    if (reduceMotion) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#DB3F68', '#FF8A73', '#FF7EB3', '#FFB59E', '#FFD166', '#F7735F'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
      p.style.animationDelay = (Math.random() * .5) + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }
  function renderDone(grade) {
    current = null;
    setUrl(p => p.delete('s'), false);
    window.scrollTo(0, 0);
    view.innerHTML = `${topbar()}<div class="wrap" style="padding:24px 16px 40px">
      <div class="card done-box">
        <div class="big" aria-hidden="true">💖</div>
        <h1 style="font-size:25px;margin-top:14px">ขอบคุณที่ร่วมตอบแบบประเมิน</h1>
        <p class="muted">คำตอบของท่าน${grade ? ' (ชั้น ' + esc(grade) + ')' : ''} ถูกบันทึกเรียบร้อยแล้ว<br>${esc(S.school)} จะนำความคิดเห็นของท่านไปพัฒนาการดูแลบุตรหลานให้ดียิ่งขึ้น</p>
        <div class="done-actions">
          <button class="btn btn-primary btn-lg" id="again">ตอบสำหรับผู้ปกครองท่านถัดไป</button>
        </div>
        <p class="xs muted" style="margin-top:14px">ใช้ปุ่มนี้เมื่อผู้ปกครองหลายท่านใช้เครื่องเดียวกัน</p>
      </div>${credit()}</div>`;
    confetti();
    $('again').onclick = () => { setUrl(p => p.set('s', 1), false); route(); };
  }
  function renderClosed(cfg) {
    current = null;
    view.innerHTML = `${topbar()}<div class="wrap" style="padding:24px 16px 40px"><div class="card done-box">
      <div class="big" aria-hidden="true">🌷</div>
      <h1 style="font-size:23px;margin-top:12px">ปิดรับแบบประเมินแล้ว</h1>
      <p class="muted">${esc(cfg.closedMsg || 'ขอขอบคุณผู้ปกครองทุกท่านที่ให้ความร่วมมือ')}</p></div>${credit()}</div>`;
  }

  /* ---------------- ฉบับพิมพ์ ---------------- */
  function renderPrint() {
    current = null;
    document.title = 'แบบประเมินการประชุมผู้ปกครอง ฉบับพิมพ์';
    let no = 0;
    const box = o => `<span><span class="box"></span>${esc(o)}</span>`;
    view.innerHTML = `
      <div class="printbar"><b>แบบประเมินฉบับพิมพ์</b>
        <button class="btn btn-sm btn-soft" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button>
        <span class="xs">ผลจากกระดาษ ให้ครูกรอกเข้าระบบผ่านแบบออนไลน์ทีละชุด</span></div>
      <div class="paper">
        <div class="center"><img src="assets/logo.png" alt="" style="width:54px"></div>
        <h1>${esc(S.title)}</h1>
        <p class="center" style="margin:2px 0 8px">${esc(S.levelText)} · ${esc(S.dateText)}<br>${esc(S.school)}</p>
        <p style="margin:0"><b>คำชี้แจง</b> แบบประเมินฉบับนี้มี 3 ตอน ไม่ต้องระบุชื่อผู้ตอบ ${esc(S.objective)}</p>
        <p class="ph">ตอนที่ 1 ข้อมูลทั่วไป <span style="font-weight:400">โปรดทำเครื่องหมาย ✓ ใน □</span></p>
        ${g.demo.map((f, i) => `<div>${i + 1}. ${esc(f.label)}</div><div class="opts">${f.options.map(box).join('')}</div>`).join('')}
        <p class="ph">ตอนที่ 2 ความพึงพอใจ <span style="font-weight:400">โปรดทำเครื่องหมาย ✓ ในช่องที่ตรงกับความคิดเห็นของท่าน</span></p>
        <table>
          <thead><tr><th rowspan="2" class="c">ข้อ</th><th rowspan="2">รายการประเมิน</th><th colspan="5">ระดับความพึงพอใจ</th></tr>
          <tr>${S.SCALE.map(s => `<th class="c" style="font-weight:400;font-size:12px">${s.v}</th>`).join('')}</tr></thead>
          <tbody>${g.sections.map((sec, si) => `<tr class="secrow"><td colspan="7">${si + 1}. ${esc(sec.name)}</td></tr>` +
            sec.items.map(it => { no++; return `<tr><td class="c">${no}</td><td>${esc(it.text)}</td>${'<td class="c"></td>'.repeat(5)}</tr>`; }).join('')).join('')}
          </tbody>
        </table>
        <p class="xs" style="margin:4px 0 0">5 = มากที่สุด 4 = มาก 3 = ปานกลาง 2 = น้อย 1 = น้อยที่สุด</p>
        <p class="ph">ตอนที่ 3 ความคิดเห็นและข้อเสนอแนะ</p>
        ${g.open.map((o, i) => `<div style="margin-top:6px">${i + 1}. ${esc(o.label)}</div><div class="line"></div><div class="line"></div>`).join('')}
        <p class="center" style="margin-top:14px">ขอขอบคุณที่ให้ความร่วมมือในการตอบแบบประเมิน</p>
      </div>`;
  }

  /* ---------------- เส้นทาง ---------------- */
  let cfgCache = null;
  async function route() {
    const p = params();
    if (p.has('print')) { renderPrint(); return; }
    const s = p.has('s') ? Math.max(0, (parseInt(p.get('s'), 10) || 1) - 1) : null;
    if (s != null && current) { current.showStep(s); return; } // ปุ่มย้อนกลับของมือถือ
    window.scrollTo(0, 0);
    if (!cfgCache) {
      view.innerHTML = '<div class="wrap muted" style="padding:64px 16px;text-align:center">กำลังโหลด... 🌸</div>';
      cfgCache = await withTimeout(SV.getConfig(), 8000).catch(() => ({ open: true }));
    }
    if (cfgCache.open === false) { renderClosed(cfgCache); return; }
    s != null ? renderForm(s) : renderHome();
  }
  route();
})();
