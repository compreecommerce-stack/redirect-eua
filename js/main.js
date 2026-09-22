(function() {
  'use strict';

  const verificationView = document.getElementById('verification-view');
  const safePageView = document.getElementById('safe-page-view');
  const recaptchaBox = document.getElementById('recaptcha-box');
  const statusEl = document.getElementById('verification-status');
  const secTitleEl = document.getElementById('sec-title');
  const secSubtitleEl = document.getElementById('sec-subtitle');
  const captchaLabelEl = document.getElementById('captcha-label');

  let isVerifying = false;
  let isVerified = false;

  function initConfig() {
    if (typeof PRESELL_CONFIG === 'undefined') return;

    if (PRESELL_CONFIG.security) {
      if (secTitleEl) secTitleEl.textContent = PRESELL_CONFIG.security.heading || 'Security Verification';
      if (secSubtitleEl) secSubtitleEl.textContent = PRESELL_CONFIG.security.subheading || 'Please verify that you are a human to continue.';
      if (captchaLabelEl) captchaLabelEl.textContent = PRESELL_CONFIG.security.checkboxLabel || "I'm not a robot";
    }

    if (PRESELL_CONFIG.safePage) {
      const safeTitle = document.getElementById('safe-title');
      const safeDate = document.getElementById('safe-date');
      const safeReading = document.getElementById('safe-reading');
      const safeBody = document.getElementById('safe-body');

      if (safeTitle) safeTitle.textContent = PRESELL_CONFIG.safePage.title;
      if (safeDate) safeDate.textContent = PRESELL_CONFIG.safePage.date;
      if (safeReading) safeReading.textContent = PRESELL_CONFIG.safePage.readingTime;
      if (safeBody) safeBody.innerHTML = PRESELL_CONFIG.safePage.content;
    }

    initTikTokPixel(PRESELL_CONFIG.tiktokPixelId);
  }

  function initTikTokPixel(pixelId) {
    if (!pixelId || pixelId.trim() === '') return;

    try {
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load(pixelId);
        ttq.page();
      }(window, document, 'ttq');
    } catch (e) {}
  }

  function trackEvent(eventName, params = {}) {
    if (window.ttq && typeof window.ttq.track === 'function') {
      try {
        window.ttq.track(eventName, params);
      } catch (e) {}
    }
  }

  function activateSafePage() {
    if (verificationView) verificationView.style.display = 'none';
    if (safePageView) safePageView.style.display = 'block';
    document.title = PRESELL_CONFIG.safePage?.title || 'Security & Compliance Standards';
  }

  async function handleVerification(event) {
    if (isVerifying || isVerified) return;

    const humanCheck = AntiBot.validateHumanInteraction(event);
    if (!humanCheck.isHuman) {
      if (PRESELL_CONFIG.security?.showSafePageForBots) {
        activateSafePage();
      } else {
        showStatus('Verification failed.', 'error');
      }
      return;
    }

    isVerifying = true;
    recaptchaBox.classList.add('is-checking');
    showStatus(PRESELL_CONFIG.security?.verifyingText || 'Verifying...', '');

    trackEvent('ViewContent', { content_name: 'Captcha_Verified' });

    const verificationDelay = PRESELL_CONFIG.redirectDelayMs || 900;

    setTimeout(() => {
      isVerifying = false;
      isVerified = true;
      recaptchaBox.classList.remove('is-checking');
      recaptchaBox.classList.add('is-verified');
      showStatus(PRESELL_CONFIG.security?.successText || 'Verified! Redirecting...', 'success');

      trackEvent('ClickButton', { content_name: 'Captcha_Passed' });

      const finalDestination = AntiBot.buildRedirectUrl(PRESELL_CONFIG.destinationUrl);

      setTimeout(() => {
        window.location.href = finalDestination;
      }, 400);

    }, verificationDelay);
  }

  function showStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'verification-status';
    if (type) statusEl.classList.add(type);
  }

  async function runSecurityAudit() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('safe') === '1' || urlParams.get('preview') === 'safe') {
      activateSafePage();
      return;
    }

    if (AntiBot.isBot()) {
      if (PRESELL_CONFIG.security?.showSafePageForBots) {
        activateSafePage();
        return;
      }
    }

    if (PRESELL_CONFIG.security?.enableIpDatacenterCheck) {
      AntiBot.checkDatacenterIP().then(result => {
        if (result.isBot && PRESELL_CONFIG.security?.showSafePageForBots) {
          activateSafePage();
        }
      });
    }
  }

  function initListeners() {
    if (!recaptchaBox) return;

    recaptchaBox.addEventListener('click', (e) => {
      handleVerification(e);
    });

    recaptchaBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleVerification(e);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initConfig();
    initListeners();
    runSecurityAudit();
  });

})();
