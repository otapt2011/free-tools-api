/**
 * background-app.js – Thin UI integration for universal library.
 */
(function() {
  'use strict';
  if (typeof BackgroundMaker === 'undefined') {
    console.error('[sShot-app] BackgroundMaker not loaded.');
    return;
  }
  console.log('[sShot-app] Initializing UI with universal library.');

  // ----- DOM refs -----
  const el = {
    fileInput: document.getElementById('image-upload'),
    uploadArea: document.getElementById('upload-area-container'),
    previewPlaceholder: document.getElementById('preview-placeholder'),
    canvas: document.getElementById('result-canvas'),
    dragHint: document.getElementById('drag-hint'),
    padding: document.getElementById('padding'),
    cornerRadius: document.getElementById('corner-radius'),
    colorStart: document.getElementById('color-start'),
    colorEnd: document.getElementById('color-end'),
    gradientPreview: document.getElementById('gradient-preview'),
    aspectRatio: document.getElementById('aspect-ratio'),
    frameToggle: document.getElementById('browser-frame-toggle'),
    frameType: document.getElementById('frame-type'),
    resetBtn: document.getElementById('reset-btn'),
    resetPosBtn: document.getElementById('reset-position-btn'),
    downloadBtn: document.getElementById('download-btn'),
    copyBtn: document.getElementById('copy-btn'),
    postBtn: document.getElementById('post-btn'),
    usageInfo: document.getElementById('usage-info'),
    usageText: document.getElementById('usage-text'),
    authPrompt: document.getElementById('auth-prompt'),
    previewContainer: document.getElementById('preview-container'),
  };

  let maker = null, hasImage = false, fixedWidth = 0, fixedHeight = 0;
  const API_BASE = 'https://free-tools-api.vercel.app/api';

  // ----- Custom dialog (unchanged) -----
  function showDialog(message, title = 'Notice') {
    const existing = document.getElementById('custom-dialog-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-dialog-overlay';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity';
    overlay.style.animation = 'fadeIn 0.2s ease-out';
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 transform transition-all';
    card.style.animation = 'scaleIn 0.2s ease-out';
    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2';
    titleEl.innerHTML = `<i class="fas fa-info-circle text-blue-500"></i> ${title}`;
    const msgEl = document.createElement('p');
    msgEl.className = 'text-gray-700 dark:text-gray-300 mb-6';
    msgEl.textContent = message;
    const btn = document.createElement('button');
    btn.className = 'w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2';
    btn.innerHTML = '<i class="fas fa-check"></i> OK';
    btn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
    card.appendChild(titleEl); card.appendChild(msgEl); card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    setTimeout(() => btn.focus(), 50);
  }

  // ----- Theme sync -----
  function syncTheme() {
    if (!maker) return;
    const html = document.documentElement;
    const isDark = html.getAttribute('data-bs-theme') === 'dark' || html.classList.contains('dark');
    maker.setOptions({ frameColor: isDark ? 'dark' : 'light' });
  }

  // ----- Fit canvas to container (CSS only) -----
  function fitCanvasToContainer() {
    const canvas = el.canvas, container = el.previewContainer;
    if (!canvas || !container || !hasImage) return;
    const rect = container.getBoundingClientRect();
    const containerW = rect.width - 8, containerH = rect.height - 8;
    const canvasW = canvas.width, canvasH = canvas.height;
    if (canvasW === 0 || canvasH === 0) return;
    let scaleX = containerW / canvasW, scaleY = containerH / canvasH;
    let scale = Math.min(scaleX, scaleY);
    if (scale > 1) scale = 1;
    canvas.style.width = Math.round(canvasW * scale) + 'px';
    canvas.style.height = Math.round(canvasH * scale) + 'px';
  }

  // ----- Enable/disable controls -----
  function enableControls(enabled) {
    const controls = [el.padding, el.cornerRadius, el.aspectRatio, el.frameType, el.frameToggle, el.colorStart, el.colorEnd];
    controls.forEach(ctrl => {
      if (ctrl) {
        if (ctrl.type === 'checkbox' || ctrl.tagName === 'SELECT' || ctrl.type === 'color') ctrl.disabled = !enabled;
      }
    });
    if (el.gradientPreview) {
      if (enabled) {
        el.gradientPreview.classList.remove('opacity-50', 'cursor-not-allowed');
        el.gradientPreview.style.pointerEvents = 'auto';
      } else {
        el.gradientPreview.classList.add('opacity-50', 'cursor-not-allowed');
        el.gradientPreview.style.pointerEvents = 'none';
      }
    }
    if (el.resetPosBtn) {
      if (enabled) {
        el.resetPosBtn.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        el.resetPosBtn.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    updateFrameTypeState();
  }

  function updateFrameTypeState() {
    if (!el.frameToggle || !el.frameType) return;
    const isChecked = el.frameToggle.checked;
    const imageLoaded = hasImage;
    if (imageLoaded && isChecked) {
      el.frameType.disabled = false;
      el.frameType.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
    } else {
      el.frameType.disabled = true;
      el.frameType.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
    }
  }

  // ----- File upload -----
  function setupFileUpload() {
    const input = el.fileInput, area = el.uploadArea;
    if (!input || !area) return;
    input.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) handleFile(file); });
    area.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); area.classList.remove('dragover'); });
    area.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); area.classList.remove('dragover');
      const files = e.dataTransfer.files; if (files.length > 0) handleFile(files[0]);
    });
    if (el.previewContainer) {
      el.previewContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); if (area) area.classList.add('dragover'); });
      el.previewContainer.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (area) area.classList.remove('dragover'); });
      el.previewContainer.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); if (area) area.classList.remove('dragover');
        const files = e.dataTransfer.files; if (files.length > 0) handleFile(files[0]);
      });
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.match('image.*')) { showDialog('Please select an image file.', 'Invalid File'); return; }
    if (file.size > 10485760) { showDialog('File size must be less than 10MB.', 'File Too Large'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await maker.setImage(e.target.result);
        hasImage = true;
        maker.setOptions({
          padding: parseInt(el.padding.value, 10) || 20,
          cornerRadius: parseInt(el.cornerRadius.value, 10) || 8,
          gradientStart: el.colorStart.value,
          gradientEnd: el.colorEnd.value,
          aspectRatio: el.aspectRatio.value,
          frameEnabled: el.frameToggle.checked,
          frameType: el.frameType.value,
          imageOffsetX: 0, imageOffsetY: 0, frameOffsetX: 0, frameOffsetY: 0,
        });
        // Compute natural size (with padding) to set fixed canvas size
        const state = maker.getState();
        const layout = maker.renderer.computeLayout(state);
        fixedWidth = layout.canvasWidth;
        fixedHeight = layout.canvasHeight;
        el.canvas.width = fixedWidth;
        el.canvas.height = fixedHeight;
        el.canvas.style.width = fixedWidth + 'px';
        el.canvas.style.height = fixedHeight + 'px';
        showCanvas();
        maker.render();
        enableControls(true);
        enableButtons(true);
        requestAnimationFrame(() => fitCanvasToContainer());
      } catch (err) { console.error(err); showDialog('Failed to load image.', 'Error'); }
    };
    reader.readAsDataURL(file);
  }

  function showCanvas() {
    if (el.uploadArea) el.uploadArea.classList.add('hidden');
    if (el.previewPlaceholder) el.previewPlaceholder.classList.add('hidden');
    if (el.canvas) el.canvas.classList.remove('hidden');
    if (el.dragHint) el.dragHint.classList.remove('hidden');
    if (el.resetPosBtn) el.resetPosBtn.classList.remove('hidden');
  }

  // ----- Controls -----
  function setupControls() {
    const controls = [el.padding, el.cornerRadius, el.colorStart, el.colorEnd, el.aspectRatio, el.frameToggle, el.frameType];
    controls.forEach(ctrl => {
      if (ctrl) {
        ctrl.addEventListener('change', handleControlChange);
        if (ctrl.type === 'color') ctrl.addEventListener('input', handleControlChange);
      }
    });
    const toggle = el.frameToggle, frameSelect = el.frameType;
    if (toggle && frameSelect) {
      toggle.addEventListener('change', () => {
        if (toggle.checked) {
          frameSelect.disabled = false;
          frameSelect.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
          if (frameSelect.value === 'none') frameSelect.value = 'browser-chrome';
        } else {
          frameSelect.disabled = true;
          frameSelect.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
          frameSelect.value = 'none';
        }
        handleControlChange();
        updateFrameTypeState();
      });
      if (!toggle.checked) {
        frameSelect.disabled = true;
        frameSelect.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
        frameSelect.value = 'none';
      }
    }
    if (el.gradientPreview) {
      el.gradientPreview.addEventListener('click', handleGradientClick);
    }
  }

  function handleControlChange() {
    if (!maker || !hasImage) return;
    const options = {
      padding: parseInt(el.padding.value, 10) || 0,
      cornerRadius: parseInt(el.cornerRadius.value, 10) || 0,
      gradientStart: el.colorStart.value,
      gradientEnd: el.colorEnd.value,
      aspectRatio: el.aspectRatio.value,
      frameEnabled: el.frameToggle.checked,
      frameType: el.frameType.value,
    };
    maker.setOptions(options);
    maker.render();
    requestAnimationFrame(fitCanvasToContainer);
  }

  function handleGradientClick() {
    if (!maker || !hasImage) return;
    const angles = ['135deg', '45deg', '90deg', '0deg', '180deg', '270deg'];
    const state = maker.getState();
    let idx = angles.indexOf(state.gradientAngle);
    idx = (idx + 1) % angles.length;
    const newAngle = angles[idx];
    maker.setOptions({ gradientAngle: newAngle });
    if (el.gradientPreview) {
      el.gradientPreview.style.background = `linear-gradient(${newAngle}, ${state.gradientStart} 0%, ${state.gradientEnd} 100%)`;
    }
    maker.render();
    requestAnimationFrame(fitCanvasToContainer);
  }

  // ----- Canvas drag (unchanged) -----
  const dragState = { isDragging: false, isFrameDrag: false, startX: 0, startY: 0,
                      imageOffsetX: 0, imageOffsetY: 0, frameOffsetX: 0, frameOffsetY: 0 };
  function setupCanvasDrag() {
    const canvas = el.canvas;
    if (!canvas) return;
    canvas.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  function getCanvasCoords(e) {
    const canvas = el.canvas;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onMouseDown(e) {
    if (!hasImage) return;
    const pos = getCanvasCoords(e);
    const state = maker.getState();
    dragState.isDragging = true;
    dragState.isFrameDrag = e.shiftKey;
    dragState.startX = pos.x; dragState.startY = pos.y;
    dragState.imageOffsetX = state.imageOffsetX; dragState.imageOffsetY = state.imageOffsetY;
    dragState.frameOffsetX = state.frameOffsetX; dragState.frameOffsetY = state.frameOffsetY;
    el.canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!dragState.isDragging || !hasImage) return;
    const pos = getCanvasCoords(e);
    const dx = pos.x - dragState.startX, dy = pos.y - dragState.startY;
    let options = {};
    if (dragState.isFrameDrag) {
      options.frameOffsetX = dragState.frameOffsetX + dx;
      options.frameOffsetY = dragState.frameOffsetY + dy;
    } else {
      options.imageOffsetX = dragState.imageOffsetX + dx;
      options.imageOffsetY = dragState.imageOffsetY + dy;
    }
    maker.setOptions(options);
    maker.render();
  }

  function onMouseUp() {
    dragState.isDragging = false; dragState.isFrameDrag = false;
    if (el.canvas) el.canvas.style.cursor = 'move';
  }

  function onTouchStart(e) {
    if (!hasImage) return;
    const touch = e.touches[0], canvas = el.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const state = maker.getState();
    dragState.isDragging = true; dragState.isFrameDrag = false;
    dragState.startX = (touch.clientX - rect.left) * scaleX;
    dragState.startY = (touch.clientY - rect.top) * scaleY;
    dragState.imageOffsetX = state.imageOffsetX; dragState.imageOffsetY = state.imageOffsetY;
    e.preventDefault();
  }

  function onTouchMove(e) {
    if (!dragState.isDragging || !hasImage) return;
    const touch = e.touches[0], canvas = el.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX, y = (touch.clientY - rect.top) * scaleY;
    const dx = x - dragState.startX, dy = y - dragState.startY;
    maker.setOptions({
      imageOffsetX: dragState.imageOffsetX + dx,
      imageOffsetY: dragState.imageOffsetY + dy
    });
    maker.render();
    e.preventDefault();
  }

  function onTouchEnd() { dragState.isDragging = false; }

  // ----- Buttons -----
  function setupButtons() {
    if (el.resetBtn) el.resetBtn.addEventListener('click', handleReset);
    if (el.resetPosBtn) el.resetPosBtn.addEventListener('click', handleResetPosition);
    if (el.downloadBtn) el.downloadBtn.addEventListener('click', handleDownload);
    if (el.copyBtn) el.copyBtn.addEventListener('click', handleCopy);
    if (el.postBtn) el.postBtn.addEventListener('click', handlePost);
  }

  function handleReset() {
    if (!maker) return;
    maker.reset();
    hasImage = false;
    fixedWidth = 0; fixedHeight = 0;
    if (el.padding) el.padding.value = '20';
    if (el.cornerRadius) el.cornerRadius.value = '8';
    if (el.colorStart) el.colorStart.value = '#667eea';
    if (el.colorEnd) el.colorEnd.value = '#764ba2';
    if (el.aspectRatio) el.aspectRatio.value = 'custom';
    if (el.frameToggle) el.frameToggle.checked = false;
    if (el.frameType) {
      el.frameType.value = 'none';
      el.frameType.disabled = true;
      el.frameType.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
    }
    updateGradientPreview();
    if (el.canvas) el.canvas.classList.add('hidden');
    if (el.uploadArea) el.uploadArea.classList.remove('hidden');
    if (el.previewPlaceholder) el.previewPlaceholder.classList.remove('hidden');
    if (el.dragHint) el.dragHint.classList.add('hidden');
    if (el.resetPosBtn) el.resetPosBtn.classList.add('hidden');
    enableButtons(false);
    enableControls(false);
    const ctx = el.canvas.getContext('2d');
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    el.canvas.style.width = '';
    el.canvas.style.height = '';
  }

  function handleResetPosition() {
    if (!maker || !hasImage) return;
    maker.setOptions({ imageOffsetX: 0, imageOffsetY: 0, frameOffsetX: 0, frameOffsetY: 0 });
    maker.render();
  }

  // ----- Export (unchanged) -----
  async function handleDownload() {
    if (!maker || !hasImage) return;
    const allowed = await checkRateLimit('download');
    if (!allowed) return;
    const blob = await maker.toBlob('image/png');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'screenshot-with-background.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!maker || !hasImage) return;
    const allowed = await checkRateLimit('copy');
    if (!allowed) return;
    try {
      const blob = await maker.toBlob('image/png');
      await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
      const btn = el.copyBtn;
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      }
    } catch (e) { showDialog('Failed to copy. Please use Download.', 'Copy Error'); }
  }

  function handlePost() {
    if (!hasImage) return;
    const postUrl = el.postBtn.getAttribute('data-post-url') || '/users/sign_up';
    window.location.href = postUrl;
  }

  // ----- Rate limit -----
  async function checkRateLimit(action) {
    const endpoint = `${API_BASE}/free-tools/screenshot-background${action === 'download' ? '-download' : action === 'copy' ? '-copy' : ''}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        credentials: 'same-origin'
      });
      const data = await response.json();
      if (response.status === 429 || !data.success) {
        if (data.usage_info) updateUsageInfo(data.usage_info);
        showDialog(data.message || 'Daily limit reached. Sign in for higher limits.', 'Limit Reached');
        return false;
      }
      if (data.usage_info) updateUsageInfo(data.usage_info);
      return true;
    } catch (e) { console.error('Rate limit error:', e); showDialog('An error occurred. Please try again.', 'Error'); return false; }
  }

  function updateUsageInfo(info) {
    const container = el.usageInfo, text = el.usageText, auth = el.authPrompt;
    if (!container) return;
    if (info.remaining_requests > 0) {
      container.classList.add('hidden');
    } else {
      container.classList.remove('hidden');
      if (text) text.textContent = 'You have reached your daily limit for this tool.';
      if (auth) {
        if (info.is_authenticated) auth.classList.add('hidden');
        else auth.classList.remove('hidden');
      }
    }
  }

  async function loadUsageInfo() {
    try {
      const endpoint = `${API_BASE}/free-tools/screenshot-background`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      const data = await response.json();
      if (data.usage_info) updateUsageInfo(data.usage_info);
    } catch (e) { console.error('Error loading usage info:', e); }
  }

  function updateGradientPreview() {
    if (!maker) return;
    const state = maker.getState();
    if (el.gradientPreview) {
      el.gradientPreview.style.background = `linear-gradient(${state.gradientAngle}, ${state.gradientStart} 0%, ${state.gradientEnd} 100%)`;
    }
  }

  function enableButtons(enabled) {
    const btns = [el.downloadBtn, el.copyBtn, el.postBtn];
    btns.forEach(btn => { if (btn) btn.disabled = !enabled; });
  }

  // ----- Init -----
  function init() {
    if (!el.canvas) return;
    // Create maker with fixedSize: true and roundingMode: 'image'
    maker = new BackgroundMaker(el.canvas, {
      fixedSize: true,
      roundingMode: 'image',
      paddingMode: 'margin'
    });
    enableControls(false);
    enableButtons(false);
    setupFileUpload();
    setupControls();
    setupCanvasDrag();
    setupButtons();
    syncTheme();
    const observer = new MutationObserver(() => {
      syncTheme();
      if (hasImage) maker.render();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-bs-theme'] });
    if (el.previewContainer) {
      const resizeObserver = new ResizeObserver(() => {
        if (hasImage) fitCanvasToContainer();
      });
      resizeObserver.observe(el.previewContainer);
    }
    window.addEventListener('resize', () => {
      if (hasImage) fitCanvasToContainer();
    });
    loadUsageInfo();
    maker.render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();