/* หน้าผู้ดูแล: ผลประเมินความพึงพอใจ การประชุมผู้ปกครอง */
(function () {
  const S = window.SURVEY;
  const SV = window.SVStore;
  const { analyze, freq, level, fmt, esc, stats, okv, r2 } = window.SVU;
  const $ = id => document.getElementById(id);
  const g = S.GROUPS.parent;
  const GRADES = S.GRADES, BANDS = S.BANDS;

  let rows = [], cfg = { open: true, target: S.defaultTarget, closedMsg: '' }, user = null;
  let tab = 'overview', grade = 'all', listLimit = 100, unsub = null;
  const DIST_C = { 5: '#DB3F68', 4: '#F7735F', 3: '#FFB59E', 2: '#E7CDD4', 1: '#B9A5AD' };

  /* ---------- ทั่วไป ---------- */
  let toastT;
  function toast(msg, bad) {
    const t = $('toast'); t.textContent = msg; t.style.background = bad ? '#B42318' : '#4A1D2E';
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000);
  }
  const errMsg = e => { const c = (e && e.code) || ''; return c.includes('permission-denied') ? 'ไม่มีสิทธิ์ ตรวจสอบว่าวาง firestore.rules ใหม่แล้ว' : 'ไม่สำเร็จ: ' + ((e && e.message) || e); };
  const pct = (a, b) => b ? (a * 100 / b) : null;
  const lvCls = m => m == null ? '' : 'lv-' + (6 - (S.CRITERIA.findIndex(c => r2(m) >= c.min) + 1 || 5));
  const lvTag = m => m == null ? '–' : `<span class="lv ${lvCls(m)}">${level(m)}</span>`;
  const goalTag = p => p == null ? '–' : p >= cfg.target ? '<span class="lv lv-ok">✓ บรรลุ</span>' : '<span class="lv lv-2">✗ ไม่บรรลุ</span>';
  const XB = 'x̄';
  const thDate = ms => new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
  const thTime = ms => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const thLong = ms => new Date(ms).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' });
  const rowMean = r => { const v = Object.values(r.ans || {}).map(okv).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const allItems = () => g.sections.flatMap(s => s.items);
  const gradeOf = r => (r.demo && r.demo.grade) || '';
  const inGrade = (list, gr) => gr === 'all' ? list : list.filter(r => gradeOf(r) === gr);
  const scopeRows = () => inGrade(rows, grade);
  const who = gr => gr === 'all' ? 'ผู้ปกครองนักเรียน' : `ผู้ปกครองนักเรียนชั้น ${gr}`;
  const fileTag = () => grade === 'all' ? 'ทุกชั้น' : grade.replace('.', '');
  function copyText(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('คัดลอกแล้ว'), () => {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('คัดลอกแล้ว'); } catch (e) { toast('คัดลอกไม่ได้', true); } ta.remove();
    });
  }

  /* ---------- ข้อความสรุป ---------- */
  function summary(a, gr) {
    if (!a.n) return `ยังไม่มี${who(gr)}ตอบแบบประเมิน`;
    const o = a.overall, lvAll = level(o.mean);
    const secs = a.sections.filter(s => s.n).slice().sort((x, y) => y.mean - x.mean);
    const items = a.sections.flatMap(s => s.items).filter(i => i.n).slice().sort((x, y) => y.mean - x.mean);
    const m = x => `(${XB} = ${fmt(x.mean)}, S.D. = ${fmt(x.sd)})`;
    let t = `ผลการประเมินความพึงพอใจของ${who(gr)} จำนวน ${a.n} คน ที่มีต่อ${gr === 'all' ? S.event : 'การประชุมผู้ปกครองนักเรียน วันอาทิตย์ที่ 22 พฤศจิกายน 2569'} พบว่า โดยภาพรวมมีความพึงพอใจอยู่ในระดับ${lvAll} ${m(o)} `;
    if (secs.length > 1) {
      const same = secs.every(s => level(s.mean) === lvAll);
      t += `เมื่อพิจารณาเป็นรายด้าน พบว่า${same ? `อยู่ในระดับ${lvAll}ทุกด้าน โดย` : ''}ด้านที่มีค่าเฉลี่ยสูงสุด คือ ${secs[0].sec.name} ${m(secs[0])}`;
      if (secs.length > 2) t += ` รองลงมา คือ ${secs[1].sec.name} ${m(secs[1])}`;
      t += ` และด้านที่มีค่าเฉลี่ยต่ำสุด คือ ${secs[secs.length - 1].sec.name} ${m(secs[secs.length - 1])} `;
    }
    if (items.length > 1) {
      const top = items[0], low = items[items.length - 1];
      t += `เมื่อพิจารณาเป็นรายข้อ พบว่า ข้อที่มีค่าเฉลี่ยสูงสุด คือ “${top.item.text}” ${m(top)} ส่วนข้อที่มีค่าเฉลี่ยต่ำสุด คือ “${low.item.text}” ${m(low)} ซึ่งควรนำไปปรับปรุงในการจัดประชุมผู้ปกครองครั้งต่อไป `;
    }
    if (a.pctHigh != null) t += `ทั้งนี้ ผู้ปกครองมีความพึงพอใจในระดับมากขึ้นไป ร้อยละ ${fmt(a.pctHigh)} ${a.pctHigh >= cfg.target ? 'ซึ่งเป็นไปตาม' : 'ซึ่งต่ำกว่า'}เป้าหมายที่กำหนดไว้ร้อยละ ${cfg.target}`;
    return t.trim().replace(/\s+/g, ' ');
  }
  function gradeSummary() {
    const an = GRADES.map(gr => ({ gr, a: analyze(g, inGrade(rows, gr)) })).filter(x => x.a.n);
    if (an.length < 2) return '';
    an.sort((x, y) => y.a.overall.mean - x.a.overall.mean);
    const f = x => `ชั้น ${x.gr} (${XB} = ${fmt(x.a.overall.mean)})`;
    return `เมื่อจำแนกตามระดับชั้น พบว่า ผู้ปกครองชั้นที่มีความพึงพอใจสูงสุด คือ ${f(an[0])} และชั้นที่มีความพึงพอใจต่ำสุด คือ ${f(an[an.length - 1])}`;
  }

  /* ---------- ส่วนประกอบแสดงผล ---------- */
  function hbars(list) {
    const ticks = [1, 2, 3, 4, 5].map(v => `<span class="tick" style="left:${v * 20}%"></span>`).join('');
    return list.map(x => `<div class="hbar" title="${esc(x.label)}: ${XB} = ${fmt(x.mean)}">
        <span class="lab">${esc(x.label)}${x.sub ? ` <span class="xs muted">${x.sub}</span>` : ''}</span>
        <span class="trk">${ticks}<span class="bar ${x.strong ? 'g' : ''}" style="display:block;width:${x.mean == null ? 0 : x.mean * 20}%"></span></span>
        <span class="val">${fmt(x.mean)}</span></div>`).join('') +
      `<div class="axis"><span></span><span class="sc"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></span><span></span></div>`;
  }
  const distBar = it => !it.n ? '' : `<div class="dist" title="${[5, 4, 3, 2, 1].map(v => `${v}: ${it.dist[v]} คน`).join(' · ')}">${[5, 4, 3, 2, 1].map(v => it.dist[v] ? `<i style="width:${it.dist[v] * 100 / it.n}%;background:${DIST_C[v]}"></i>` : '').join('')}</div>`;
  const distLegend = () => `<div class="legend">${S.SCALE.map(s => `<span style="--c:${DIST_C[s.v]}">${s.v} ${s.label}</span>`).join('')}</div>`;

  function demoTable(list) {
    return `<table class="t"><thead><tr><th>ข้อมูล</th><th class="n">จำนวน (คน)</th><th class="n">ร้อยละ</th></tr></thead><tbody>
      ${g.demo.filter(f => !(grade !== 'all' && f.id === 'grade')).map(f => {
        const fq = freq(f, list), miss = list.length - fq.answered;
        return `<tr class="sec"><td colspan="3">${esc(f.label)}</td></tr>` +
          f.options.map(o => `<tr><td style="padding-left:22px">${esc(o)}</td><td class="n">${fq.counts[o] || 0}</td><td class="n">${fmt(pct(fq.counts[o] || 0, list.length))}</td></tr>`).join('') +
          (miss > 0 ? `<tr><td style="padding-left:22px" class="muted">ไม่ระบุ</td><td class="n">${miss}</td><td class="n">${fmt(pct(miss, list.length))}</td></tr>` : '');
      }).join('')}
      <tr class="sum"><td>รวมผู้ตอบ</td><td class="n">${list.length}</td><td class="n">100.00</td></tr></tbody></table>`;
  }
  function secTable(a) {
    const ranked = a.sections.filter(s => s.n).slice().sort((x, y) => y.mean - x.mean);
    return `<table class="t"><thead><tr><th>ด้าน</th><th class="n">${XB}</th><th class="n">S.D.</th><th>ระดับ</th><th class="n">อันดับ</th></tr></thead><tbody>
      ${a.sections.map((s, i) => `<tr><td>${i + 1}. ${esc(s.sec.name)}</td><td class="n">${fmt(s.mean)}</td><td class="n">${fmt(s.sd)}</td><td>${lvTag(s.mean)}</td><td class="n">${s.n ? ranked.indexOf(s) + 1 : '–'}</td></tr>`).join('')}
      <tr class="sum"><td>รวมทุกด้าน</td><td class="n">${fmt(a.overall.mean)}</td><td class="n">${fmt(a.overall.sd)}</td><td>${lvTag(a.overall.mean)}</td><td></td></tr></tbody></table>`;
  }
  function itemTable(a) {
    let no = 0;
    return `<table class="t"><thead><tr><th class="c">ข้อ</th><th>รายการประเมิน</th><th class="hs" style="min-width:110px">การกระจาย</th>${[5, 4, 3, 2, 1].map(v => `<th class="n hs">${v}</th>`).join('')}<th class="n">${XB}</th><th class="n">S.D.</th><th>ระดับ</th></tr></thead><tbody>
      ${a.sections.map((s, si) => `<tr class="sec"><td></td><td>${si + 1}. ${esc(s.sec.name)}</td><td class="hs" colspan="6"></td><td class="n">${fmt(s.mean)}</td><td class="n">${fmt(s.sd)}</td><td>${lvTag(s.mean)}</td></tr>` +
        s.items.map(it => { no++; return `<tr><td class="c">${no}</td><td>${esc(it.item.text)}</td><td class="hs">${distBar(it)}</td>${[5, 4, 3, 2, 1].map(v => `<td class="n hs">${it.dist[v]}</td>`).join('')}<td class="n"><b>${fmt(it.mean)}</b></td><td class="n">${fmt(it.sd)}</td><td>${lvTag(it.mean)}</td></tr>`; }).join('')).join('')}
      <tr class="sum"><td></td><td>รวม</td><td class="hs" colspan="6"></td><td class="n">${fmt(a.overall.mean)}</td><td class="n">${fmt(a.overall.sd)}</td><td>${lvTag(a.overall.mean)}</td></tr>
      </tbody></table>`;
  }

  /* ---------- แท็บ ---------- */
  const TABS = [
    { id: 'overview', label: 'ภาพรวม' },
    { id: 'grades', label: 'เทียบรายชั้น' },
    { id: 'open', label: 'ข้อเสนอแนะ' },
    { id: 'list', label: 'รายการคำตอบ' },
    { id: 'settings', label: 'ลิงก์ · QR · ตั้งค่า' }
  ];
  function renderTabs() {
    $('tabs').innerHTML = TABS.map(t => `<button class="tab" role="tab" data-tab="${t.id}" aria-selected="${tab === t.id}">${t.label}</button>`).join('');
    const sel = $('gradeSel');
    const opts = [['all', `ทุกระดับชั้น (${rows.length})`]].concat(GRADES.map(gr => [gr, `ชั้น ${gr} (${inGrade(rows, gr).length})`]));
    sel.innerHTML = opts.map(([v, l]) => `<option value="${v}" ${v === grade ? 'selected' : ''}>${l}</option>`).join('');
    sel.closest('label').style.display = (tab === 'grades' || tab === 'settings') ? 'none' : 'flex';
    $('printHint').textContent = grade === 'all' ? 'รายงานรวมทุกระดับชั้น (เลือกชั้นด้านบนเพื่อพิมพ์รายงานรายชั้น)' : `รายงานเฉพาะชั้น ${grade}`;
  }
  function renderTiles() {
    const list = scopeRows(), a = analyze(g, list);
    const tile = (k, v, s) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`;
    const gradesWith = GRADES.filter(gr => inGrade(rows, gr).length).length;
    $('tiles').innerHTML =
      tile(grade === 'all' ? 'ผู้ตอบทั้งหมด' : `ผู้ตอบ ชั้น ${esc(grade)}`, a.n, a.n ? 'คน' : 'ยังไม่มีผู้ตอบ') +
      tile('ค่าเฉลี่ยภาพรวม', fmt(a.overall.mean), a.n ? `ระดับ${level(a.overall.mean)} · S.D. ${fmt(a.overall.sd)}` : '–') +
      tile('พึงพอใจระดับมากขึ้นไป', a.pctHigh == null ? '–' : fmt(a.pctHigh, 1) + '%', `เป้าหมาย ${cfg.target}% ${a.pctHigh == null ? '' : a.pctHigh >= cfg.target ? '✓' : '✗'}`) +
      tile('ระดับชั้นที่มีผู้ตอบ', `${gradesWith}/${GRADES.length}`, 'อนุบาล – ม.3');
    $('statusChip').innerHTML = cfg.open
      ? '<span class="lv lv-ok">● เปิดรับแบบประเมินอยู่</span>'
      : '<span class="lv lv-2">● ปิดรับแบบประเมินแล้ว</span>';
  }

  function panelOverview() {
    const list = scopeRows(), a = analyze(g, list);
    if (!a.n) return `<div class="card done-box"><div class="big">🌷</div><h2 style="margin-top:10px">ยังไม่มี${esc(who(grade))}ตอบแบบประเมิน</h2><p class="muted">ส่งลิงก์หรือ QR Code จากแท็บ “ลิงก์ · QR · ตั้งค่า”</p></div>`;
    const extra = grade === 'all' ? gradeSummary() : '';
    return `<div class="card">
        <div class="row"><h2 style="font-size:20px">สรุปผล: ${esc(who(grade))}</h2><button class="btn btn-soft btn-sm sp-auto" data-copy="sum">คัดลอกข้อความ</button></div>
        <p class="summary-text" style="margin-top:10px" id="txt-sum">${esc(summary(a, grade) + (extra ? ' ' + extra : ''))}</p>
      </div>
      <div class="g2" style="margin-top:14px">
        <div class="card"><h2 style="font-size:19px">ข้อมูลทั่วไปของผู้ตอบ</h2><div class="tbl-wrap" style="margin-top:8px">${demoTable(list)}</div></div>
        <div class="card"><h2 style="font-size:19px">ความพึงพอใจรายด้าน</h2><div class="tbl-wrap" style="margin-top:8px">${secTable(a)}</div>
          <div style="margin-top:14px">${hbars(a.sections.map(s => ({ label: s.sec.name, mean: s.mean })).concat([{ label: 'ภาพรวม', mean: a.overall.mean, strong: true }]))}</div>
          ${criteria()}
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="row"><h2 style="font-size:19px">ความพึงพอใจรายข้อ</h2><span class="sp-auto hs">${distLegend()}</span></div>
        <div class="tbl-wrap" style="margin-top:8px">${itemTable(a)}</div>
        <p class="xs muted" style="margin:6px 0 0">ตัวเลขในช่อง 5–1 คือจำนวนผู้ตอบในแต่ละระดับ (ดูครบทุกคอลัมน์ได้บนคอมพิวเตอร์)</p>
      </div>`;
  }
  const criteria = () => `<h3 style="font-size:16px;margin-top:16px">เกณฑ์แปลความหมายค่าเฉลี่ย</h3>
    <div class="selrow" style="margin-top:6px">${S.CRITERIA.map(c => `<span class="lv ${lvCls(c.min)}">${c.min.toFixed(2)}–${c.max.toFixed(2)} ${c.label}</span>`).join('')}</div>
    <p class="xs muted" style="margin:6px 0 0">บุญชม ศรีสะอาด (2545) · S.D. แบบกลุ่มตัวอย่าง (n−1) · ร้อยละพึงพอใจระดับมากขึ้นไป = ผู้ตอบที่มีค่าเฉลี่ยรายบุคคล ≥ 3.51</p>`;

  function gradeRows() { return GRADES.map(gr => ({ gr, a: analyze(g, inGrade(rows, gr)) })); }
  function panelGrades() {
    const gs = gradeRows(), tot = analyze(g, rows);
    const bands = Object.keys(BANDS).map(b => ({ b, a: analyze(g, rows.filter(r => BANDS[b].includes(gradeOf(r)))) }));
    return `<div class="card">
        <h2 style="font-size:20px">ผลการประเมินจำแนกตามระดับชั้น</h2>
        <p class="xs muted" style="margin:2px 0 0">แตะที่แถวเพื่อดูผลละเอียดของชั้นนั้น</p>
        <div class="tbl-wrap" style="margin-top:8px"><table class="t"><thead><tr><th>ระดับชั้น</th><th class="n">ผู้ตอบ</th><th class="n">${XB}</th><th class="n">S.D.</th><th>ระดับ</th><th class="n">ร้อยละ<br>มากขึ้นไป</th><th class="hs">เป้าหมาย ${cfg.target}%</th>${g.sections.map((s, i) => `<th class="n hs" title="${esc(s.name)}">ด้าน ${i + 1}</th>`).join('')}</tr></thead><tbody>
        ${gs.map(({ gr, a }) => `<tr class="clickable" data-pick="${gr}"><td><b>${gr}</b></td><td class="n">${a.n}</td><td class="n">${fmt(a.overall.mean)}</td><td class="n">${fmt(a.overall.sd)}</td><td>${lvTag(a.overall.mean)}</td><td class="n">${fmt(a.pctHigh)}</td><td class="hs">${goalTag(a.pctHigh)}</td>${a.sections.map(s => `<td class="n hs">${fmt(s.mean)}</td>`).join('')}</tr>`).join('')}
        <tr class="sum"><td>รวมทุกชั้น</td><td class="n">${tot.n}</td><td class="n">${fmt(tot.overall.mean)}</td><td class="n">${fmt(tot.overall.sd)}</td><td>${lvTag(tot.overall.mean)}</td><td class="n">${fmt(tot.pctHigh)}</td><td class="hs">${goalTag(tot.pctHigh)}</td>${tot.sections.map(s => `<td class="n hs">${fmt(s.mean)}</td>`).join('')}</tr>
        </tbody></table></div>
        <p class="xs muted hs" style="margin:6px 0 0">${g.sections.map((s, i) => `ด้าน ${i + 1} = ${esc(s.name)}`).join(' · ')}</p>
      </div>
      <div class="g2" style="margin-top:14px">
        <div class="card"><h2 style="font-size:19px">ค่าเฉลี่ยภาพรวมรายชั้น (เต็ม 5)</h2>
          <div style="margin-top:10px">${hbars(gs.map(({ gr, a }) => ({ label: gr, sub: a.n ? `n=${a.n}` : '', mean: a.overall.mean })).concat([{ label: 'รวมทุกชั้น', mean: tot.overall.mean, strong: true }]))}</div></div>
        <div class="card"><h2 style="font-size:19px">เปรียบเทียบตามช่วงชั้น</h2>
          <div class="tbl-wrap" style="margin-top:8px"><table class="t"><thead><tr><th>ด้าน</th>${bands.map(x => `<th class="n">${x.b}<br><span class="xs muted">n = ${x.a.n}</span></th>`).join('')}</tr></thead><tbody>
          ${g.sections.map((s, si) => `<tr><td>${si + 1}. ${esc(s.name)}</td>${bands.map(x => `<td class="n">${fmt(x.a.sections[si].mean)}</td>`).join('')}</tr>`).join('')}
          <tr class="sum"><td>รวม</td>${bands.map(x => `<td class="n">${fmt(x.a.overall.mean)}</td>`).join('')}</tr></tbody></table></div>
          <p class="xs muted" style="margin:6px 0 0">ค่าในตารางคือค่าเฉลี่ย (${XB})</p></div>
      </div>`;
  }

  function openAnswers(list) {
    return g.open.map(o => {
      const m = new Map();
      list.forEach(r => {
        const v = (r.text && r.text[o.id] || '').trim();
        if (!v || /^[-–.\s]*$|^(ไม่มี|ไม่มีครับ|ไม่มีค่ะ|ไม่มีคะ|-)$/.test(v)) return;
        const k = v.replace(/\s+/g, ' ');
        const e = m.get(k) || { n: 0, grades: new Set() };
        e.n++; if (gradeOf(r)) e.grades.add(gradeOf(r)); m.set(k, e);
      });
      return { o, arr: [...m.entries()].sort((a, b) => b[1].n - a[1].n) };
    });
  }
  function panelOpen() {
    const blocks = openAnswers(scopeRows());
    return `<div class="card"><h2 style="font-size:20px">ความคิดเห็นของ${esc(who(grade))}</h2>
      ${blocks.map((b, bi) => `<div style="margin-top:16px"><div class="row"><h3 style="font-size:17px">${esc(b.o.label)} <span class="cnt">${b.arr.length}</span></h3>
        ${b.arr.length ? `<button class="btn btn-soft btn-sm sp-auto" data-copyopen="${bi}">คัดลอกรายการ</button>` : ''}</div>
        ${b.arr.length ? `<ul class="oplist" style="margin-top:4px">${b.arr.map(([t, e]) => `<li>${esc(t)}${e.n > 1 ? ` <span class="cnt" title="ตอบซ้ำ ${e.n} คน">${e.n}</span>` : ''}${grade === 'all' && e.grades.size ? `<span class="meta">${[...e.grades].join(', ')}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted small" style="margin:4px 0">ยังไม่มีความคิดเห็น</p>'}
      </div>`).join('')}</div>`;
  }

  function panelList() {
    const list = scopeRows().slice().sort((a, b) => b.at - a.at);
    return `<div class="card">
      <div class="row"><h2 style="font-size:19px">คำตอบ${grade === 'all' ? 'ทั้งหมด' : ' ชั้น ' + esc(grade)}</h2><span class="sp-auto small muted">${list.length} รายการ</span></div>
      <p class="xs muted" style="margin:4px 0 0">ลบได้เฉพาะคำตอบที่ผิดปกติ เช่น คำตอบทดสอบ หรือส่งซ้ำ (กดลบ 2 ครั้งเพื่อยืนยัน)</p>
      <div class="tbl-wrap" style="margin-top:8px"><table class="t"><thead><tr><th>วันเวลา</th><th>ชั้น</th><th class="hs">ผู้ตอบ</th><th class="n">${XB}</th><th class="hs">ความคิดเห็น</th><th></th></tr></thead><tbody>
      ${list.slice(0, listLimit).map(r => { const d = r.demo || {}; const txt = Object.values(r.text || {}).join(' / '); return `<tr>
        <td class="n" style="text-align:left">${thDate(r.at)} ${thTime(r.at)}</td><td>${esc(d.grade || '–')}</td><td class="small hs">${esc([d.relation, d.gender, d.age].filter(Boolean).join(' · '))}</td>
        <td class="n">${fmt(rowMean(r))}</td><td class="small hs" style="max-width:320px">${esc(txt.length > 120 ? txt.slice(0, 120) + '…' : txt)}</td>
        <td><button class="btn btn-danger btn-sm" data-del="${r.id}">ลบ</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีคำตอบ</td></tr>'}
      </tbody></table></div>
      ${list.length > listLimit ? `<button class="btn btn-soft" style="margin-top:10px" id="moreBtn">แสดงเพิ่ม (${list.length - listLimit})</button>` : ''}
    </div>`;
  }

  const surveyUrl = q => { const u = new URL('index.html', location.href); u.search = q || ''; u.hash = ''; const out = u.toString(); return location.protocol === 'file:' ? out : out.replace(/index\.html(\?|$)/, '$1'); };
  function panelSettings() {
    const main = surveyUrl('');
    return `<div class="card">
        <h2 style="font-size:20px">ลิงก์หลักสำหรับผู้ปกครองทุกระดับชั้น</h2>
        <div class="linkbox" style="margin-top:10px"><div class="qr" data-qr="${esc(main)}">QR</div>
          <div><div class="url">${esc(main)}</div>
          <div class="row" style="margin-top:8px"><button class="btn btn-soft btn-sm" data-copyurl="${esc(main)}">คัดลอกลิงก์</button><a class="btn btn-soft btn-sm" href="${esc(main)}" target="_blank">เปิด</a>
          <a class="btn btn-soft btn-sm" href="${esc(surveyUrl('?print=1'))}" target="_blank">ฉบับพิมพ์กระดาษ</a></div>
          <p class="xs muted" style="margin:8px 0 0">คลิกขวา (หรือกดค้างบนมือถือ) ที่ QR Code เพื่อบันทึกรูป แล้วส่งในกลุ่ม LINE หรือพิมพ์ติดหน้าห้องประชุม</p></div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2 style="font-size:20px">QR Code แยกระดับชั้น</h2>
        <p class="small muted" style="margin:2px 0 0">ผู้ปกครองสแกนแล้ว ระบบเลือกระดับชั้นให้อัตโนมัติ เหมาะสำหรับครูประจำชั้นแสดงในห้องประชุมของตนเอง</p>
        <button class="btn btn-primary btn-sm" id="qrPrintBtn" style="margin-top:10px">🖨️ พิมพ์แผ่น QR ติดห้องประชุม (ทุกชั้น)</button>
        <div class="qrgrid">${GRADES.map(gr => { const u = surveyUrl('?c=' + S.GRADE_CODE[gr]); return `<div class="qrcard"><div class="qr" data-qr="${esc(u)}">QR</div><b>${gr}</b>
          <div class="row"><button class="btn btn-soft btn-sm" data-copyurl="${esc(u)}">คัดลอก</button><a class="btn btn-soft btn-sm" href="${esc(u)}" target="_blank">เปิด</a></div></div>`; }).join('')}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2 style="font-size:20px">การรับแบบประเมิน</h2>
        <div class="row" style="margin-top:10px"><label class="switch"><input type="checkbox" id="openSw" ${cfg.open ? 'checked' : ''}> <span id="openLbl">${cfg.open ? 'เปิดรับแบบประเมิน' : 'ปิดรับแบบประเมิน'}</span></label></div>
        <label class="block" style="margin-top:12px"><span class="lbl small">ข้อความเมื่อปิดรับ</span><input class="field" id="closedMsg" maxlength="160" value="${esc(cfg.closedMsg)}" placeholder="ขอขอบคุณผู้ปกครองทุกท่านที่ให้ความร่วมมือ"></label>
        <label class="block" style="margin-top:12px;max-width:340px"><span class="lbl small">เป้าหมายร้อยละผู้พึงพอใจระดับมากขึ้นไป (ตามตัวชี้วัดโครงการ)</span><input class="field" id="target" type="number" min="1" max="100" value="${cfg.target}"></label>
        <button class="btn btn-primary" style="margin-top:12px" id="saveCfg">บันทึกการตั้งค่า</button>
      </div>
      <div class="card" style="margin-top:14px">
        <h2 style="font-size:20px">ดาวน์โหลดข้อมูล (CSV)</h2>
        <p class="small muted" style="margin:4px 0 0">เปิดด้วย Excel หรือ Google Sheets ได้ทันที ภาษาไทยไม่เพี้ยน</p>
        <div class="row" style="margin-top:10px"><button class="btn btn-soft" data-csv="raw">ข้อมูลดิบทุกคำตอบ</button><button class="btn btn-soft" data-csv="grades">สรุปรายชั้น</button><button class="btn btn-primary" data-csv="summary">ตารางสรุปรายข้อ</button></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2 style="font-size:20px">ลบคำตอบทั้งหมด</h2>
        <p class="small muted" style="margin:4px 0 0">ใช้หลังทดลองระบบเสร็จ ก่อนเปิดให้ตอบจริง ย้อนกลับไม่ได้ (แนะนำให้ดาวน์โหลดข้อมูลเก็บไว้ก่อน)</p>
        <label class="block small" style="margin-top:10px">พิมพ์คำว่า <b>ลบทั้งหมด</b> เพื่อยืนยัน<input class="field" id="wipeConfirm" style="max-width:260px;margin-top:4px;display:block"></label>
        <button class="btn btn-danger" id="wipeBtn" style="margin-top:10px" disabled>ลบคำตอบทั้งหมด (${rows.length})</button>
      </div>`;
  }

  /* ---------- QR ---------- */
  let qrLib = null;
  function loadQr() {
    if (qrLib) return qrLib;
    qrLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/qrcode.js'; s.onload = () => res(window.qrcode); s.onerror = rej; document.head.appendChild(s); });
    return qrLib;
  }
  function drawQrs() {
    const els = document.querySelectorAll('[data-qr]'); if (!els.length) return;
    loadQr().then(qrcode => els.forEach(el => {
      const q = qrcode(0, 'M'); q.addData(unescape(encodeURIComponent(el.dataset.qr))); q.make();
      el.innerHTML = q.createImgTag(6, 12, 'QR Code แบบประเมิน');
    })).catch(() => els.forEach(el => el.textContent = 'โหลด QR ไม่ได้'));
  }

  /* ---------- CSV ---------- */
  function download(name, text) {
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvCell = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = arr => arr.map(r => r.map(csvCell).join(',')).join('\r\n');
  function exportCsv(kind) {
    if (kind === 'summary') {
      const a = analyze(g, rows); const out = [['ด้าน', 'ข้อ', 'รายการ', 'n', 'ระดับ5', 'ระดับ4', 'ระดับ3', 'ระดับ2', 'ระดับ1', 'ค่าเฉลี่ย', 'S.D.', 'แปลผล']];
      let no = 0;
      a.sections.forEach(s => {
        s.items.forEach(it => { no++; out.push([s.sec.name, no, it.item.text, it.n, it.dist[5], it.dist[4], it.dist[3], it.dist[2], it.dist[1], fmt(it.mean), fmt(it.sd), level(it.mean)]); });
        out.push([s.sec.name, '', 'รวมด้าน', s.n, '', '', '', '', '', fmt(s.mean), fmt(s.sd), level(s.mean)]);
      });
      out.push(['รวมทุกด้าน', '', `ผู้ตอบ ${a.n} คน`, a.overall.n, '', '', '', '', '', fmt(a.overall.mean), fmt(a.overall.sd), level(a.overall.mean)]);
      download('สรุปรายข้อ_ประชุมผู้ปกครอง2569.csv', csv(out)); return;
    }
    if (kind === 'grades') {
      const out = [['ระดับชั้น', 'จำนวนผู้ตอบ', ...g.sections.map(s => s.name), 'ค่าเฉลี่ยรวม', 'S.D.', 'แปลผล', 'ร้อยละพึงพอใจมากขึ้นไป']];
      gradeRows().concat([{ gr: 'รวมทุกชั้น', a: analyze(g, rows) }]).forEach(({ gr, a }) => out.push([gr, a.n, ...a.sections.map(s => fmt(s.mean)), fmt(a.overall.mean), fmt(a.overall.sd), a.n ? level(a.overall.mean) : '', fmt(a.pctHigh)]));
      download('สรุปรายชั้น_ประชุมผู้ปกครอง2569.csv', csv(out)); return;
    }
    const list = rows.slice().sort((a, b) => a.at - b.at), items = allItems();
    const head = ['ลำดับ', 'วันที่', 'เวลา', ...g.demo.map(f => f.label), ...items.map((it, i) => `ข้อ${i + 1} ${it.text}`), 'ค่าเฉลี่ยรายบุคคล', ...g.open.map(o => o.label)];
    const out = [head].concat(list.map((r, i) => [i + 1, thDate(r.at), thTime(r.at),
      ...g.demo.map(f => { const v = r.demo && r.demo[f.id]; return Array.isArray(v) ? v.join(' | ') : (v || ''); }),
      ...items.map(it => (r.ans && r.ans[it.id]) || ''), fmt(rowMean(r)), ...g.open.map(o => (r.text && r.text[o.id]) || '')]));
    download('ข้อมูลดิบ_ประชุมผู้ปกครอง2569.csv', csv(out));
  }

  /* ---------- รายงานพิมพ์ ---------- */
  function buildReport() {
    const list = scopeRows(), a = analyze(g, list);
    let tno = 0;
    const cap = t => `<p class="cap">ตารางที่ ${++tno} ${t}</p>`;
    const L = m => m == null ? '–' : level(m);
    const fields = g.demo.filter(f => !(grade !== 'all' && f.id === 'grade'));
    let no = 0;
    const gradeTable = () => {
      const gs = gradeRows(), tot = analyze(g, rows);
      return `${cap('ผลการประเมินความพึงพอใจ จำแนกตามระดับชั้น')}
        <table><thead><tr><th>ระดับชั้น</th><th>จำนวน (คน)</th><th>${XB}</th><th>S.D.</th><th>ระดับ</th><th>ร้อยละพึงพอใจ<br>ระดับมากขึ้นไป</th></tr></thead><tbody>
        ${gs.map(({ gr, a: x }) => `<tr><td>${gr}</td><td class="n">${x.n}</td><td class="n">${fmt(x.overall.mean)}</td><td class="n">${fmt(x.overall.sd)}</td><td class="n">${L(x.overall.mean)}</td><td class="n">${fmt(x.pctHigh)}</td></tr>`).join('')}
        <tr class="sum"><td class="n">รวม</td><td class="n">${tot.n}</td><td class="n">${fmt(tot.overall.mean)}</td><td class="n">${fmt(tot.overall.sd)}</td><td class="n">${L(tot.overall.mean)}</td><td class="n">${fmt(tot.pctHigh)}</td></tr></tbody></table>
        ${gradeSummary() ? `<p class="indent">${esc(gradeSummary())}</p>` : ''}`;
    };
    const rk = a.sections.filter(s => s.n).slice().sort((x, y) => y.mean - x.mean);
    $('report').innerHTML = `<div class="rpt">
      <div style="text-align:center"><img src="assets/logo.png" alt="" style="width:60px"></div>
      <h1>รายงานผลการประเมินความพึงพอใจ<br>การประชุมผู้ปกครองนักเรียน${grade === 'all' ? ' ระดับชั้นอนุบาล – มัธยมศึกษาปีที่ 3' : ' ชั้น ' + esc(grade)}</h1>
      <p style="text-align:center">${esc(S.dateText)} · ${esc(S.school)}<br>ข้อมูล ณ วันที่ ${thLong(Date.now())}</p>
      <h2>1. วิธีการประเมิน</h2>
      <p class="indent">เก็บรวบรวมข้อมูลจากผู้ปกครองนักเรียนที่เข้าร่วมประชุม ด้วยแบบประเมินความพึงพอใจออนไลน์และฉบับกระดาษ ซึ่งเป็นแบบมาตราส่วนประมาณค่า 5 ระดับ จำนวน ${allItems().length} ข้อ ${g.sections.length} ด้าน วิเคราะห์ข้อมูลด้วยค่าความถี่ ร้อยละ ค่าเฉลี่ย (${XB}) และส่วนเบี่ยงเบนมาตรฐาน (S.D.) แปลความหมายค่าเฉลี่ยตามเกณฑ์ของบุญชม ศรีสะอาด (2545) ดังนี้</p>
      <table style="width:60%;margin-left:auto;margin-right:auto"><tbody>${S.CRITERIA.map(c => `<tr><td class="n">${c.min.toFixed(2)} – ${c.max.toFixed(2)}</td><td>มีความพึงพอใจระดับ${c.label}</td></tr>`).join('')}</tbody></table>
      <h2>2. ข้อมูลทั่วไปของผู้ตอบแบบประเมิน</h2>
      ${cap(`จำนวนและร้อยละของ${who(grade)}ที่ตอบแบบประเมิน จำแนกตามข้อมูลทั่วไป`)}
      <table><thead><tr><th>ข้อมูลทั่วไป</th><th style="width:22%">จำนวน (คน)</th><th style="width:18%">ร้อยละ</th></tr></thead><tbody>
      ${fields.map(f => { const fq = freq(f, list), miss = list.length - fq.answered; return `<tr class="sec"><td colspan="3">${esc(f.label)}</td></tr>` +
        f.options.map(o => `<tr><td style="padding-left:18px">${esc(o)}</td><td class="n">${fq.counts[o] || 0}</td><td class="n">${fmt(pct(fq.counts[o] || 0, list.length))}</td></tr>`).join('') +
        (miss > 0 ? `<tr><td style="padding-left:18px">ไม่ระบุ</td><td class="n">${miss}</td><td class="n">${fmt(pct(miss, list.length))}</td></tr>` : ''); }).join('')}
      <tr class="sum"><td>รวม</td><td class="n">${list.length}</td><td class="n">100.00</td></tr></tbody></table>
      <h2 class="pb">3. ผลการประเมินความพึงพอใจ</h2>
      ${cap(`ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานความพึงพอใจของ${who(grade)} จำแนกรายด้าน`)}
      <table><thead><tr><th>รายการประเมิน</th><th style="width:11%">${XB}</th><th style="width:11%">S.D.</th><th style="width:17%">ระดับ</th><th style="width:10%">อันดับ</th></tr></thead><tbody>
      ${a.sections.map((s, i) => `<tr><td>${i + 1}. ${esc(s.sec.name)}</td><td class="n">${fmt(s.mean)}</td><td class="n">${fmt(s.sd)}</td><td class="n">${L(s.mean)}</td><td class="n">${s.n ? rk.indexOf(s) + 1 : '–'}</td></tr>`).join('')}
      <tr class="sum"><td class="n">รวม</td><td class="n">${fmt(a.overall.mean)}</td><td class="n">${fmt(a.overall.sd)}</td><td class="n">${L(a.overall.mean)}</td><td></td></tr></tbody></table>
      ${cap(`ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานความพึงพอใจของ${who(grade)} จำแนกรายข้อ`)}
      <table><thead><tr><th style="width:7%">ข้อ</th><th>รายการประเมิน</th><th style="width:10%">${XB}</th><th style="width:10%">S.D.</th><th style="width:15%">ระดับ</th></tr></thead><tbody>
      ${a.sections.map((s, si) => `<tr class="sec"><td colspan="2">ด้านที่ ${si + 1} ${esc(s.sec.name)}</td><td class="n">${fmt(s.mean)}</td><td class="n">${fmt(s.sd)}</td><td class="n">${L(s.mean)}</td></tr>` +
        s.items.map(it => { no++; return `<tr><td class="n">${no}</td><td>${esc(it.item.text)}</td><td class="n">${fmt(it.mean)}</td><td class="n">${fmt(it.sd)}</td><td class="n">${L(it.mean)}</td></tr>`; }).join('')).join('')}
      <tr class="sum"><td colspan="2" class="n">รวม</td><td class="n">${fmt(a.overall.mean)}</td><td class="n">${fmt(a.overall.sd)}</td><td class="n">${L(a.overall.mean)}</td></tr></tbody></table>
      <p class="indent">จากตารางที่ ${tno - 1}–${tno} ${esc(summary(a, grade))}</p>
      ${grade === 'all' ? gradeTable() : ''}
      <h2>4. ความคิดเห็นและข้อเสนอแนะ</h2>
      ${openAnswers(list).map(b => `<p class="cap" style="font-weight:600">${esc(b.o.label)}</p>${b.arr.length ? `<ol>${b.arr.map(([t, e]) => `<li>${esc(t)}${e.n > 1 ? ` (${e.n} คน)` : ''}</li>`).join('')}</ol>` : '<p style="padding-left:2em">– ไม่มี –</p>'}`).join('')}
      <p style="margin-top:28px;text-align:right">ลงชื่อ ......................................................... ผู้รายงาน<br>(.........................................................)<br>ตำแหน่ง .........................................................</p>
      <p class="rpt-credit">รายงานจากระบบประเมินความพึงพอใจออนไลน์ · พัฒนาโดย ${esc(S.developer)}</p>
    </div>`;
  }
  function buildQrSheet() {
    const items = [{ gr: '', u: surveyUrl('') }].concat(GRADES.map(gr => ({ gr, u: surveyUrl('?c=' + S.GRADE_CODE[gr]) })));
    $('report').innerHTML = `<div class="qrsheet">${items.map(x => `<div class="qrs">
        <div><div class="sc">${esc(S.school)}</div>
          <h2>แบบประเมินความพึงพอใจ<br>การประชุมผู้ปกครองนักเรียน</h2>
          <div class="gr">${x.gr ? 'ชั้น ' + esc(x.gr) : 'ทุกระดับชั้น'}</div>
          <p>📱 สแกน QR Code ด้วยกล้องมือถือหรือ LINE<br>ใช้เวลาประมาณ 3–4 นาที ไม่ต้องระบุชื่อ</p>
          <p style="font-size:14px;color:#8A6470">${esc(S.dateText)}</p>
          <p style="font-size:12px;color:#B08A96;margin-top:6px">พัฒนาโดย ${esc(S.developer)}</p></div>
        <div><div class="q" data-qr="${esc(x.u)}"></div><div class="u">${esc(x.u)}</div></div>
      </div>`).join('')}</div>`;
    return loadQr().then(qrcode => $('report').querySelectorAll('[data-qr]').forEach(el => {
      const q = qrcode(0, 'M'); q.addData(unescape(encodeURIComponent(el.dataset.qr))); q.make();
      el.innerHTML = q.createImgTag(8, 0, 'QR Code');
    }));
  }
  function printNow() {
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    const imgs = [...$('report').querySelectorAll('img')];
    Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 150));
  }
  function printReport() {
    buildReport();
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    const imgs = [...$('report').querySelectorAll('img')];
    Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 100));
  }

  /* ---------- วาดหน้า ---------- */
  function render() {
    if (!user) return;
    renderTiles(); renderTabs();
    const p = $('panel'), keepY = window.scrollY;
    if (tab === 'overview') p.innerHTML = panelOverview();
    else if (tab === 'grades') p.innerHTML = panelGrades();
    else if (tab === 'open') p.innerHTML = panelOpen();
    else if (tab === 'list') p.innerHTML = panelList();
    else if (tab === 'settings') { p.innerHTML = panelSettings(); drawQrs(); }
    window.scrollTo(0, keepY);
  }
  function renderSoft() { // ไม่วาดหน้าตั้งค่าใหม่ขณะพิมพ์
    if (tab === 'settings') { renderTiles(); renderTabs(); const w = $('wipeBtn'); if (w) w.textContent = `ลบคำตอบทั้งหมด (${rows.length})`; return; }
    render();
  }

  document.addEventListener('click', async e => {
    const tr = e.target.closest('tr[data-pick]');
    if (tr) { grade = tr.dataset.pick; tab = 'overview'; render(); window.scrollTo({ top: 0 }); return; }
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
    if (t.dataset.copy) { copyText($('txt-' + t.dataset.copy).textContent); return; }
    if (t.dataset.copyurl) { copyText(t.dataset.copyurl); return; }
    if (t.dataset.copyopen) { const b = openAnswers(scopeRows())[+t.dataset.copyopen]; copyText(b.arr.map(([x, en], i) => `${i + 1}. ${x}${en.n > 1 ? ` (${en.n} คน)` : ''}`).join('\n')); return; }
    if (t.id === 'moreBtn') { listLimit += 100; render(); return; }
    if (t.dataset.csv) { exportCsv(t.dataset.csv); return; }
    if (t.dataset.del) {
      if (!t.classList.contains('armed')) { t.classList.add('armed'); t.textContent = 'ยืนยันลบ'; setTimeout(() => { t.classList.remove('armed'); t.textContent = 'ลบ'; }, 3000); return; }
      t.disabled = true;
      try { await SV.remove(t.dataset.del); toast('ลบแล้ว'); } catch (err) { toast(errMsg(err), true); t.disabled = false; }
      return;
    }
    if (t.id === 'saveCfg') {
      const target = Math.min(100, Math.max(1, Number($('target').value) || S.defaultTarget));
      try { await SV.setConfig({ open: $('openSw').checked, target, closedMsg: $('closedMsg').value.trim() }); toast('บันทึกการตั้งค่าแล้ว'); } catch (err) { toast(errMsg(err), true); }
      return;
    }
    if (t.id === 'wipeBtn') {
      t.disabled = true;
      try { await SV.removeAll(rows.map(r => r.id)); toast('ลบคำตอบทั้งหมดแล้ว'); $('wipeConfirm').value = ''; } catch (err) { toast(errMsg(err), true); }
      return;
    }
    if (t.id === 'printBtn') { printReport(); return; }
    if (t.id === 'qrPrintBtn') { buildQrSheet().then(printNow, () => toast('โหลด QR ไม่ได้', true)); return; }
    if (t.id === 'logoutBtn' || t.hasAttribute('data-logout')) { await SV.signOut(); return; }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'wipeConfirm') $('wipeBtn').disabled = e.target.value.trim() !== 'ลบทั้งหมด' || !rows.length;
  });
  document.addEventListener('change', async e => {
    if (e.target.id === 'gradeSel') { grade = e.target.value; listLimit = 100; render(); return; }
    if (e.target.id === 'openSw') {
      $('openLbl').textContent = e.target.checked ? 'เปิดรับแบบประเมิน' : 'ปิดรับแบบประเมิน';
      try { await SV.setConfig({ open: e.target.checked }); toast(e.target.checked ? 'เปิดรับแบบประเมินแล้ว' : 'ปิดรับแบบประเมินแล้ว'); } catch (err) { toast(errMsg(err), true); e.target.checked = !e.target.checked; }
    }
  });

  /* ---------- เข้าสู่ระบบ ---------- */
  function show(v) { ['loginView', 'denyView', 'appView'].forEach(x => $(x).classList.toggle('hidden', x !== v)); $('logoutBtn').classList.toggle('hidden', !user || SV.isDemo); }
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('loginBtn'); btn.disabled = true; $('loginError').textContent = '';
    try { await SV.signIn($('email').value.trim(), $('password').value); }
    catch (err) {
      const c = (err && err.code) || '';
      $('loginError').textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : c.includes('too-many') ? 'ลองหลายครั้งเกินไป รอสักครู่' : 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต';
    } finally { btn.disabled = false; }
  });

  if (SV.isDemo) $('demoBanner').classList.remove('hidden');
  SV.watchConfig(c => { cfg = c; if (user) renderSoft(); });
  SV.onAuth(u => {
    if (unsub) { unsub(); unsub = null; }
    if (!u) { user = null; show('loginView'); return; }
    if (!SV.isAdmin(u)) { user = null; $('denyEmail').textContent = u.email; show('denyView'); $('logoutBtn').classList.remove('hidden'); return; }
    user = u; show('appView'); render();
    unsub = SV.watchResponses(list => { rows = list.filter(r => r.group === 'parent'); renderSoft(); }, err => toast(errMsg(err), true));
  });
})();
