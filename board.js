// Playground: a personal moodboard. Saved in this browser (localStorage) for now.
const Board = (() => {
  const KEY = "playground.v1";
  const MAX_W = 8000, MAX_H = 8000; // canvas size limit (raise later)
  let data = { items: [], strokes: [], z: 1 };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.items)) data = { items: s.items, strokes: s.strokes || [], z: s.z || 1 };
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const has = src => data.items.some(i => i.src === src);
  function addImage(src, x, y, w) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => {
        w = w || 260;
        const n = data.items.length % 6;
        const it = { id: uid(), type: "img", src, x: x ?? 40 + n * 36, y: y ?? 40 + n * 36, w,
          h: Math.round(w * im.naturalHeight / im.naturalWidth), z: ++data.z };
        data.items.push(it);
        res({ it, ok: save() });
      };
      im.onerror = () => res({ it: null, ok: false });
      im.src = src;
    });
  }
  return { data, save, uid, has, addImage, MAX_W, MAX_H };
})();

const CHECK = `<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M2.5 6.4l2.4 2.3 4.6-5"/></svg>`;

// Small "+" centered under a photo (appears on hovering the photo or the strip below it).
// On hover it opens to "+ Add to Playground". getSrc() returns the photo it adds.
function addButton(getSrc) {
  const row = document.createElement("div");
  row.className = "addrow";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "addbtn";
  row.appendChild(b);
  const set = done => {
    b.classList.toggle("done", done);
    b.innerHTML = `<span class="plus">${done ? CHECK : "+"}</span><span class="lbl">${done ? "In Playground" : "Add to Playground"}</span>`;
  };
  row.update = () => set(Board.has(getSrc()));
  row.update();
  b.addEventListener("click", async e => {
    e.stopPropagation();
    const src = getSrc();
    if (Board.has(src)) return;
    const r = await Board.addImage(src);
    if (r.it) { row.update(); refreshNav(); }
  });
  return row;
}

// The Playground page
function boardPage() {
  setHeader(X(lastView));
  app.innerHTML = `
    <div id="bd"><div id="cv"><svg id="ink"></svg></div><div class="hint">Your playground is empty.<br>Add photos with the + on any project, or drag images from your computer or another tab onto this page.</div></div>
    <div class="tools">
      <button data-t="text">Add text</button><span class="sep"></span>
      <button class="sw" data-t="m:ink" style="--c:var(--fg)" aria-label="Black or white marker"></button>
      <button class="sw" data-t="m:#e0452b" style="--c:#e0452b" aria-label="Red marker"></button>
      <button class="sw" data-t="m:#2f5fd0" style="--c:#2f5fd0" aria-label="Blue marker"></button>
      <button class="sw hl" data-t="h:#ffe14d" style="--c:#ffe14d" aria-label="Highlighter"></button>
      <button data-t="eraser">Eraser</button>
      <button data-t="undo" id="undo" aria-label="Undo" title="Undo" disabled><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3L2.5 6l3 3"/><path d="M2.8 6H9a4 4 0 010 8H6"/></svg></button><span class="sep"></span>
      <button data-t="send">Send reference</button><button data-t="clear">Clear</button>
      <span class="note" id="note"></span>
    </div>`;
  const D = Board.data, bd = $("bd"), cv = $("cv"), ink = $("ink"), hint = bd.querySelector(".hint");
  let tool = "move";
  let noteTimer;
  const note = (msg, ms = 3500) => { $("note").textContent = msg; clearTimeout(noteTimer); noteTimer = setTimeout(() => ($("note").textContent = ""), ms); };
  const persist = () => { if (!Board.save()) note("Storage is full. Remove some images."); };

  // ---- undo history (snapshots share the big image strings, so they stay cheap)
  const hist = [];
  const snap = () => ({ items: D.items.map(i => ({ ...i })), strokes: D.strokes.map(s => ({ ...s })), z: D.z });
  const updUndo = () => ($("undo").disabled = !hist.length);
  const pushH = s => { hist.push(s); if (hist.length > 40) hist.shift(); updUndo(); };

  // canvas grows to fit what's on it (right and down), up to the max
  function fit() {
    let w = bd.clientWidth, h = bd.clientHeight;
    D.items.forEach(i => {
      const el = cv.querySelector(`[data-id="${i.id}"]`);
      w = Math.max(w, i.x + (i.w || (el ? el.offsetWidth : 100)) + 160);
      h = Math.max(h, i.y + (i.h || (el ? el.offsetHeight : 60)) + 160);
    });
    D.strokes.forEach(s => s.pts.forEach(([x, y]) => { w = Math.max(w, x + 160); h = Math.max(h, y + 160); }));
    w = Math.min(w, Board.MAX_W); h = Math.min(h, Board.MAX_H);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    ink.setAttribute("width", w); ink.setAttribute("height", h);
    hint.style.display = D.items.length || D.strokes.length ? "none" : "";
  }

  const place = (el, it) => {
    el.style.left = it.x + "px"; el.style.top = it.y + "px"; el.style.zIndex = it.z;
    if (it.w) el.style.width = it.w + "px";
    el.style.transform = it.r ? `rotate(${it.r}deg)` : "";
  };
  const edgeScroll = ev => {
    const r = bd.getBoundingClientRect();
    if (ev.clientX > r.right - 40) bd.scrollLeft += 24;
    if (ev.clientY > r.bottom - 40) bd.scrollTop += 24;
    if (ev.clientX < r.left + 40) bd.scrollLeft -= 24;
    if (ev.clientY < r.top + 40) bd.scrollTop -= 24;
  };

  function mount(it) {
    const el = document.createElement("div");
    el.className = "it " + it.type;
    el.dataset.id = it.id;
    if (it.type === "img") {
      el.innerHTML = `<img src="${it.src.replace(/"/g, "%22")}" alt="" draggable="false"><span class="rz"></span><span class="rt tl"></span><span class="rt tr"></span><span class="rt bl"></span><span class="rt br"></span>`;
    } else {
      el.innerHTML = `<div class="tx" spellcheck="false"></div>`;
      el.firstChild.textContent = it.text;
    }
    el.insertAdjacentHTML("beforeend", `<button class="del" aria-label="Remove">×</button>`);
    place(el, it);
    cv.appendChild(el);

    el.querySelector(".del").addEventListener("click", () => {
      pushH(snap()); D.items.splice(D.items.indexOf(it), 1); el.remove(); persist(); fit(); refreshNav();
    });

    el.addEventListener("pointerdown", e => {
      if (tool !== "move" || e.target.closest(".del") || el.classList.contains("editing")) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      it.z = ++D.z; el.style.zIndex = it.z;
      const before = snap(); let moved = false;
      const resizing = e.target.classList.contains("rz"), rotating = e.target.classList.contains("rt");
      const sx = e.clientX + bd.scrollLeft, sy = e.clientY + bd.scrollTop, ox = it.x, oy = it.y, ow = it.w, oh = it.h;
      const rb = el.getBoundingClientRect(), cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2;
      const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), r0 = it.r || 0, rad = r0 * Math.PI / 180;
      const mv = ev => {
        const dx = ev.clientX + bd.scrollLeft - sx, dy = ev.clientY + bd.scrollTop - sy;
        if (rotating) {
          let r = r0 + (Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180 / Math.PI;
          if (ev.shiftKey) r = Math.round(r / 15) * 15;
          it.r = Math.round(r * 10) / 10; el.style.transform = `rotate(${it.r}deg)`;
        } else if (resizing) {
          const along = dx * Math.cos(rad) + dy * Math.sin(rad); // drag measured along the photo's own axis
          it.w = Math.min(Math.max(60, ow + along), Board.MAX_W - it.x);
          it.h = Math.round(it.w * oh / ow);
          el.style.width = it.w + "px";
        } else {
          it.x = Math.min(Math.max(0, ox + dx), Board.MAX_W - (it.w || el.offsetWidth));
          it.y = Math.min(Math.max(0, oy + dy), Board.MAX_H - (it.h || el.offsetHeight));
          el.style.left = it.x + "px"; el.style.top = it.y + "px";
        }
        moved = true; fit(); edgeScroll(ev);
      };
      const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); if (moved) pushH(before); persist(); };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
    });

    if (it.type === "text") {
      const tx = el.querySelector(".tx");
      let before = null;
      const edit = () => {
        before = snap(); el.classList.add("editing"); tx.contentEditable = "true"; tx.focus();
        getSelection().selectAllChildren(tx);
      };
      tx.addEventListener("dblclick", edit);
      tx.addEventListener("blur", () => {
        el.classList.remove("editing"); tx.contentEditable = "false";
        const prev = it.text; it.text = tx.textContent.trim();
        if (before && it.text !== prev) pushH(before);
        if (!it.text) { D.items.splice(D.items.indexOf(it), 1); el.remove(); refreshNav(); }
        persist(); fit();
      });
      tx.addEventListener("keydown", e => { if (e.key === "Escape") tx.blur(); });
      it._edit = edit;
    }
    return el;
  }

  // ---- marker strokes
  const pathD = pts => pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const strokeHTML = s => {
    const col = s.c === "ink" ? "currentColor" : s.c, d = pathD(s.pts);
    return `<g data-id="${s.id}"><path class="v" d="${d}" stroke="${col}" stroke-width="${s.w}" ${s.hl ? 'opacity=".5"' : ""} fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  };
  ink.innerHTML = D.strokes.map(strokeHTML).join("");
  bd.addEventListener("pointerdown", e => {
    if (!(/^(m|h):/.test(tool) || tool === "eraser") || e.target.closest(".tools")) return;
    e.preventDefault();
    const r = bd.getBoundingClientRect(), hl = tool[0] === "h";
    const pt = ev => [Math.round(ev.clientX - r.left + bd.scrollLeft), Math.round(ev.clientY - r.top + bd.scrollTop)];
    const before = snap();
    if (tool === "eraser") {
      let did = eraseAt(...pt(e)), last = pt(e);
      bd.setPointerCapture(e.pointerId);
      const mv = ev => {
        const p = pt(ev), n = Math.max(1, Math.ceil(Math.hypot(p[0] - last[0], p[1] - last[1]) / 6));
        for (let k = 1; k <= n; k++) did = eraseAt(last[0] + (p[0] - last[0]) * k / n, last[1] + (p[1] - last[1]) * k / n) || did;
        last = p;
      };
      const up = () => { bd.removeEventListener("pointermove", mv); bd.removeEventListener("pointerup", up); if (did) { pushH(before); persist(); fit(); } };
      bd.addEventListener("pointermove", mv); bd.addEventListener("pointerup", up);
      return;
    }
    const s = { id: Board.uid(), c: tool.slice(2), w: hl ? 18 : 3, hl, pts: [pt(e)] };
    D.strokes.push(s);
    ink.insertAdjacentHTML("beforeend", strokeHTML(s));
    const g = ink.lastElementChild;
    bd.setPointerCapture(e.pointerId);
    const mv = ev => {
      const p = pt(ev), l = s.pts[s.pts.length - 1];
      if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 3) return;
      s.pts.push(p);
      g.querySelectorAll("path").forEach(el => el.setAttribute("d", pathD(s.pts)));
      fit();
    };
    const up = () => { bd.removeEventListener("pointermove", mv); bd.removeEventListener("pointerup", up); pushH(before); persist(); };
    bd.addEventListener("pointermove", mv);
    bd.addEventListener("pointerup", up);
  });

  // eraser: a small square that rubs out marker underneath it (splits strokes where it passes)
  const ER = 10; // half the square's size
  const densify = pts => {
    const out = [];
    pts.forEach((p, i) => {
      out.push(p);
      const q = pts[i + 1]; if (!q) return;
      const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4);
      for (let k = 1; k < n; k++) out.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]);
    });
    return out;
  };
  function eraseAt(x, y) {
    let changed = false; const out = [];
    for (const s of D.strokes) {
      const half = ER + s.w / 2, dp = densify(s.pts);
      const inside = p => Math.abs(p[0] - x) <= half && Math.abs(p[1] - y) <= half;
      if (!dp.some(inside)) { out.push(s); continue; }
      changed = true;
      let run = [];
      for (const p of dp) {
        if (inside(p)) { if (run.length > 1) out.push({ ...s, id: Board.uid(), pts: run }); run = []; } else run.push(p);
      }
      if (run.length > 1) out.push({ ...s, id: Board.uid(), pts: run });
    }
    if (changed) { D.strokes = out; ink.innerHTML = out.map(strokeHTML).join(""); }
    return changed;
  }

  // rebuild the page from the data (used by undo and clear)
  function rebuild() {
    cv.querySelectorAll(".it").forEach(n => n.remove());
    D.items.forEach(mount);
    ink.innerHTML = D.strokes.map(strokeHTML).join("");
    persist(); fit(); refreshNav();
  }
  function undo() {
    const s = hist.pop(); if (!s) return;
    D.items = s.items; D.strokes = s.strokes; D.z = Math.max(D.z, s.z);
    updUndo(); rebuild();
  }

  // clear: the page turns over to a blank one
  function clearBoard() {
    if (!D.items.length && !D.strokes.length) return;
    pushH(snap());
    const r = bd.getBoundingClientRect();
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    const clone = cv.cloneNode(true);
    clone.removeAttribute("id");
    const svg = clone.querySelector("svg"); if (svg) svg.removeAttribute("id");
    clone.style.transform = `translate(${-bd.scrollLeft}px,${-bd.scrollTop}px)`;
    sheet.appendChild(clone);
    document.body.appendChild(sheet);
    setTimeout(() => sheet.remove(), 1400);
    D.items = []; D.strokes = [];
    rebuild(); bd.scrollTo(0, 0);
  }

  // ---- toolbar
  const setTool = t => {
    tool = t;
    app.querySelectorAll(".tools [data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    bd.dataset.tool = /^(m|h):/.test(t) ? "draw" : t;
  };
  app.querySelector(".tools").addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    const t = b.dataset.t;
    if (t === "text") {
      const it = { id: Board.uid(), type: "text", text: "Text", x: bd.scrollLeft + 120 + (D.items.length % 5) * 30, y: bd.scrollTop + 120 + (D.items.length % 5) * 30, z: ++D.z };
      pushH(snap()); D.items.push(it); const el = mount(it); fit(); setTool("move"); it._edit(); persist(); refreshNav();
    } else if (t === "undo") { undo();
    } else if (t === "send") { sendReference();
    } else if (t === "clear") { clearBoard();
    } else setTool(tool === t ? "move" : t);
  });

  // ---- drop images in (files, or an image dragged from another tab)
  const shrink = url => new Promise((res, rej) => {
    const im = new Image();
    if (/^https?:/.test(url)) im.crossOrigin = "anonymous";
    im.onload = () => { try {
      const k = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.82));
    } catch (err) { rej(err); } };
    im.onerror = rej; im.src = url;
  });
  async function dropImage(src, x, y) {
    const before = snap();
    const r = await Board.addImage(src, x, y, 260);
    if (r.it) { pushH(before); mount(r.it); fit(); if (!r.ok) { note("Storage is full. Remove some images."); } refreshNav(); }
    else note("Couldn't load that image.");
  }
  bd.addEventListener("dragover", e => { e.preventDefault(); bd.classList.add("over"); });
  bd.addEventListener("dragleave", () => bd.classList.remove("over"));
  bd.addEventListener("drop", async e => {
    e.preventDefault(); bd.classList.remove("over");
    const r = bd.getBoundingClientRect(), x = e.clientX - r.left + bd.scrollLeft - 100, y = e.clientY - r.top + bd.scrollTop - 100;
    const dt = e.dataTransfer, files = [...dt.files].filter(f => f.type.startsWith("image/"));
    if (files.length) {
      for (const [k, f] of files.entries()) {
        const u = URL.createObjectURL(f);
        try { await dropImage(await shrink(u), x + k * 30, y + k * 30); } catch (err) { note("Couldn't read that file."); }
        URL.revokeObjectURL(u);
      }
      return;
    }
    let url = dt.getData("text/uri-list").split("\n")[0].trim();
    if (!url) { const m = /<img[^>]+src=["']([^"']+)/i.exec(dt.getData("text/html")); url = m ? m[1] : ""; }
    if (!/^https?:|^data:image/.test(url)) return note("Drop an image file or an image from another tab.");
    try { dropImage(await shrink(url), x, y); } // saved with the board when the site allows it
    catch (err) { dropImage(url, x, y); }        // otherwise link to the original
  });


  // ---- export the board as a PDF (and hand it to the email app)
  const loadImg = src => new Promise(res => {
    const im = new Image();
    if (/^https?:/.test(src) && new URL(src, location.href).origin !== location.origin) im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  async function boardCanvas() {
    if (!D.items.length && !D.strokes.length) return null;
    const FONT = '16px "minion-pro", "Minion Pro", "Crimson Pro", Georgia, serif';
    let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
    const grow = (x, y, w, h) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
    D.items.forEach(i => {
      const el = cv.querySelector(`[data-id="${i.id}"]`), w = i.w || (el ? el.offsetWidth : 100), h = i.h || (el ? el.offsetHeight : 30);
      if (i.r) { const d = Math.hypot(w, h); grow(i.x + w / 2 - d / 2, i.y + h / 2 - d / 2, d, d); } else grow(i.x, i.y, w, h);
    });
    D.strokes.forEach(s => s.pts.forEach(([x, y]) => grow(x - 10, y - 10, 20, 20)));
    const pad = 40, W = x1 - x0 + pad * 2, H = y1 - y0 + pad * 2;
    const k = Math.min(2, 4096 / Math.max(W, H));
    const c = document.createElement("canvas");
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext("2d");
    g.scale(k, k); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const ox = pad - x0, oy = pad - y0;
    let missing = 0;
    for (const i of [...D.items].sort((a, b) => a.z - b.z)) {
      if (i.type === "img") {
        const im = await loadImg(i.src);
        if (im) {
          g.save(); g.translate(i.x + ox + i.w / 2, i.y + oy + i.h / 2); g.rotate((i.r || 0) * Math.PI / 180);
          g.drawImage(im, -i.w / 2, -i.h / 2, i.w, i.h); g.restore();
        } else { missing++; g.fillStyle = "#eee"; g.fillRect(i.x + ox, i.y + oy, i.w, i.h); g.fillStyle = "#888"; g.font = "13px sans-serif"; g.fillText("image unavailable", i.x + ox + 8, i.y + oy + 20); }
      } else {
        g.fillStyle = "#111"; g.font = FONT; g.textBaseline = "top";
        i.text.split("\n").forEach((ln, n) => g.fillText(ln, i.x + ox + 6, i.y + oy + 4 + n * 22));
      }
    }
    D.strokes.forEach(s => {
      g.globalAlpha = s.hl ? 0.5 : 1; g.strokeStyle = s.c === "ink" ? "#111" : s.c; g.lineWidth = s.w;
      g.lineCap = g.lineJoin = "round"; g.beginPath();
      s.pts.forEach(([x, y], n) => (n ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy))); g.stroke();
    });
    g.globalAlpha = 1;
    return { c, missing };
  }
  function jpegToPdf(dataUrl, w, h) {
    const bin = atob(dataUrl.split(",")[1]), img = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    const enc = s => new TextEncoder().encode(s), parts = [], off = [];
    let len = 0; const push = u => { parts.push(u); len += u.length; };
    const W = Math.round(w * 0.75), H = Math.round(h * 0.75);
    const obj = (n, body) => { off[n] = len; push(enc(`${n} 0 obj\n${body}\nendobj\n`)); };
    push(enc("%PDF-1.4\n"));
    obj(1, "<</Type/Catalog/Pages 2 0 R>>");
    obj(2, "<</Type/Pages/Kids[3 0 R]/Count 1>>");
    obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
    off[4] = len;
    push(enc(`4 0 obj\n<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${img.length}>>\nstream\n`));
    push(img); push(enc("\nendstream\nendobj\n"));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(5, `<</Length ${cs.length}>>\nstream\n${cs}\nendstream`);
    const xref = len;
    push(enc("xref\n0 6\n0000000000 65535 f \n" + [1, 2, 3, 4, 5].map(n => String(off[n]).padStart(10, "0") + " 00000 n \n").join("")));
    push(enc(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`));
    return new Blob(parts, { type: "application/pdf" });
  }
  // One button: build the PDF, then hand it to the visitor's email.
  // Phones and Safari can attach the file directly; elsewhere the PDF downloads, the board picture is copied
  // so it can be pasted into the draft, and a pre-addressed email opens. (Browsers can't attach files to a mailto link.)
  async function sendReference() {
    note("Preparing your reference…", 8000);
    const r = await boardCanvas();
    if (!r) return note("The board is empty.");
    const blob = jpegToPdf(r.c.toDataURL("image/jpeg", 0.9), r.c.width, r.c.height);
    const file = new File([blob], "playground.pdf", { type: "application/pdf" });
    const msg = "Hi Cheng, here's a reference board I put together on your site.";
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Reference for Cheng", text: msg }); note(""); return; }
      catch (e) { if (e.name === "AbortError") return note(""); }
    }
    let copied = false;
    try {
      const png = await new Promise(res => r.c.toBlob(res, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); copied = true;
    } catch (e) {}
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "playground.pdf"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const tip = copied ? "Paste (Cmd/Ctrl+V) the board picture into the email, or attach playground.pdf." : "Attach the downloaded playground.pdf to the email.";
    location.href = `mailto:${S.email}?subject=${encodeURIComponent("Reference from your site")}&body=${encodeURIComponent(msg + "\n\n[" + tip + "]")}`;
    note((r.missing ? `${r.missing} image(s) couldn't be included. ` : "") + "PDF saved. " + tip, 9000);
  }
  D.items.forEach(mount);
  fit(); setTool("move");
  addEventListener("resize", fit);
  window.onkeydown = e => {
    if (document.activeElement.isContentEditable) return;
    if (e.key === "Escape") location.hash = lastView;
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  };
}
