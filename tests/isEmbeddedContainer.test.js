'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const displayModes = ['standalone', 'minimal-ui', 'fullscreen'];

function isRunningAsWebApp() {
  try {
    if (navigator.standalone) return true;
  } catch {}
  return displayModes.some((mode) => {
    try {
      return window.matchMedia(`(display-mode: ${mode})`).matches;
    } catch {
      return false;
    }
  });
}

function isEmbeddedContainer() {
  if (isRunningAsWebApp()) return true;
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('; wv') || ua.includes(' wv)') || ua.includes('wv)') || /\bwv\b/.test(ua)) return true;
  if (/(iphone|ipad|ipod).+applewebkit(?!.*safari)/i.test(navigator.userAgent || '')) return true;
  if (window.ReactNativeWebView || window.flutter_inappwebview || window.AndroidBridge) return true;
  if (window.Capacitor && window.Capacitor.isNativePlatform) return true;
  try {
    if (window.webkit && window.webkit.messageHandlers) return true;
  } catch {}
  return false;
}

function setupEnv({
  userAgent = '',
  standalone,
  matchDisplayModes = [],
  windowProps = {},
  matchMediaThrows = false,
} = {}) {
  const nav = { userAgent };
  if (standalone !== undefined) {
    nav.standalone = standalone;
  }
  const baseWindow = { ...windowProps };
  baseWindow.navigator = nav;
  if (matchMediaThrows) {
    baseWindow.matchMedia = () => {
      throw new Error('matchMedia not available');
    };
  } else {
    baseWindow.matchMedia = (query) => {
      const modeMatch = query.match(/^\(display-mode:\s*([^\s)]+)\)$/);
      const mode = modeMatch ? modeMatch[1] : '';
      return { matches: matchDisplayModes.includes(mode) };
    };
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: nav,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: baseWindow,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function cleanupEnv() {
  delete globalThis.window;
  delete globalThis.navigator;
}

test('treats standalone display as embedded', () => {
  setupEnv({ standalone: true });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects installed PWA display modes', () => {
  setupEnv({ matchDisplayModes: ['standalone'] });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects android webview user agents', () => {
  setupEnv({
    userAgent: 'mozilla/5.0 (linux; android 13; pixel 7) applewebkit/537.36 (khtml, like gecko) version/4.0 chrome/110.0.0.0 mobile safari/537.36; wv',
  });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects ios webview user agents', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects react native bridges', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0',
    windowProps: { ReactNativeWebView: {} },
  });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects flutter bridges', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0',
    windowProps: { flutter_inappwebview: {} },
  });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects capacitor native platforms', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0',
    windowProps: { Capacitor: { isNativePlatform: true } },
  });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('detects webkit message handlers', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0',
    windowProps: { webkit: { messageHandlers: {} } },
  });
  try {
    assert.equal(isEmbeddedContainer(), true);
  } finally {
    cleanupEnv();
  }
});

test('returns false for standard browsers', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    matchDisplayModes: [],
    standalone: false,
  });
  try {
    assert.equal(isEmbeddedContainer(), false);
  } finally {
    cleanupEnv();
  }
});

test('ignores matchMedia errors', () => {
  setupEnv({
    userAgent: 'Mozilla/5.0',
    matchMediaThrows: true,
    standalone: false,
  });
  try {
    assert.equal(isEmbeddedContainer(), false);
  } finally {
    cleanupEnv();
  }
});
