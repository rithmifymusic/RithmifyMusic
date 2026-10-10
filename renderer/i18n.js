// Language switch (Slovenian is the source language). English is applied by translating the DOM at display time.
(function () {
  const KEY = 'rythmify.lang';
  let lang = 'sl';
  try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'sl'; } catch {}
  window.getLang = () => lang;
  window.setLang = (l) => {
    try { localStorage.setItem(KEY, l === 'en' ? 'en' : 'sl'); } catch {}
    location.reload();
  };
  document.documentElement.lang = lang;
  if (lang !== 'en') return;

  const cache = new Map();
  function translate(raw) {
    if (!raw) return raw;
    const core = raw.trim();
    if (!core || !/[A-Za-zČŠŽčšž]/.test(core)) return raw;
    let out = cache.get(core);
    if (out === undefined) {
      out = (window.I18N_EN || {})[core] ?? null;
      if (out === null) {
        for (const [re, fn] of window.I18N_EN_PATTERNS || []) {
          const m = core.match(re);
          if (m) { out = fn(m); break; }
        }
      }
      if (out === null || out === undefined) out = core;
      if (cache.size < 5000) cache.set(core, out);
    }
    if (out === core) return raw;
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    return lead + out + trail;
  }

  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function fixNode(node) {
    if (node.nodeType === 3) {
      const t = translate(node.nodeValue);
      if (t !== node.nodeValue) node.nodeValue = t;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CANVAS') return;
    for (const a of ATTRS) {
      if (node.hasAttribute(a)) {
        const v = node.getAttribute(a);
        const t = translate(v);
        if (t !== v) node.setAttribute(a, t);
      }
    }
    for (let c = node.firstChild; c; c = c.nextSibling) fixNode(c);
  }

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach(fixNode);
      else if (r.type === 'characterData') fixNode(r.target);
      else if (r.type === 'attributes') {
        const v = r.target.getAttribute(r.attributeName);
        const t = translate(v);
        if (t !== v) r.target.setAttribute(r.attributeName, t);
      }
    }
  });
  function start() {
    fixNode(document.body);
    observer.observe(document.body, {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS,
    });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
