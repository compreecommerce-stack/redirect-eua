export const AntiBot = (function() {
  const startTime = Date.now();
  let pointerEventsCount = 0;
  let isBotDetected = false;
  let botReasons = [];

  ['mousemove', 'touchstart', 'touchmove', 'pointermove', 'scroll', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
      pointerEventsCount++;
    }, { passive: true });
  });

  function checkUserAgent() {
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
    const botKeywords = [
      'bytespider', 'bytedance', 'tiktokbot', 'toutiao', 'feishu', 'lark',
      'headlesschrome', 'puppeteer', 'playwright', 'selenium', 'phantomjs',
      'lighthouse', 'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'slurp',
      'baiduspider', 'facebookexternalhit', 'ahrefs', 'semrush', 'curl',
      'wget', 'python', 'urllib', 'scrapy', 'node-fetch', 'axios',
      'go-http-client', 'spider', 'crawler', 'scraper', 'phantom', 'nightmare',
      'cypress', 'postman', 'pipedream', 'adreview', 'mediapartners', 'adsbot',
      'byte-spider', 'bytedance-review'
    ];

    for (let i = 0; i < botKeywords.length; i++) {
      if (ua.includes(botKeywords[i])) {
        return { isBot: true, reason: 'UA_BLACKLIST_' + botKeywords[i] };
      }
    }

    if (navigator.userAgentData && navigator.userAgentData.brands) {
      const brands = navigator.userAgentData.brands.map(b => (b.brand || '').toLowerCase()).join(' ');
      if (brands.includes('headless') || brands.includes('automation')) {
        return { isBot: true, reason: 'UA_DATA_AUTOMATION' };
      }
    }

    return { isBot: false };
  }

  function checkAutomation() {
    if (navigator.webdriver === true) {
      return { isBot: true, reason: 'WEBDRIVER_TRUE' };
    }

    try {
      const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
      if (descriptor && descriptor.get && descriptor.get.toString().includes('native code') === false) {
        return { isBot: true, reason: 'WEBDRIVER_TAMPERED' };
      }
    } catch (e) {}

    if (document.documentElement && document.documentElement.getAttribute('webdriver')) {
      return { isBot: true, reason: 'DOM_WEBDRIVER_ATTR' };
    }

    const automationGlobals = [
      '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_fn',
      '__webdriver_script_func', '__webdriver_script_function', '__fxdriver_evaluate',
      '__driver_evaluate', '__webdriver_unwrapped', '__driver_unwrapped',
      '__selenium_unwrapped', '__fxdriver_unwrapped', '_phantom', 'callPhantom',
      '__nightmare', 'domAutomation', 'domAutomationController',
      'cdc_adoQpoasnfa76pfcZLmcfl_Array', 'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      'cdc_adoQpoasnfa76pfcZLmcfl_Symbol'
    ];

    for (let i = 0; i < automationGlobals.length; i++) {
      if (automationGlobals[i] in window || (document && automationGlobals[i] in document)) {
        return { isBot: true, reason: 'AUTOMATION_GLOBAL_' + automationGlobals[i] };
      }
    }

    return { isBot: false };
  }

  function checkWebGLRenderer() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { isBot: false };

      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return { isBot: false };

      const renderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
      const vendor = (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '').toLowerCase();

      const emulatedRenderers = [
        'swiftshader', 'llvmpipe', 'mesa offscreen', 'virtualbox',
        'vmware', 'software rasterizer', 'qemu'
      ];

      for (let i = 0; i < emulatedRenderers.length; i++) {
        if (renderer.includes(emulatedRenderers[i]) || vendor.includes(emulatedRenderers[i])) {
          return { isBot: true, reason: 'EMULATED_GPU_' + emulatedRenderers[i] };
        }
      }
    } catch (e) {}

    return { isBot: false };
  }

  function checkHeadlessEnvironment() {
    if (window.outerWidth === 0 && window.outerHeight === 0) {
      return { isBot: true, reason: 'OUTER_DIMS_0' };
    }
    if (window.screen && (window.screen.width === 0 || window.screen.height === 0)) {
      return { isBot: true, reason: 'SCREEN_DIMS_0' };
    }
    if (window.screen && window.screen.colorDepth && window.screen.colorDepth < 16) {
      return { isBot: true, reason: 'COLOR_DEPTH_LOW' };
    }

    if (!navigator.languages || navigator.languages.length === 0) {
      return { isBot: true, reason: 'LANGUAGES_EMPTY' };
    }

    return { isBot: false };
  }

  function validateHumanInteraction(clickEvent) {
    if (!clickEvent) {
      return { isHuman: false, reason: 'NO_EVENT' };
    }

    if (clickEvent.isTrusted === false) {
      return { isHuman: false, reason: 'UNTRUSTED_EVENT' };
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 250) {
      return { isHuman: false, reason: 'SPEED_ANOMALY_' + elapsed };
    }

    if (clickEvent.clientX === 0 && clickEvent.clientY === 0 && clickEvent.screenX === 0 && clickEvent.screenY === 0) {
      return { isHuman: false, reason: 'COORDINATES_ZERO' };
    }

    return { isHuman: true };
  }

  async function checkDatacenterIP() {
    const hostingTerms = [
      'amazon', 'aws', 'bytedance', 'google', 'microsoft', 'azure',
      'digitalocean', 'hetzner', 'ovh', 'linode', 'alibaba', 'tencent',
      'oracle', 'hosting', 'datacenter', 'servers', 'vps',
      'leaseweb', 'choopa', 'vultr', 'contabo', 'colocation', 'dedicated'
    ];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = `${data.org || ''} ${data.asn || ''} ${data.company || ''}`.toLowerCase();
        for (let i = 0; i < hostingTerms.length; i++) {
          if (text.includes(hostingTerms[i])) {
            return { isBot: true, reason: 'DATACENTER_ASN_' + hostingTerms[i] };
          }
        }
        return { isBot: false, ip: data.ip, org: data.org };
      }
    } catch (e) {}

    return { isBot: false };
  }

  function performPassiveAudit() {
    const checks = [
      checkUserAgent(),
      checkAutomation(),
      checkWebGLRenderer(),
      checkHeadlessEnvironment()
    ];

    for (let i = 0; i < checks.length; i++) {
      if (checks[i].isBot) {
        isBotDetected = true;
        botReasons.push(checks[i].reason);
      }
    }

    return isBotDetected;
  }

  function buildRedirectUrl(targetBaseUrl) {
    try {
      const currentParams = new URLSearchParams(window.location.search);
      const url = new URL(targetBaseUrl, window.location.href);

      currentParams.forEach((value, key) => {
        if (key !== 'safe' && key !== 'preview') {
          url.searchParams.set(key, value);
        }
      });

      url.searchParams.set('_vfy', '1');
      url.searchParams.set('_t', Date.now().toString());

      return url.toString();
    } catch (e) {
      return targetBaseUrl;
    }
  }

  performPassiveAudit();

  return {
    isBot: () => isBotDetected,
    getReasons: () => botReasons,
    validateHumanInteraction,
    checkDatacenterIP,
    buildRedirectUrl
  };
})();
