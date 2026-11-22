/* =========================================================
   ชั้นข้อมูลแบบประเมินความพึงพอใจ การประชุมผู้ปกครอง
   Firestore: collection "pmeet" (คำตอบแต่ละคน) + เอกสาร "settings/pmeet" (เปิด/ปิดรับ, เป้าหมาย)
   แยกจากข้อมูลกีฬาภายใน (surveys, settings/survey, live/state) ไม่ปนกัน
   ถ้าไม่มีค่า Firebase ใน js/config.js จะทำงานโหมดทดลอง (เก็บในเบราว์เซอร์เครื่องนี้)
   ========================================================= */
(function () {
  const CFG = window.PMEET_CONFIG || {};
  const FB_VER = '10.12.2';
  const DEMO_KEY = 'pmeet69-demo';
  const DEMO_CFG = 'pmeet69-demo-cfg';
  const isDemo = !(CFG.firebase && CFG.firebase.apiKey) || new URLSearchParams(location.search).has('demo');
  const COL = 'pmeet';
  const SET = 'pmeet';

  let fb = null, loading = null;
  function load() {
    if (fb) return Promise.resolve(fb);
    if (loading) return loading;
    const base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
    loading = Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-firestore.js'),
      import(base + 'firebase-auth.js')
    ]).then(([appMod, fs, au]) => {
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(CFG.firebase);
      fb = { fs, au, db: fs.getFirestore(app), auth: au.getAuth(app) };
      return fb;
    });
    return loading;
  }

  /* ---------- โหมดทดลอง ---------- */
  const dRead = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) { return []; } };
  const dWrite = a => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(a)); } catch (e) {} demoEmit(); };
  const dCfg = () => { try { return JSON.parse(localStorage.getItem(DEMO_CFG) || '{}'); } catch (e) { return {}; } };
  const demoSubs = new Set();
  function demoEmit() { demoSubs.forEach(fn => fn()); }
  if (isDemo) window.addEventListener('storage', e => { if (e.key === DEMO_KEY || e.key === DEMO_CFG) demoEmit(); });

  const normCfg = c => ({ open: !(c && c.open === false), target: Number(c && c.target) || (window.SURVEY && window.SURVEY.defaultTarget) || 80, closedMsg: (c && c.closedMsg) || '' });

  const SV = {
    isDemo,

    /* ----- ตั้งค่า ----- */
    async getConfig() {
      if (isDemo) return normCfg(dCfg());
      const { fs, db } = await load();
      try { const s = await fs.getDoc(fs.doc(db, 'settings', SET)); return normCfg(s.exists() ? s.data() : null); }
      catch (e) { console.warn(e); return normCfg(null); }
    },
    watchConfig(cb) {
      if (isDemo) { const f = () => cb(normCfg(dCfg())); demoSubs.add(f); f(); return () => demoSubs.delete(f); }
      let off = () => {};
      load().then(({ fs, db }) => { off = fs.onSnapshot(fs.doc(db, 'settings', SET), s => cb(normCfg(s.exists() ? s.data() : null)), e => console.warn(e)); });
      return () => off();
    },
    async setConfig(partial) {
      if (isDemo) { localStorage.setItem(DEMO_CFG, JSON.stringify(Object.assign(dCfg(), partial))); demoEmit(); return; }
      const { fs, db } = await load();
      await fs.setDoc(fs.doc(db, 'settings', SET), Object.assign({}, partial, { updatedAt: fs.serverTimestamp() }), { merge: true });
    },

    /* ----- ส่งแบบประเมิน (ทุกคน) ----- */
    async submit(doc) {
      if (isDemo) {
        const a = dRead();
        a.push(Object.assign({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now() }, doc));
        dWrite(a); return;
      }
      const { fs, db } = await load();
      await fs.addDoc(fs.collection(db, COL), Object.assign({}, doc, { createdAt: fs.serverTimestamp() }));
    },

    /* ----- อ่าน/ลบ (เฉพาะผู้ดูแล) ----- */
    watchResponses(cb, onErr) {
      if (isDemo) { const f = () => cb(dRead()); demoSubs.add(f); f(); return () => demoSubs.delete(f); }
      let off = () => {};
      load().then(({ fs, db }) => {
        off = fs.onSnapshot(fs.collection(db, COL), snap => {
          cb(snap.docs.map(d => {
            const x = d.data();
            const ts = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now();
            return Object.assign({}, x, { id: d.id, at: ts, createdAt: undefined });
          }));
        }, e => { console.error(e); onErr && onErr(e); });
      });
      return () => off();
    },
    async remove(id) {
      if (isDemo) { dWrite(dRead().filter(r => r.id !== id)); return; }
      const { fs, db } = await load();
      await fs.deleteDoc(fs.doc(db, COL, id));
    },
    async removeAll(ids) {
      if (isDemo) { dWrite([]); return; }
      const { fs, db } = await load();
      for (let i = 0; i < ids.length; i += 400) {
        const b = fs.writeBatch(db);
        ids.slice(i, i + 400).forEach(id => b.delete(fs.doc(db, COL, id)));
        await b.commit();
      }
    },

    /* ----- เข้าสู่ระบบ (บัญชีเดียวกับเว็บกีฬาภายใน) ----- */
    async onAuth(cb) {
      if (isDemo) { cb({ email: 'demo@local', demo: true }); return; }
      try { const { au, auth } = await load(); au.onAuthStateChanged(auth, cb); }
      catch (e) { console.error(e); cb(null, e); }
    },
    async signIn(email, pw) { const { au, auth } = await load(); return au.signInWithEmailAndPassword(auth, email, pw); },
    async signOut() { if (isDemo) return; const { au, auth } = await load(); return au.signOut(auth); },
    isAdmin(user) { return !!user && (user.demo || !CFG.adminEmail || (user.email || '').toLowerCase() === CFG.adminEmail.toLowerCase()); }
  };

  /* ---------- สถิติ ---------- */
  const r2 = x => Math.round(x * 100) / 100;
  function stats(vals) {
    const n = vals.length;
    if (!n) return { n: 0, mean: null, sd: null };
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : 0;
    return { n, mean, sd };
  }
  function level(mean) {
    if (mean == null) return '–';
    const m = r2(mean);
    const c = window.SURVEY.CRITERIA.find(c => m >= c.min) || window.SURVEY.CRITERIA[window.SURVEY.CRITERIA.length - 1];
    return c.label;
  }
  const okv = v => { v = Number(v); return v >= 1 && v <= 5 && Number.isInteger(v) ? v : null; };

  /* วิเคราะห์ผลของกลุ่มหนึ่ง  S.D. คำนวณแบบกลุ่มตัวอย่าง (n−1) จากคะแนนทุกค่าในด้าน/ข้อนั้น */
  function analyze(group, rows) {
    const all = [];
    const sections = group.sections.map(sec => {
      const secVals = [];
      const items = sec.items.map(it => {
        const vals = rows.map(r => okv(r.ans && r.ans[it.id])).filter(v => v != null);
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        vals.forEach(v => { dist[v]++; secVals.push(v); all.push(v); });
        return Object.assign({ item: it, dist }, stats(vals));
      });
      return Object.assign({ sec, items }, stats(secVals));
    });
    const overall = stats(all);
    // ร้อยละของผู้ตอบที่มีค่าเฉลี่ยรายบุคคลอยู่ในระดับ "มาก" ขึ้นไป (≥ 3.51)
    const ids = group.sections.flatMap(s => s.items.map(i => i.id));
    let rated = 0, high = 0;
    rows.forEach(r => {
      const v = ids.map(id => okv(r.ans && r.ans[id])).filter(x => x != null);
      if (!v.length) return;
      rated++;
      if (r2(v.reduce((a, b) => a + b, 0) / v.length) >= 3.51) high++;
    });
    return { n: rows.length, sections, overall, rated, high, pctHigh: rated ? high * 100 / rated : null, ratings: all.length };
  }

  /* ความถี่ของข้อมูลทั่วไป */
  function freq(field, rows) {
    const counts = {};
    field.options.forEach(o => counts[o] = 0);
    let answered = 0;
    rows.forEach(r => {
      let v = r.demo && r.demo[field.id];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      answered++;
      (Array.isArray(v) ? v : [v]).forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    });
    return { counts, answered, n: rows.length };
  }

  const fmt = (x, d = 2) => x == null ? '–' : x.toFixed(d);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.SVStore = SV;
  window.SVU = { stats, level, analyze, freq, fmt, esc, r2, okv };
})();
