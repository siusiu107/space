(function(global){
  const baseLanguage = 'ko';
  const fallback = 'ko';
  const supported = ['ko', 'es', 'en'];
  const storageKey = 'preferredLanguage';
  const cookieExpiresMs = 365 * 24 * 60 * 60 * 1000;
  const host = (global.location?.hostname || '').replace(/^www\./, '');
  const eventName = 'preferredLanguageChange';

  let currentLanguage = fallback;
  let pendingWidgetValue = null;
  let widgetPoller = null;
  let widgetAttempts = 0;
  const maxWidgetAttempts = 120;
  let initialized = false;

  function normalizeLanguage(lang){
    const code = (lang || '').toString().trim().toLowerCase();
    return supported.includes(code) ? code : fallback;
  }

  function detectBrowserLanguage(){
    const candidates = [];
    if(Array.isArray(global.navigator?.languages)){
      candidates.push(...global.navigator.languages);
    }
    if(global.navigator?.language){
      candidates.push(global.navigator.language);
    }
    if(global.navigator?.userLanguage){
      candidates.push(global.navigator.userLanguage);
    }
    if(global.Intl?.DateTimeFormat){
      try{
        const intlLocale = global.Intl.DateTimeFormat().resolvedOptions().locale;
        if(intlLocale) candidates.push(intlLocale);
      }catch{}
    }
    for(const raw of candidates){
      if(!raw) continue;
      const code = raw.toString().split('-')[0].toLowerCase();
      if(supported.includes(code)) return code;
    }
    return fallback;
  }

  function readInitialLanguage(){
    try{
      const saved = global.localStorage?.getItem(storageKey);
      if(saved && supported.includes(saved)) return saved;
    }catch{}
    const detected = detectBrowserLanguage();
    try{ global.localStorage?.setItem(storageKey, detected); }catch{}
    return detected;
  }

  function setCookie(lang){
    const value = `/${baseLanguage}/${lang}`;
    const expires = new Date(Date.now() + cookieExpiresMs).toUTCString();
    document.cookie = `googtrans=${value}; expires=${expires}; path=/`;
    if(host){
      document.cookie = `googtrans=${value}; expires=${expires}; path=/; domain=.${host}`;
    }
  }

  function updateDocumentLang(lang){
    try{
      if(document?.documentElement){
        document.documentElement.setAttribute('lang', lang);
      }
    }catch{}
  }

  function scheduleWidgetSync(){
    if(widgetPoller) return;
    widgetPoller = global.setInterval(() => {
      widgetAttempts += 1;
      if(pendingWidgetValue && typeof global.doGTranslate === 'function'){
        try{ global.doGTranslate(pendingWidgetValue); }catch{}
        pendingWidgetValue = null;
      }
      if(!pendingWidgetValue || widgetAttempts >= maxWidgetAttempts){
        pendingWidgetValue = null;
        clearInterval(widgetPoller);
        widgetPoller = null;
      }
    }, 500);
  }

  function requestWidgetLanguage(lang){
    const value = `${baseLanguage}|${lang}`;
    if(typeof global.doGTranslate === 'function'){
      try{ global.doGTranslate(value); }catch{}
      return;
    }
    pendingWidgetValue = value;
    widgetAttempts = 0;
    scheduleWidgetSync();
  }

  function dispatchChange(lang, reason){
    try{
      global.dispatchEvent(new CustomEvent(eventName, { detail: { lang, reason } }));
    }catch{}
  }

  function applyLanguage(lang, options = {}){
    const target = normalizeLanguage(lang);
    const shouldForce = options.force === true;
    if(!shouldForce && target === currentLanguage) return currentLanguage;
    currentLanguage = target;
    if(!options.skipStorage){
      try{ global.localStorage?.setItem(storageKey, target); }catch{}
    }
    setCookie(target);
    updateDocumentLang(target);
    if(options.syncWidget !== false){
      requestWidgetLanguage(target);
    }
    dispatchChange(target, options.reason || 'manual');
    return target;
  }

  function handleStorageEvent(event){
    if(event.key !== storageKey) return;
    const value = event.newValue || fallback;
    applyLanguage(value, { skipStorage: true, reason: 'storage' });
  }

  function init(){
    if(initialized) return currentLanguage;
    currentLanguage = readInitialLanguage();
    setCookie(currentLanguage);
    updateDocumentLang(currentLanguage);
    global.gtranslateSettings = {
      default_language: currentLanguage,
      detect_browser_language: false,
      languages: supported,
      wrapper_selector: '.gtranslate_wrapper',
      alt_flags: { en: 'usa' }
    };
    global.addEventListener('storage', handleStorageEvent);
    requestWidgetLanguage(currentLanguage);
    initialized = true;
    dispatchChange(currentLanguage, 'init');
    return currentLanguage;
  }

  global.LanguageSync = {
    init,
    setLanguage: (lang, options) => applyLanguage(lang, options),
    getCurrentLanguage: () => currentLanguage,
    getSupportedLanguages: () => [...supported],
    detectBrowserLanguage,
    fallback,
    baseLanguage
  };

  init();
})(window);
