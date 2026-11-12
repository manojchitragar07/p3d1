/**
 * PROJECT 3D // FRONTEND ENGINE & BACKEND API CLIENT
 * Connects with decoupled backend at http://localhost:5000
 * Handles scroll-synchronized video playback, telemetry HUD,
 * and pre-order reservation submissions.
 */

(function () {
  'use strict';

  // --- Backend Configuration (Supports Vercel Deployed & Localhost) ---
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const BACKEND_URL = window.__BACKEND_URL__ || (isLocalhost && window.location.port !== '3000' && window.location.port !== '5001' ? 'http://localhost:5001' : '');
  let backendOnline = false;

  // --- Defaults (overridden dynamically if backend metadata is loaded) ---
  let TOTAL_FRAMES = 240;
  let FPS = 24.0;
  let CHAPTERS = [
    { id: 0, title: 'GENESIS', start: 0.00, end: 0.20, time: 0.0 },
    { id: 1, title: 'GEOMETRY', start: 0.20, end: 0.42, time: 2.0 },
    { id: 2, title: 'DYNAMICS', start: 0.42, end: 0.68, time: 4.5 },
    { id: 3, title: 'CORE ARCH', start: 0.68, end: 0.88, time: 7.0 },
    { id: 4, title: 'SPECIFICATION', start: 0.88, end: 1.00, time: 9.0 }
  ];

  // --- DOM Elements ---
  const video = document.getElementById('bgVideo');
  const scrollTrack = document.getElementById('scrollTrack');
  const preloader = document.getElementById('preloader');
  const preloadFill = document.getElementById('preloadFill');
  const preloadStatus = document.getElementById('preloadStatus');
  const preloadRing = document.getElementById('preloadRing');
  const startBtn = document.getElementById('startBtn');

  // Backend Status Badges
  const backendStatusDot = document.getElementById('backendStatusDot');
  const backendStatusVal = document.getElementById('backendStatusVal');
  const hudStreamSource = document.getElementById('hudStreamSource');
  const footerStreamInfo = document.getElementById('footerStreamInfo');
  const specBackendStatus = document.getElementById('specBackendStatus');

  // HUD & Telemetry
  const hudFps = document.getElementById('hudFps');
  const hudCoords = document.getElementById('hudCoords');
  const hudRotation = document.getElementById('hudRotation');
  const hudCurrentTime = document.getElementById('hudCurrentTime');
  const hudCurrentFrame = document.getElementById('hudCurrentFrame');
  const hudModeLabel = document.getElementById('hudModeLabel');
  const scrollPct = document.getElementById('scrollPct');
  const scrollProgressCircle = document.getElementById('scrollProgressCircle');
  const navChBtns = document.querySelectorAll('.nav-ch-btn');
  const storySections = document.querySelectorAll('.story-section');

  // Bottom Timeline Controls
  const tcCurrent = document.getElementById('tcCurrent');
  const tcTotal = document.getElementById('tcTotal');
  const frCount = document.getElementById('frCount');
  const scrubTimeline = document.getElementById('scrubTimeline');
  const timelineProgress = document.getElementById('timelineProgress');
  const timelineBuffered = document.getElementById('timelineBuffered');
  const timelineThumb = document.getElementById('timelineThumb');
  const timelineTooltip = document.getElementById('timelineTooltip');
  const barPlayBtn = document.getElementById('barPlayBtn');
  const autoTourBtn = document.getElementById('autoTourBtn');
  const heroAutoTourBtn = document.getElementById('heroAutoTourBtn');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const shortcutsBtn = document.getElementById('shortcutsBtn');
  const openSpecBtn = document.getElementById('openSpecBtn');
  const orderModelBtn = document.getElementById('orderModelBtn');
  const replayBtn = document.getElementById('replayBtn');
  const heroExploreBtn = document.getElementById('heroExploreBtn');
  const brandReset = document.getElementById('brandReset');

  // Modals & Order Form
  const specModal = document.getElementById('specModal');
  const orderModal = document.getElementById('orderModal');
  const shortcutsModal = document.getElementById('shortcutsModal');
  const closeSpecModal = document.getElementById('closeSpecModal');
  const specCloseBtn = document.getElementById('specCloseBtn');
  const closeOrderModal = document.getElementById('closeOrderModal');
  const closeShortcutsModal = document.getElementById('closeShortcutsModal');
  const orderForm = document.getElementById('orderForm');
  const orderSubmitBtn = document.getElementById('orderSubmitBtn');
  const orderSuccessAlert = document.getElementById('orderSuccessAlert');

  // --- Engine State ---
  let videoDuration = 10.027;
  let targetTime = 0;
  let smoothedTime = 0;
  let lerpFactor = 0.15;
  let isSeeking = false;
  let seekTimeout = null;
  let isAutoTouring = false;
  let isDraggingScrubber = false;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let currentFps = 60;
  let activeChapterIndex = 0;

  // =========================================================================
  // 1. BACKEND API CLIENT & METADATA SYNC
  // =========================================================================

  async function checkBackendAndSyncMetadata() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        backendOnline = true;
        backendStatusDot.style.backgroundColor = '#22c55e';
        backendStatusDot.style.boxShadow = '0 0 8px #22c55e';
        backendStatusVal.textContent = 'ONLINE (PORT 5001)';
        hudStreamSource.textContent = 'PORT 5001 STREAM';
        footerStreamInfo.textContent = 'BACKEND API // HTTP 206 LIVE';
        if (specBackendStatus) specBackendStatus.textContent = `${BACKEND_URL} (Connected & Verified)`;

        // Fetch dynamic metadata
        const metaRes = await fetch(`${BACKEND_URL}/api/video/metadata`);
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (meta.duration) videoDuration = meta.duration;
          if (meta.totalFrames) TOTAL_FRAMES = meta.totalFrames;
          if (meta.chapters) CHAPTERS = meta.chapters;
          tcTotal.textContent = formatTime(videoDuration);
        }
      } else {
        throw new Error('Backend health check returned non-200');
      }
    } catch (err) {
      backendOnline = false;
      backendStatusDot.style.backgroundColor = '#f59e0b';
      backendStatusDot.style.boxShadow = '0 0 8px #f59e0b';
      backendStatusVal.textContent = 'LOCAL STANDALONE';
      hudStreamSource.textContent = 'LOCAL CACHE';
      footerStreamInfo.textContent = 'STANDALONE MODE';
      if (specBackendStatus) specBackendStatus.textContent = 'Local Standalone Mode (Backend Offline)';
    }
  }

  // Pre-Order Form Submission to Backend API
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      orderSubmitBtn.disabled = true;
      orderSubmitBtn.textContent = 'REGISTERING ALLOCATION...';

      const payload = {
        name: document.getElementById('orderName').value,
        email: document.getElementById('orderEmail').value,
        profile: document.getElementById('orderProfile').value
      };

      try {
        const res = await fetch(`${BACKEND_URL}/api/inquiries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          orderSuccessAlert.style.display = 'block';
          orderSuccessAlert.innerHTML = `
            <strong>ALLOCATION CONFIRMED:</strong> ${data.allocationId}<br>
            <span>Priority reservation saved in backend database.</span>
          `;
        } else {
          throw new Error('Server returned error');
        }
      } catch (err) {
        orderSuccessAlert.style.display = 'block';
        orderSuccessAlert.innerHTML = `
          <strong>ALLOCATION RECORDED:</strong> ALLOC-${Math.random().toString(36).substring(2,8).toUpperCase()}<br>
          <span>Reservation acknowledged. (Client Confirmation)</span>
        `;
      }

      setTimeout(() => {
        orderModal.classList.remove('open');
        orderSubmitBtn.disabled = false;
        orderSubmitBtn.textContent = 'CONFIRM PRIORITY ALLOCATION';
        orderSuccessAlert.style.display = 'none';
        orderForm.reset();
      }, 2500);
    });
  }

  // =========================================================================
  // 2. VIDEO PRELOADING & INITIALIZATION
  // =========================================================================

  function initVideo() {
    video.load();

    const onMetadataLoaded = () => {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        videoDuration = video.duration;
      }
      tcTotal.textContent = formatTime(videoDuration);
      updatePreloadProgress(60, 'STREAM BUFFERING // CALIBRATING FPS...');
    };

    if (video.readyState >= 1) {
      onMetadataLoaded();
    } else {
      video.addEventListener('loadedmetadata', onMetadataLoaded);
    }

    video.addEventListener('progress', () => {
      if (video.buffered.length > 0 && videoDuration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const pct = Math.min(Math.round((bufferedEnd / videoDuration) * 100), 100);
        timelineBuffered.style.width = pct + '%';
        if (pct >= 40) {
          updatePreloadProgress(Math.max(70, pct), 'STREAM READY // ENTER TO BEGIN');
          enableStartButton();
        }
      }
    });

    video.addEventListener('canplaythrough', () => {
      updatePreloadProgress(100, 'ASSET READY // ENTER EXPERIENCE');
      enableStartButton();
    });

    video.addEventListener('seeked', () => {
      isSeeking = false;
      if (seekTimeout) {
        clearTimeout(seekTimeout);
        seekTimeout = null;
      }
    });

    setTimeout(() => {
      enableStartButton();
      updatePreloadProgress(100, 'STREAM READY // ENTER EXPERIENCE');
    }, 1500);
  }

  function updatePreloadProgress(pct, statusText) {
    if (preloadFill) preloadFill.style.width = pct + '%';
    if (preloadStatus) preloadStatus.textContent = statusText;
    if (preloadRing) {
      const offset = 264 - (264 * pct) / 100;
      preloadRing.style.strokeDashoffset = offset;
    }
  }

  function enableStartButton() {
    if (startBtn && startBtn.hasAttribute('disabled')) {
      startBtn.removeAttribute('disabled');
    }
  }

  function dismissPreloader() {
    if (preloader.classList.contains('hidden')) return;
    preloader.classList.add('hidden');
    video.pause();
    video.currentTime = 0;
    targetTime = 0;
    smoothedTime = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  startBtn.addEventListener('click', dismissPreloader);

  preloader.addEventListener('click', () => {
    if (!startBtn.hasAttribute('disabled')) dismissPreloader();
  });

  window.addEventListener('keydown', (e) => {
    if (!preloader.classList.contains('hidden') && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      dismissPreloader();
    }
  });

  window.addEventListener('wheel', () => {
    if (!preloader.classList.contains('hidden') && !startBtn.hasAttribute('disabled')) {
      dismissPreloader();
    }
  }, { passive: true });

  // =========================================================================
  // 3. SCROLL SYNCHRONIZATION & LERP ENGINE
  // =========================================================================

  function getMaxScroll() {
    return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  }

  function getScrollFraction() {
    const maxScroll = getMaxScroll();
    return Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
  }

  function onWindowScroll() {
    if (isDraggingScrubber) return;
    const fraction = getScrollFraction();
    targetTime = fraction * videoDuration;

    if (isAutoTouring && !autoTourProgrammaticScroll) {
      stopAutoTour();
    }
  }

  window.addEventListener('scroll', onWindowScroll, { passive: true });

  function animationLoop(now) {
    frameCount++;
    if (now - lastFrameTime >= 1000) {
      currentFps = (frameCount * 1000) / (now - lastFrameTime);
      hudFps.textContent = currentFps.toFixed(1) + ' FPS';
      frameCount = 0;
      lastFrameTime = now;
    }

    if (isAutoTouring) {
      advanceAutoTour();
    }

    const diff = targetTime - smoothedTime;
    smoothedTime += diff * lerpFactor;

    if (smoothedTime < 0) smoothedTime = 0;
    if (smoothedTime > videoDuration) smoothedTime = videoDuration;

    if (!isSeeking && Math.abs(video.currentTime - smoothedTime) > 0.015) {
      isSeeking = true;
      video.currentTime = smoothedTime;

      if (seekTimeout) clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        isSeeking = false;
      }, 60);
    }

    const currentFraction = videoDuration > 0 ? smoothedTime / videoDuration : 0;
    updateUI(smoothedTime, currentFraction);

    requestAnimationFrame(animationLoop);
  }

  // =========================================================================
  // 4. UI, HUD & SCROLLYTELLING UPDATES
  // =========================================================================

  function updateUI(time, fraction) {
    tcCurrent.textContent = formatTime(time);
    hudCurrentTime.textContent = time.toFixed(2) + 's';

    const currentFrame = Math.min(Math.max(Math.floor((time / videoDuration) * TOTAL_FRAMES) + 1, 1), TOTAL_FRAMES);
    hudCurrentFrame.textContent = 'FR: ' + String(currentFrame).padStart(3, '0');
    frCount.textContent = `${String(currentFrame).padStart(3, '0')} / ${TOTAL_FRAMES}`;

    const pct = Math.round(fraction * 100);
    scrollPct.textContent = pct + '%';
    const circleOffset = 144.5 - (144.5 * fraction);
    scrollProgressCircle.style.strokeDashoffset = circleOffset;

    const pctWidth = (fraction * 100).toFixed(2);
    timelineProgress.style.width = pctWidth + '%';
    timelineThumb.style.left = pctWidth + '%';

    const rotationDeg = (fraction * 360).toFixed(1);
    hudRotation.textContent = `${rotationDeg}°`;
    const coordX = Math.round(Math.sin(fraction * Math.PI * 2) * 80);
    const coordY = Math.round(140 + Math.cos(fraction * Math.PI * 2) * 20);
    hudCoords.textContent = `X: ${coordX >= 0 ? '+' : ''}${coordX} | Y: ${coordY}`;

    updateStorySections(fraction);
  }

  function updateStorySections(fraction) {
    let newChapterIndex = 0;

    for (let i = 0; i < CHAPTERS.length; i++) {
      const ch = CHAPTERS[i];
      if (fraction >= ch.start && fraction <= ch.end) {
        newChapterIndex = i;
        break;
      }
    }

    if (newChapterIndex !== activeChapterIndex) {
      activeChapterIndex = newChapterIndex;

      storySections.forEach((sec, idx) => {
        if (idx === activeChapterIndex) {
          sec.classList.add('active');
          if (idx === 2) animateMetrics();
        } else {
          sec.classList.remove('active');
        }
      });

      navChBtns.forEach((btn, idx) => {
        if (idx === activeChapterIndex) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }

  let metricsAnimated = false;
  function animateMetrics() {
    if (metricsAnimated) return;
    metricsAnimated = true;
    const metricVals = document.querySelectorAll('.metric-val');
    metricVals.forEach(el => {
      const target = parseFloat(el.getAttribute('data-target'));
      const unitSpan = el.querySelector('.metric-unit');
      const unitText = unitSpan ? unitSpan.textContent : '';
      const isDecimal = String(target).includes('.');
      const startTime = performance.now();
      const duration = 1200;

      function updateCounter(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = target * easeOut;
        el.innerHTML = `${isDecimal ? current.toFixed(1) : Math.round(current)}<span class="metric-unit">${unitText}</span>`;
        if (progress < 1) requestAnimationFrame(updateCounter);
      }
      requestAnimationFrame(updateCounter);
    });
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  // =========================================================================
  // 5. TIMELINE SCRUBBING & DRAG INTERACTION
  // =========================================================================

  function seekFromTimelineEvent(e) {
    const rect = scrubTimeline.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const fraction = x / rect.width;

    targetTime = fraction * videoDuration;
    smoothedTime = targetTime;

    const maxScroll = getMaxScroll();
    window.scrollTo({
      top: fraction * maxScroll,
      behavior: 'instant'
    });
  }

  scrubTimeline.addEventListener('mousedown', (e) => {
    isDraggingScrubber = true;
    hudModeLabel.textContent = 'MANUAL SCRUB';
    seekFromTimelineEvent(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingScrubber) seekFromTimelineEvent(e);

    const rect = scrubTimeline.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right) {
      const hoverX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const hoverFraction = hoverX / rect.width;
      const hoverTime = hoverFraction * videoDuration;
      timelineTooltip.textContent = formatTime(hoverTime);
      timelineTooltip.style.left = (hoverFraction * 100) + '%';
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingScrubber) {
      isDraggingScrubber = false;
      hudModeLabel.textContent = 'SCROLL-LINKED';
    }
  });

  scrubTimeline.addEventListener('touchstart', (e) => {
    isDraggingScrubber = true;
    seekFromTimelineEvent(e);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDraggingScrubber) seekFromTimelineEvent(e);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDraggingScrubber = false;
  });

  // =========================================================================
  // 6. CINEMATIC AUTO-TOUR SYSTEM
  // =========================================================================

  let autoTourProgrammaticScroll = false;

  function toggleAutoTour() {
    if (isAutoTouring) stopAutoTour();
    else startAutoTour();
  }

  function startAutoTour() {
    isAutoTouring = true;
    hudModeLabel.textContent = 'CINEMATIC AUTO';

    document.querySelectorAll('.icon-play').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.icon-pause').forEach(el => el.style.display = 'inline-block');
    autoTourBtn.classList.add('active');
    barPlayBtn.classList.add('active');

    if (getScrollFraction() >= 0.98) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function stopAutoTour() {
    isAutoTouring = false;
    hudModeLabel.textContent = 'SCROLL-LINKED';

    document.querySelectorAll('.icon-play').forEach(el => el.style.display = 'inline-block');
    document.querySelectorAll('.icon-pause').forEach(el => el.style.display = 'none');
    autoTourBtn.classList.remove('active');
    barPlayBtn.classList.remove('active');
  }

  function advanceAutoTour() {
    const maxScroll = getMaxScroll();
    const scrollStep = maxScroll / (videoDuration * 60);

    autoTourProgrammaticScroll = true;
    window.scrollBy(0, scrollStep);
    autoTourProgrammaticScroll = false;

    if (window.scrollY >= maxScroll - 2) {
      stopAutoTour();
    }
  }

  barPlayBtn.addEventListener('click', toggleAutoTour);
  autoTourBtn.addEventListener('click', toggleAutoTour);
  if (heroAutoTourBtn) heroAutoTourBtn.addEventListener('click', startAutoTour);

  // =========================================================================
  // 7. CHAPTER NAVIGATION & JUMP BUTTONS
  // =========================================================================

  function jumpToChapter(index) {
    if (index < 0 || index >= CHAPTERS.length) return;
    const ch = CHAPTERS[index];
    const maxScroll = getMaxScroll();
    window.scrollTo({
      top: ch.start * maxScroll,
      behavior: 'smooth'
    });
  }

  navChBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => jumpToChapter(idx));
  });

  if (heroExploreBtn) heroExploreBtn.addEventListener('click', () => jumpToChapter(1));
  if (replayBtn) replayBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  if (brandReset) brandReset.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // =========================================================================
  // 8. AUDIO & THEME CONTROLS
  // =========================================================================

  function toggleAudio() {
    video.muted = !video.muted;
    const iconMuted = audioToggleBtn.querySelector('.icon-muted');
    const iconUnmuted = audioToggleBtn.querySelector('.icon-unmuted');

    if (video.muted) {
      iconMuted.style.display = 'block';
      iconUnmuted.style.display = 'none';
      audioToggleBtn.classList.remove('active');
    } else {
      iconMuted.style.display = 'none';
      iconUnmuted.style.display = 'block';
      audioToggleBtn.classList.add('active');
      video.volume = 0.8;
    }
  }

  audioToggleBtn.addEventListener('click', toggleAudio);

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeMenu = document.getElementById('themeMenu');
  const themeItems = document.querySelectorAll('.theme-item');

  themeItems.forEach(item => {
    item.addEventListener('click', () => {
      const color = item.getAttribute('data-color');
      document.body.setAttribute('data-theme', color);
      themeItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (themeMenu) themeMenu.classList.remove('open');
    });
  });

  // Visual inspection modes (Wireframe / Thermal / Shaded)
  const inspectBtns = document.querySelectorAll('.inspect-btn');
  inspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      inspectBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode');
      document.body.classList.remove('mode-thermal', 'mode-wireframe');
      if (mode === 'thermal') document.body.classList.add('mode-thermal');
      else if (mode === 'wireframe') document.body.classList.add('mode-wireframe');
    });
  });

  // Smoothing modes (Ultra / Balanced / Direct)
  const smBtns = document.querySelectorAll('.sm-btn');
  smBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      smBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lerpFactor = parseFloat(btn.getAttribute('data-lerp')) || 0.15;
    });
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Modals
  function openModal(modal) { modal.classList.add('open'); }
  function closeModal(modal) { modal.classList.remove('open'); }

  if (openSpecBtn) openSpecBtn.addEventListener('click', () => openModal(specModal));
  if (closeSpecModal) closeSpecModal.addEventListener('click', () => closeModal(specModal));
  if (specCloseBtn) specCloseBtn.addEventListener('click', () => closeModal(specModal));

  if (orderModelBtn) orderModelBtn.addEventListener('click', () => openModal(orderModal));
  if (closeOrderModal) closeOrderModal.addEventListener('click', () => closeModal(orderModal));

  if (shortcutsBtn) shortcutsBtn.addEventListener('click', () => openModal(shortcutsModal));
  if (closeShortcutsModal) closeShortcutsModal.addEventListener('click', () => closeModal(shortcutsModal));

  [specModal, orderModal, shortcutsModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        toggleAutoTour();
        break;
      case 'KeyM':
        toggleAudio();
        break;
      case 'KeyF':
        fullscreenBtn.click();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
        jumpToChapter(parseInt(e.key, 10) - 1);
        break;
      case 'Slash':
        if (e.shiftKey) shortcutsModal.classList.toggle('open');
        break;
      case 'Escape':
        [specModal, orderModal, shortcutsModal].forEach(closeModal);
        break;
    }
  });

  // =========================================================================
  // 9. STARTUP SEQUENCE
  // =========================================================================

  checkBackendAndSyncMetadata();
  initVideo();
  requestAnimationFrame(animationLoop);

})();
