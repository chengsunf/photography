const S = window.SITE;
const $ = id => document.getElementById(id);
const L = $("left"), R = $("right"), SUB = $("sub"), app = $("app");
let lastView = "#/";
const proj = slug => S.projects.find(p => p.slug === slug);
// Description text: blank line = new paragraph; [text](https://url) or a bare https://url becomes a link
const fmt = t => esc(t)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(])(https?:\/\/[^\s<)"]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
  .replace(/\n/g, "<br>");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const nav = () => `<a href="#/projects">Projects</a>${Board.data.items.length ? `<a class="pg" href="#/playground">Playground</a>` : ""}<a href="#/about">About</a>`;
const refreshNav = () => {
  if (!R.querySelector('a[href="#/projects"]')) return;
  const had = !!R.querySelector(".pg");
  R.innerHTML = nav();
  const pg = R.querySelector(".pg");
  if (pg && !had) pg.classList.add("reveal"); // first time it appears: slow reveal, like an easter egg
};
const X = href => `<a class="x" href="${href}" aria-label="Close"><svg viewBox="0 0 20 20" width="20" height="20"><path d="M3 3l14 14M17 3L3 17" stroke="currentColor" stroke-width="1.4" fill="none"/></svg></a>`;

// Header: name always top-left (links home). `sub` = optional Header 2 under the nav.
function setHeader(right, sub) {
  L.innerHTML = `<a href="#/">${esc(S.name)}</a>`;
  R.innerHTML = right;
  SUB.innerHTML = sub ? `<h2>${esc(sub)}</h2>` : "";
  document.body.classList.toggle("has-sub", !!sub);
}
function empty() { app.innerHTML = `<div class="empty">No photos yet. Add folders of photos and run <code>python3 prepare.py</code>.</div>`; }

// Cover: photo changes as the pointer moves; click opens that photo's project
function coverPage() {
  lastView = "#/";
  const list = S.covers, n = list.length;
  setHeader(nav());
  if (!n) return empty();
  app.innerHTML = `<div class="stage cover"><img alt=""></div>`;
  const stage = app.querySelector(".stage"), img = stage.querySelector("img");
  list.forEach(c => (new Image().src = c.src));
  let i = 0, acc = 0, last = null;
  const STEP = 90; // px of pointer travel per photo
  const show = k => { i = (k + n) % n; img.src = list[i].src; stage.style.cursor = list[i].project ? "pointer" : "crosshair"; };
  show(0);
  const move = (x, y) => {
    if (last) { acc += Math.hypot(x - last[0], y - last[1]); while (acc >= STEP) { acc -= STEP; show(i + 1); } }
    last = [x, y];
  };
  stage.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  stage.addEventListener("mouseleave", () => (last = null));
  stage.addEventListener("touchmove", e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  stage.addEventListener("click", () => { const p = list[i].project; if (p) location.hash = `#/project/${p}`; });
  window.onkeydown = e => { if (e.key === "ArrowRight") show(i + 1); else if (e.key === "ArrowLeft") show(i - 1); };
}

// where photo k of the full list sits in the project page's list (its 4 grid photos are one combined picture there)
const splitIndex = (p, k) => {
  if (!p.split) return k;
  let idx = 0, prevGrid = false;
  for (let j = 0; j <= k; j++) {
    const g = p.images[j].kind === "grid";
    if (!(g && prevGrid)) idx++;
    prevGrid = g;
  }
  return idx - 1;
};
const thumbs = p => p.images.map((im, k) => `<a${im.land ? ' class="land"' : ""} href="#/project/${p.slug}/${splitIndex(p, k)}"><img loading="lazy" src="${im.thumb}" alt=""></a>`).join("");

// All projects (newest first), thumbnails grouped by project
function projectsPage() {
  setHeader(X(lastView));
  let html = "", year = null;
  S.projects.forEach(p => {
    if (p.year !== year) { year = p.year; html += `<div class="year">${year}</div>`; }
    html += `<section class="group"><h2><a href="#/project/${p.slug}">${esc(p.title)}</a></h2><div class="grid">${thumbs(p)}</div></section>`;
  });
  app.innerHTML = html;
  window.onkeydown = e => { if (e.key === "Escape") location.hash = lastView; };
}

// Scrolling project: photos stacked in one column (files named *-grid are grouped in a 2x2 grid,
// *-full run full width). A thumbnail strip is pinned to the bottom and follows the scroll.
function scrollProject(p, desc) {
  let blocks = "", i = 0;
  const img = (im, k) => `<div class="ph" data-i="${k}"><img data-i="${k}" loading="lazy" src="${im.src}" alt=""></div>`;
  while (i < p.images.length) {
    const im = p.images[i];
    if (im.kind === "grid") {
      let cells = "";
      while (i < p.images.length && p.images[i].kind === "grid") { cells += img(p.images[i], i); i++; }
      blocks += `<div class="block grid4">${cells}</div>`;
    } else {
      blocks += `<div class="block single${im.kind === "full" ? " full" : ""}${im.land || im.kind === "bleed" ? " land" : ""}">${img(im, i)}</div>`;
      i++;
    }
  }
  const strip = p.images.map((im, k) => `<button data-i="${k}" aria-label="Photo ${k + 1}"><img src="${im.thumb}" alt=""></button>`).join("");
  app.innerHTML = `<div class="scroll"><div class="desc">${desc}</div><div class="feed">${blocks}</div></div><div class="strip">${strip}<a class="modebtn" href="#/project/${p.slug}">Back to grid view</a></div>`;
  app.querySelectorAll(".feed .ph").forEach(ph => ph.appendChild(addButton(() => p.images[+ph.dataset.i].src)));
  const pics = [...app.querySelectorAll(".feed img")], btns = [...app.querySelectorAll(".strip button")];
  const setOn = k => btns.forEach((b, j) => {
    b.classList.toggle("on", j === k);
    if (j === k) b.scrollIntoView({ inline: "center", block: "nearest" });
  });
  setOn(0);
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setOn(+e.target.dataset.i); }),
    { rootMargin: "-45% 0px -45% 0px" });
  pics.forEach(el => io.observe(el));
  btns.forEach((b, k) => b.addEventListener("click", () => pics[k].scrollIntoView({ behavior: "smooth", block: "center" })));
  // strip stays hidden while reading; it slides in only at the bottom of the page
  const bar = app.querySelector(".strip");
  const check = () => bar.classList.toggle("show", innerHeight + scrollY >= document.documentElement.scrollHeight - 40);
  window.onscroll = check;
  check();
}

// One project: description + collage on the left, big preview on the right.
// Hovering a thumbnail swaps the big photo until the first click; after that it only changes on click.
function projectPage(slug, mode) {
  const p = proj(slug);
  if (!p) return (location.hash = "#/projects");
  lastView = location.hash;
  setHeader(nav(), p.title);
  const desc = (p.description || "").split(/\n\n+/).map(t => `<p>${fmt(t)}</p>`).join("");
  const list = p.split || p.images; // the 4 grid photos appear as one combined picture here
  if (mode === "scroll") { lastView = `#/project/${slug}`; return scrollProject(p, desc); }
  const tiles = list.map((im, k) => `<a data-i="${k}"><img loading="lazy" src="${im.thumb}" alt=""></a>`).join("");
  app.innerHTML = `<div class="project"><div class="left"><div class="grid">${tiles}</div><div class="desc">${desc}</div><a class="modebtn" href="#/project/${slug}/scroll">Scroll mode</a></div><div class="side"><img class="preview" alt=""></div></div>`;
  let cur = 0, locked = false;
  const addb = addButton(() => list[cur].src);
  app.querySelector(".side").appendChild(addb);
  const big = app.querySelector(".preview"), links = [...app.querySelectorAll(".grid a")];
  const show = k => { cur = k; big.src = list[k].src; addb.update(); links.forEach((l, j) => l.classList.toggle("on", j === k)); };
  const start = /^\d+$/.test(mode || "") ? Math.min(+mode, list.length - 1) : 0;
  show(start); // coming from the Projects page: that photo is selected, hover still works
  links.forEach((l, k) => {
    l.addEventListener("mouseenter", () => { if (!locked) show(k); }); // browsing: hover swaps the photo
    l.addEventListener("click", () => { locked = true; show(k); });     // after a click, only clicks change it
  });
  // click the right half of the big photo for the next one, the left half for the previous one
  const n = list.length, step = d => { locked = true; show((cur + d + n) % n); };
  const side = e => { const r = big.getBoundingClientRect(); return e.clientX - r.left > r.width / 2 ? 1 : -1; };
  big.addEventListener("mousemove", e => (big.style.cursor = side(e) > 0 ? "e-resize" : "w-resize"));
  big.addEventListener("click", e => step(side(e)));
  window.onkeydown = e => { if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); };
  setTimeout(() => list.forEach(im => (new Image().src = im.src)), 300); // preload for instant hover
}

// Slideshow within a project
function viewPage(slug, i) {
  const p = proj(slug);
  if (!p) return (location.hash = "#/projects");
  const list = p.images, n = list.length;
  i = ((i % n) + n) % n;
  const go = d => (location.hash = `#/view/${slug}/${(i + d + n) % n}`);
  const back = `#/project/${slug}`;
  setHeader(X(back), p.title);
  app.innerHTML = `<div class="stage"><img src="${list[i].src}" alt=""></div><a class="zone prev"></a><a class="zone next"></a>`;
  app.querySelector(".prev").onclick = () => go(-1);
  app.querySelector(".next").onclick = () => go(1);
  [list[(i + 1) % n], list[(i - 1 + n) % n]].forEach(im => (new Image().src = im.src));
  window.onkeydown = e => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") location.hash = back; };
  let x0; window.ontouchstart = e => (x0 = e.touches[0].clientX);
  window.ontouchend = e => { const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 40) go(d < 0 ? 1 : -1); };
}

function aboutPage() {
  setHeader(X(lastView));
  const paras = S.about.split(/\n\n+/).map(p => `<p>${fmt(p)}</p>`).join("");
  app.innerHTML = `<div class="about"><div class="abt">${paras}<p>Contact:<br><a href="mailto:${S.email}">${S.email}</a><br><a href="${S.instagram}" target="_blank" rel="noopener">@_chengsun</a></p></div>${S.about_img ? `<img class="abimg" src="${S.about_img}" alt="">` : ""}</div>`;
  window.onkeydown = e => { if (e.key === "Escape") location.hash = lastView; };
}

function route() {
  window.ontouchstart = window.ontouchend = window.onkeydown = window.onscroll = null;
  window.scrollTo(0, 0);
  const [, page, a, b] = location.hash.split("/");
  document.title = S.name;
  if (page === "projects") projectsPage();
  else if (page === "project") projectPage(a, b);
  else if (page === "view") viewPage(a, parseInt(b || "0", 10));
  else if (page === "playground") boardPage();
  else if (page === "about") aboutPage();
  else coverPage();
}
addEventListener("hashchange", route);
route();

// Dark mode toggle: circle spins 180deg with a slight overshoot; black half ends on top in dark mode
(() => {
  const btn = $("theme"), root = document.documentElement;
  let angle = root.dataset.theme === "dark" ? 180 : 0;
  btn.style.transition = "none"; btn.style.transform = `rotate(${angle}deg)`;
  requestAnimationFrame(() => requestAnimationFrame(() => (btn.style.transition = "")));
  btn.addEventListener("click", () => {
    angle += 180;
    btn.style.transform = `rotate(${angle}deg)`;
    const dark = root.dataset.theme !== "dark";
    if (dark) root.dataset.theme = "dark"; else delete root.dataset.theme;
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
  });
})();
