// public/detectLogin.js
console.log('[detectLogin v2] loaded');

(function () {
  function isVisible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Accept keywords as array or single string. Normalize to array.
  function hasKeyword(str, keywords) {
    if (!str) return false;
    str = String(str).toLowerCase();
    if (!keywords) return false;
    const arr = Array.isArray(keywords) ? keywords : [String(keywords)];
    return arr.some(k => str.includes(String(k).toLowerCase()));
  }

  function scorePage() {
    const pwInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(isVisible);
    if (pwInputs.length === 0) return { score: 0, reason: 'no-passwords', pwCount: 0 };

    const usernameCandidates = ['user', 'username', 'email', 'login', 'account', 'id'];
    let userFound = false;

    for (const pw of pwInputs) {
      const form = pw.form;
      let candidates = [];
      if (form) candidates = Array.from(form.querySelectorAll('input'));
      else if (pw.parentElement) candidates = Array.from(pw.parentElement.querySelectorAll('input'));
      for (const c of candidates) {
        const attrs = `${c.name||''} ${c.id||''} ${c.placeholder||''} ${c.type||''}`.toLowerCase();
        if (usernameCandidates.some(k => attrs.includes(k))) {
          userFound = true;
          break;
        }
      }
      if (userFound) break;
    }

    const title = (document.title||'').toLowerCase();
    const url = (location.href||'').toLowerCase();
    const loginKeywords = ['login','log in','signin','sign in','sign-in','authenticate','auth'];
    const signupKeywords = ['signup','sign up','register','create account'];

    let score = 0;
    score += Math.min(4, pwInputs.length * 2);
    if (userFound) score += 2;
    if (hasKeyword(title, loginKeywords) || hasKeyword(url, 'login')) score += 1;
    if (hasKeyword(title, signupKeywords) || hasKeyword(url, signupKeywords)) score -= 2;
    score = Math.max(0, score);

    return { score, pwCount: pwInputs.length, userFound, reason: 'scored' };
  }

  function checkAndNotify() {
    const res = scorePage();
    const login = res.score >= 3;
    try {
      console.log('[detectLogin v2] score:', res.score, 'pwCount:', res.pwCount, 'userFound:', res.userFound, 'login?', login);
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'login-detection', login }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[detectLogin v2] sendMessage error:', chrome.runtime.lastError.message);
          }
        });
      }
    } catch (e) {
      console.error('[detectLogin v2] notify failed', e);
    }
  }

  // initial run
  checkAndNotify();

  // observe DOM changes for SPA / late-inserted forms
  const mo = new MutationObserver(() => {
    if (window.__loginTimer) clearTimeout(window.__loginTimer);
    window.__loginTimer = setTimeout(() => { checkAndNotify(); window.__loginTimer = null; }, 300);
  });
  mo.observe(document.documentElement || document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['type','name','id','placeholder','action']
  });

  window.addEventListener('focus', checkAndNotify);
})();
