// Generates dist/privacy.html and dist/guide.html after `vite build`.
// The guide comes from src/guide.js (same content as the in-app guide).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { GUIDE, GUIDE_UPDATED } from "../src/guide.js";

const here = (p) => new URL(p, import.meta.url);
const css = readFileSync(here("./page-style.css"), "utf8");
const out = process.argv[2] || "dist";
mkdirSync(out, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

// Fills <span data-cfg="KEY"> from odo-config.js; highlights anything not filled in yet.
const fill = `<script>
(function(){var c=window.ODO_CONFIG||{},L={BUSINESS_NAME:"[your business name]",ABN:"[your ABN]",SUPPORT_EMAIL:"[your support email]",BUSINESS_STATE:"[state]",PRIVACY_UPDATED:"[date]"};
document.querySelectorAll("[data-cfg]").forEach(function(el){var k=el.getAttribute("data-cfg"),v=c[k];
if(!v){el.textContent=L[k]||"["+k+"]";el.className="missing";return;}
if(el.hasAttribute("data-mailto")){var a=document.createElement("a");a.href="mailto:"+v;a.textContent=v;el.replaceWith(a);}else el.textContent=v;});})();
</script>`;

const page = (title, desc, body) => `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta name="theme-color" content="#141A2E" />
<link rel="icon" type="image/png" href="favicon-32.png" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
<script src="odo-config.js"></script>
<style>${css}</style>
</head>
<body>
<div class="wrap">
<header><a class="logo" href="./">Od<i></i></a><a class="btn" href="./">Open Odo</a></header>
${body}
<footer><a href="./">Odo</a> · <a href="guide.html">User guide</a> · <a href="privacy.html">Privacy policy</a></footer>
</div>
${fill}
</body>
</html>`;

/* ---- privacy.html ---- */
writeFileSync(`${out}/privacy.html`, page("Privacy Policy · Odo", "How Odo collects, uses and protects your information.", readFileSync(here("./privacy.body.html"), "utf8")));

/* ---- guide.html ---- */
const block = (b) => {
  if (b.p) return `<p>${rich(b.p)}</p>`;
  if (b.steps) return `<ol class="steps">${b.steps.map((s) => `<li><span>${rich(s)}</span></li>`).join("")}</ol>`;
  if (b.list) return `<ul>${b.list.map((s) => `<li>${rich(s)}</li>`).join("")}</ul>`;
  if (b.tip) return `<div class="note tip">💡 ${rich(b.tip)}</div>`;
  if (b.warn) return `<div class="note warn">⚠️ ${rich(b.warn)}</div>`;
  return "";
};
const guideBody = `<h1>How to use Odo</h1>
<p class="sub">The complete guide for delivery and rideshare drivers · Updated ${GUIDE_UPDATED}</p>
<div class="card"><h2>Contents</h2><ol class="toc">${GUIDE.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join("")}</ol></div>
${GUIDE.map((s) => `<div class="card"><h2 id="${s.id}">${esc(s.title)}</h2>${s.blocks.map(block).join("")}</div>`).join("\n")}`;
writeFileSync(`${out}/guide.html`, page("User guide · Odo", "Step-by-step guide to tracking shifts, kilometres and expenses with Odo, and exporting for tax time.", guideBody));

console.log(`✓ pages written to ${out}/ (privacy.html, guide.html)`);
