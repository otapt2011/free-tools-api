/**
 * background-maker.js – Universal screenshot background library.
 * Supports fixed canvas, padding as margins, image‑only rounding.
 */
(function() {
  'use strict';
  console.log('[BackgroundMaker] Library script executed.');

  // ===========================
  // 1. STATE
  // ===========================
  class EditorState {
    constructor() {
      this.image = null;
      this.imageWidth = 0;
      this.imageHeight = 0;
      this.padding = 20;
      this.cornerRadius = 8;
      this.gradientStart = '#667eea';
      this.gradientEnd = '#764ba2';
      this.gradientAngle = '135deg';
      this.aspectRatio = 'custom';
      this.frameEnabled = false;
      this.frameType = 'none';
      this.frameScale = 1.0;
      this.frameColor = 'light';
      this.imageOffsetX = 0;
      this.imageOffsetY = 0;
      this.frameOffsetX = 0;
      this.frameOffsetY = 0;
      this.canvasWidth = 0;
      this.canvasHeight = 0;
    }
    clone() {
      const s = new EditorState();
      Object.assign(s, this);
      return s;
    }
    resetOptions() {
      this.padding = 20;
      this.cornerRadius = 8;
      this.gradientStart = '#667eea';
      this.gradientEnd = '#764ba2';
      this.gradientAngle = '135deg';
      this.aspectRatio = 'custom';
      this.frameEnabled = false;
      this.frameType = 'none';
      this.frameScale = 1.0;
      this.frameColor = 'light';
      this.imageOffsetX = 0;
      this.imageOffsetY = 0;
      this.frameOffsetX = 0;
      this.frameOffsetY = 0;
    }
  }

  // ===========================
  // 2. RENDERER (universal)
  // ===========================
  class Renderer {
    constructor(ctx, options = {}) {
      this.ctx = ctx;
      // Options
      this.fixedSize = options.fixedSize || false;
      this.roundingMode = options.roundingMode || 'image'; // 'image' or 'all'
      this.paddingMode = options.paddingMode || 'margin';  // 'expand' or 'margin'
    }

    // ----- Main render entry -----
    render(state) {
      const ctx = this.ctx;
      const { image, padding, cornerRadius, gradientStart, gradientEnd, gradientAngle,
              aspectRatio, frameEnabled, frameType, frameScale, frameColor,
              imageOffsetX, imageOffsetY, frameOffsetX, frameOffsetY } = state;
      if (!image || !ctx) return;

      // --- If NOT fixed size: use standard rendering (canvas resizes) ---
      if (!this.fixedSize) {
        this.renderStandard(state);
        return;
      }

      // --- Fixed size mode: canvas is already sized, draw with margins ---
      const canvas = ctx.canvas;
      const W = canvas.width;
      const H = canvas.height;
      const innerX = padding;
      const innerY = padding;
      const innerW = W - 2 * padding;
      const innerH = H - 2 * padding;
      if (innerW <= 0 || innerH <= 0) {
        console.warn('[BackgroundMaker] Padding too large, inner area zero.');
        return;
      }

      // 1. Clear and draw background (full canvas, no rounding)
      ctx.clearRect(0, 0, W, H);
      const grad = this.createGradient(ctx, W, H, gradientStart, gradientEnd, gradientAngle);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 2. Draw frame if enabled (full canvas)
      if (frameEnabled && frameType !== 'none') {
        ctx.save();
        ctx.translate(frameOffsetX, frameOffsetY);
        this.drawFrame(ctx, frameType, 0, 0, W, H, frameScale, frameColor);
        ctx.restore();
      }

      // 3. Draw image inside inner rectangle with optional rounding
      const imgW = image.width;
      const imgH = image.height;

      // Compute crop for aspect ratio
      let targetRatio = null;
      if (aspectRatio !== 'custom') {
        const parts = aspectRatio.split(':').map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
          targetRatio = parts[0] / parts[1];
        }
      }
      let cropX = 0, cropY = 0, cropW = imgW, cropH = imgH;
      if (targetRatio) {
        const currentRatio = imgW / imgH;
        if (currentRatio > targetRatio) {
          cropW = imgH * targetRatio;
          cropX = (imgW - cropW) / 2;
        } else {
          cropH = imgW / targetRatio;
          cropY = (imgH - cropH) / 2;
        }
      }

      const drawW = cropW;
      const drawH = cropH;
      const scaleX = innerW / drawW;
      const scaleY = innerH / drawH;
      const scale = Math.min(scaleX, scaleY);
      const finalW = drawW * scale;
      const finalH = drawH * scale;
      const dx = innerX + (innerW - finalW) / 2 + imageOffsetX;
      const dy = innerY + (innerH - finalH) / 2 + imageOffsetY;

      ctx.save();
      if (cornerRadius > 0 && this.roundingMode === 'image') {
        const radius = Math.min(cornerRadius, finalW / 2, finalH / 2);
        this.roundRectPath(ctx, dx, dy, finalW, finalH, radius);
        ctx.clip();
      } else if (cornerRadius > 0 && this.roundingMode === 'all') {
        // Round the entire canvas before drawing background and frame
        // We'll just draw everything inside a clip
        const radius = Math.min(cornerRadius, W / 2, H / 2);
        this.roundRectPath(ctx, 0, 0, W, H, radius);
        ctx.clip();
        // Redraw background and frame inside clip
        // (we already drew them, but they are outside the clip)
        // We'll re-draw background and frame after clipping.
        // But to avoid double drawing, we'll clear and re-draw.
        ctx.clearRect(0, 0, W, H);
        // Background
        const grad2 = this.createGradient(ctx, W, H, gradientStart, gradientEnd, gradientAngle);
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, W, H);
        // Frame
        if (frameEnabled && frameType !== 'none') {
          ctx.save();
          ctx.translate(frameOffsetX, frameOffsetY);
          this.drawFrame(ctx, frameType, 0, 0, W, H, frameScale, frameColor);
          ctx.restore();
        }
        // Image (no extra rounding because clip already rounds whole canvas)
        ctx.drawImage(image, cropX, cropY, cropW, cropH, dx, dy, finalW, finalH);
        ctx.restore();
        return;
      }
      ctx.drawImage(image, cropX, cropY, cropW, cropH, dx, dy, finalW, finalH);
      ctx.restore();
    }

    // ----- Standard rendering (canvas resizes) -----
    renderStandard(state) {
      const ctx = this.ctx;
      const { image, padding, cornerRadius, gradientStart, gradientEnd, gradientAngle,
              aspectRatio, frameEnabled, frameType, frameScale, frameColor,
              imageOffsetX, imageOffsetY, frameOffsetX, frameOffsetY } = state;
      if (!image || !ctx) return;

      const layout = this.computeLayout(state);
      let { canvasWidth, canvasHeight, imageDrawWidth, imageDrawHeight,
            cropX, cropY, cropWidth, cropHeight } = layout;
      state.canvasWidth = canvasWidth;
      state.canvasHeight = canvasHeight;

      // Resize canvas
      ctx.canvas.width = canvasWidth;
      ctx.canvas.height = canvasHeight;

      // Draw background
      this.drawBackground(ctx, canvasWidth, canvasHeight, gradientStart, gradientEnd, gradientAngle, cornerRadius);

      // Draw frame and content
      let contentArea = null;
      if (frameEnabled && frameType !== 'none') {
        ctx.save();
        ctx.translate(frameOffsetX, frameOffsetY);
        this.drawFrame(ctx, frameType, 0, 0, canvasWidth, canvasHeight, frameScale, frameColor);
        contentArea = this.getContentArea(frameType, canvasWidth, canvasHeight, frameScale);
        contentArea.x += frameOffsetX;
        contentArea.y += frameOffsetY;
        ctx.restore();
      }

      ctx.save();
      if (contentArea) {
        ctx.beginPath();
        ctx.rect(contentArea.x, contentArea.y, contentArea.width, contentArea.height);
        ctx.clip();
        const imgX = contentArea.x + padding + imageOffsetX;
        const imgY = contentArea.y + padding + imageOffsetY;
        this.drawImage(ctx, image, cropX, cropY, cropWidth, cropHeight,
                       imgX, imgY, imageDrawWidth, imageDrawHeight, cornerRadius);
      } else {
        const imgX = padding + imageOffsetX;
        const imgY = padding + imageOffsetY;
        this.drawImage(ctx, image, cropX, cropY, cropWidth, cropHeight,
                       imgX, imgY, imageDrawWidth, imageDrawHeight, cornerRadius);
      }
      ctx.restore();
    }

    // ----- Layout computation (unchanged) -----
    computeLayout(state) {
      const { image, padding, aspectRatio, frameEnabled, frameType, frameScale } = state;
      const imgW = image.width, imgH = image.height;
      let targetRatio = null;
      if (aspectRatio !== 'custom') {
        const parts = aspectRatio.split(':').map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
          targetRatio = parts[0] / parts[1];
        }
      }
      let drawW = imgW, drawH = imgH;
      let cropX = 0, cropY = 0, cropW = imgW, cropH = imgH;
      if (targetRatio) {
        const currentRatio = imgW / imgH;
        if (currentRatio > targetRatio) {
          cropW = imgH * targetRatio;
          cropX = (imgW - cropW) / 2;
        } else {
          cropH = imgW / targetRatio;
          cropY = (imgH - cropH) / 2;
        }
        drawW = cropW;
        drawH = cropH;
      }
      let canvasW = drawW + 2 * padding;
      let canvasH = drawH + 2 * padding;
      if (frameEnabled && frameType !== 'none') {
        const frameMargins = this.getFrameMargins(frameType);
        canvasW += 2 * frameMargins.horizontal;
        canvasH += 2 * frameMargins.vertical;
      }
      return {
        canvasWidth: canvasW,
        canvasHeight: canvasH,
        imageDrawWidth: drawW,
        imageDrawHeight: drawH,
        cropX, cropY, cropWidth: cropW, cropHeight: cropH
      };
    }

    getFrameMargins(frameType) {
      switch (frameType) {
        case 'browser-chrome':
        case 'browser-safari':
        case 'browser-firefox':
        case 'browser-edge':
          return { horizontal: 20, vertical: 40 };
        case 'iphone-14':
        case 'iphone-13':
          return { horizontal: 20, vertical: 40 };
        case 'ipad-pro':
          return { horizontal: 30, vertical: 30 };
        case 'macbook':
          return { horizontal: 30, vertical: 20 };
        case 'imac':
          return { horizontal: 40, vertical: 25 };
        default:
          return { horizontal: 0, vertical: 0 };
      }
    }

    getContentArea(frameType, canvasW, canvasH, scale) {
      switch (frameType) {
        case 'browser-chrome':
        case 'browser-safari':
        case 'browser-firefox':
        case 'browser-edge': {
          const border = 2 * scale, titleBar = 30 * scale;
          return { x: border, y: border + titleBar, width: canvasW - 2 * border, height: canvasH - border - titleBar - border };
        }
        case 'iphone-14':
        case 'iphone-13': {
          const bezel = 12 * scale, topNotch = 12 * scale;
          return { x: bezel, y: bezel + topNotch, width: canvasW - 2 * bezel, height: canvasH - 2 * bezel - topNotch - 6 * scale };
        }
        case 'ipad-pro': {
          const bezel = 20 * scale;
          return { x: bezel, y: bezel, width: canvasW - 2 * bezel, height: canvasH - 2 * bezel };
        }
        case 'macbook': {
          const bezel = 12 * scale;
          return { x: bezel, y: bezel, width: canvasW - 2 * bezel, height: canvasH - 2 * bezel - 20 * scale };
        }
        case 'imac': {
          const bezel = 20 * scale, chin = 30 * scale;
          return { x: bezel, y: bezel, width: canvasW - 2 * bezel, height: canvasH - bezel - chin };
        }
        default:
          return { x: 0, y: 0, width: canvasW, height: canvasH };
      }
    }

    // ----- Drawing primitives -----
    drawBackground(ctx, w, h, start, end, angle, radius) {
      ctx.clearRect(0, 0, w, h);
      const grad = this.createGradient(ctx, w, h, start, end, angle);
      ctx.fillStyle = grad;
      if (radius > 0) {
        this.roundRectPath(ctx, 0, 0, w, h, radius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, w, h);
      }
    }

    drawImage(ctx, img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH, radius) {
      ctx.save();
      if (radius > 0) {
        this.roundRectPath(ctx, dstX, dstY, dstW, dstH, radius);
        ctx.clip();
      }
      ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      ctx.restore();
    }

    roundRectPath(ctx, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    createGradient(ctx, w, h, start, end, angle) {
      const deg = parseFloat(angle) || 135;
      const rad = deg * Math.PI / 180;
      const cx = w / 2, cy = h / 2;
      const r = Math.sqrt(w * w + h * h) / 2;
      const x1 = cx - r * Math.cos(rad);
      const y1 = cy - r * Math.sin(rad);
      const x2 = cx + r * Math.cos(rad);
      const y2 = cy + r * Math.sin(rad);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, start);
      grad.addColorStop(1, end);
      return grad;
    }

    // ----- Full frame drawing (browser, iphone, ipad, macbook, imac) -----
    drawFrame(ctx, type, x, y, w, h, scale, color) {
      switch (type) {
        case 'browser-chrome':
        case 'browser-safari':
        case 'browser-firefox':
        case 'browser-edge':
          this.drawBrowserFrame(ctx, type, x, y, w, h, scale, color);
          break;
        case 'iphone-14':
        case 'iphone-13':
          this.drawiPhoneFrame(ctx, type, x, y, w, h, scale);
          break;
        case 'ipad-pro':
          this.drawiPadFrame(ctx, x, y, w, h, scale);
          break;
        case 'macbook':
          this.drawMacBookFrame(ctx, x, y, w, h, scale);
          break;
        case 'imac':
          this.drawiMacFrame(ctx, x, y, w, h, scale);
          break;
        default:
          break;
      }
    }

    // ---------- Browser frames ----------
    drawBrowserFrame(ctx, type, x, y, w, h, scale, color) {
      const isDark = (color === 'dark' || color === 'black');
      const bgColor = isDark ? '#1f2937' : (color === 'black' ? '#000000' : (color === 'white' ? '#ffffff' : '#f3f4f6'));
      const borderColor = isDark ? '#374151' : '#e5e7eb';
      const radius = 8 * scale;
      const titleBarHeight = 30 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 10 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scale;
      ctx.fillStyle = bgColor;
      this.roundRectPath(ctx, x, y, w, h, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2 * scale;
      this.roundRectPath(ctx, x, y, w, h, radius);
      ctx.stroke();
      const grad = ctx.createLinearGradient(x, y, x, y + titleBarHeight);
      grad.addColorStop(0, isDark ? '#2d3748' : '#f8f9fa');
      grad.addColorStop(1, bgColor);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, titleBarHeight);
      ctx.strokeStyle = isDark ? '#4a5568' : '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + titleBarHeight);
      ctx.lineTo(x + w, y + titleBarHeight);
      ctx.stroke();
      const dotRadius = 6 * scale;
      const dotY = y + titleBarHeight / 2;
      const dotSpacing = 10 * scale;
      const startX = x + 12 * scale;
      ctx.shadowBlur = 0;
      // Red
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(startX, dotY, dotRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Yellow
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(startX + dotSpacing, dotY, dotRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.stroke();
      // Green
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(startX + 2 * dotSpacing, dotY, dotRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#059669';
      ctx.stroke();
      // URL bar
      const barX = x + 60 * scale;
      const barY = y + 6 * scale;
      const barW = w - 90 * scale;
      const barH = 18 * scale;
      const barRadius = 6 * scale;
      const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      barGrad.addColorStop(0, isDark ? '#1f2937' : '#ffffff');
      barGrad.addColorStop(1, isDark ? '#111827' : '#f9fafb');
      ctx.fillStyle = barGrad;
      this.roundRectPath(ctx, barX, barY, barW, barH, barRadius);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#4a5568' : '#d1d5db';
      ctx.lineWidth = 1.5 * scale;
      this.roundRectPath(ctx, barX, barY, barW, barH, barRadius);
      ctx.stroke();
      ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
      ctx.font = `bold ${10 * scale}px system-ui`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', barX + 6 * scale, barY + barH / 2);
      ctx.fillStyle = isDark ? '#e5e7eb' : '#374151';
      ctx.font = `${11 * scale}px system-ui, -apple-system`;
      ctx.fillText('https://example.com', barX + 20 * scale, barY + barH / 2);
      // Browser logo
      this.drawBrowserLogo(ctx, type, x + w - 40 * scale, y + titleBarHeight / 2, 18 * scale);
    }

    drawBrowserLogo(ctx, type, x, y, size) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      switch (type) {
        case 'browser-chrome': {
          const r = size / 2;
          ctx.fillStyle = '#ea4335';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#fbbc04';
          ctx.beginPath();
          ctx.arc(x - r / 4, y, r / 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#34a853';
          ctx.beginPath();
          ctx.arc(x + r / 4, y, r / 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#4285f4';
          ctx.beginPath();
          ctx.arc(x, y, r / 6, 0, 2 * Math.PI);
          ctx.fill();
          break;
        }
        case 'browser-safari':
          ctx.fillStyle = '#007aff';
          ctx.font = `bold ${size}px system-ui`;
          ctx.fillText('S', x, y + 1);
          break;
        case 'browser-firefox':
          ctx.fillStyle = '#ff7139';
          ctx.font = `bold ${size}px system-ui`;
          ctx.fillText('F', x, y + 1);
          break;
        case 'browser-edge':
          ctx.fillStyle = '#0078d4';
          ctx.font = `bold ${size}px system-ui`;
          ctx.fillText('E', x, y + 1);
          break;
        default:
          break;
      }
      ctx.restore();
    }

    // ---------- iPhone frames ----------
    drawiPhoneFrame(ctx, type, x, y, w, h, scale) {
      const is14 = (type === 'iphone-14');
      const cornerRadius = 30 * scale;
      const borderWidth = 3 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * scale;
      const bezelGrad = ctx.createLinearGradient(x, y, x, y + h);
      bezelGrad.addColorStop(0, '#1a1a1a');
      bezelGrad.addColorStop(0.5, '#000000');
      bezelGrad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = bezelGrad;
      this.roundRectPath(ctx, x, y, w, h, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = borderWidth;
      this.roundRectPath(ctx, x, y, w, h, cornerRadius);
      ctx.stroke();
      const screenMargin = 12 * scale;
      const screenX = x + screenMargin;
      const screenY = y + screenMargin + (is14 ? 0 : 6 * scale);
      const screenW = w - 2 * screenMargin;
      const screenH = h - 2 * screenMargin - (is14 ? 0 : 6 * scale);
      ctx.fillStyle = '#000000';
      ctx.fillRect(screenX, screenY, screenW, screenH);
      if (is14) {
        const notchW = 150 * scale;
        const notchH = 30 * scale;
        const notchX = x + (w - notchW) / 2;
        const notchY = y + 12 * scale;
        ctx.fillStyle = '#000000';
        this.roundRectPath(ctx, notchX, notchY, notchW, notchH, 15 * scale);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(notchX + notchW / 2, notchY + notchH / 2, 5 * scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(notchX + 20 * scale, notchY + 12 * scale, notchW - 40 * scale, 3 * scale);
      }
      const indicatorW = 134 * scale;
      const indicatorH = 5 * scale;
      const indicatorX = x + (w - indicatorW) / 2;
      const indicatorY = y + h - 10 * scale - indicatorH;
      const grad = ctx.createLinearGradient(indicatorX, indicatorY, indicatorX, indicatorY + indicatorH);
      grad.addColorStop(0, 'rgba(255,255,255,0.4)');
      grad.addColorStop(1, 'rgba(255,255,255,0.2)');
      ctx.fillStyle = grad;
      this.roundRectPath(ctx, indicatorX, indicatorY, indicatorW, indicatorH, 3 * scale);
      ctx.fill();
      if (!is14) {
        const notchW = 100 * scale;
        const notchH = 20 * scale;
        const notchX = x + (w - notchW) / 2;
        const notchY = y + 12 * scale;
        ctx.fillStyle = '#000000';
        this.roundRectPath(ctx, notchX, notchY, notchW, notchH, 10 * scale);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(notchX + notchW / 2, notchY + notchH / 2, 4 * scale, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // ---------- iPad frame ----------
    drawiPadFrame(ctx, x, y, w, h, scale) {
      const cornerRadius = 20 * scale;
      const borderWidth = 3 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * scale;
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#2d3748');
      grad.addColorStop(0.5, '#1f2937');
      grad.addColorStop(1, '#2d3748');
      ctx.fillStyle = grad;
      this.roundRectPath(ctx, x, y, w, h, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = borderWidth;
      this.roundRectPath(ctx, x, y, w, h, cornerRadius);
      ctx.stroke();
      const margin = 20 * scale;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + margin, y + margin, w - 2 * margin, h - 2 * margin);
      const btnW = 134 * scale;
      const btnH = 5 * scale;
      const btnX = x + (w - btnW) / 2;
      const btnY = y + h - 10 * scale - btnH;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      this.roundRectPath(ctx, btnX, btnY, btnW, btnH, 3 * scale);
      ctx.fill();
    }

    // ---------- MacBook frame ----------
    drawMacBookFrame(ctx, x, y, w, h, scale) {
      const screenHeight = h - 20 * scale;
      const cornerRadius = 8 * scale;
      const baseHeight = 20 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scale;
      const grad = ctx.createLinearGradient(x, y, x, y + screenHeight);
      grad.addColorStop(0, '#2d3748');
      grad.addColorStop(1, '#1f2937');
      ctx.fillStyle = grad;
      this.roundRectPath(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2 * scale;
      this.roundRectPath(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.stroke();
      const margin = 12 * scale;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + margin, y + margin, w - 2 * margin, screenHeight - 2 * margin);
      const baseY = y + screenHeight;
      const baseGrad = ctx.createLinearGradient(x, baseY, x, baseY + baseHeight);
      baseGrad.addColorStop(0, '#e5e7eb');
      baseGrad.addColorStop(1, '#d1d5db');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(x, baseY, w, baseHeight);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, baseY, w, baseHeight);
      const trackW = 60 * scale;
      const trackH = 6 * scale;
      const trackX = x + (w - trackW) / 2;
      const trackY = baseY + 10 * scale;
      ctx.fillStyle = '#1f2937';
      this.roundRectPath(ctx, trackX, trackY, trackW, trackH, 3 * scale);
      ctx.fill();
      ctx.fillStyle = '#6b7280';
      ctx.font = `bold ${18 * scale}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      ctx.arc(x + w / 2, baseY + baseHeight / 2, 8 * scale, 0, 2 * Math.PI);
      ctx.fill();
    }

    // ---------- iMac frame ----------
    drawiMacFrame(ctx, x, y, w, h, scale) {
      const screenHeight = h - 30 * scale;
      const cornerRadius = 12 * scale;
      const chinHeight = 30 * scale;
      const standWidth = 80 * scale;
      const standHeight = 200 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * scale;
      const grad = ctx.createLinearGradient(x, y, x, y + screenHeight);
      grad.addColorStop(0, '#f3f4f6');
      grad.addColorStop(1, '#e5e7eb');
      ctx.fillStyle = grad;
      this.roundRectPath(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 3 * scale;
      this.roundRectPath(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.stroke();
      const margin = 20 * scale;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + margin, y + margin, w - 2 * margin, screenHeight - 2 * margin);
      const chinY = y + screenHeight;
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x, chinY, w, chinHeight);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, chinY, w, chinHeight);
      const standX = x + (w - standWidth) / 2;
      const standY = chinY + chinHeight;
      const standGrad = ctx.createLinearGradient(standX, standY, standX + standWidth, standY + standHeight);
      standGrad.addColorStop(0, '#cbd5e1');
      standGrad.addColorStop(1, '#9ca3af');
      ctx.fillStyle = standGrad;
      ctx.beginPath();
      ctx.moveTo(standX, standY);
      ctx.lineTo(standX + standWidth, standY);
      ctx.lineTo(standX + standWidth - 20 * scale, standY + standHeight);
      ctx.lineTo(standX + 20 * scale, standY + standHeight);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.stroke();
      const baseGrad = ctx.createRadialGradient(
        standX + standWidth / 2, standY + standHeight, 0,
        standX + standWidth / 2, standY + standHeight, standWidth / 2
      );
      baseGrad.addColorStop(0, '#6b7280');
      baseGrad.addColorStop(1, '#4b5563');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.ellipse(standX + standWidth / 2, standY + standHeight, standWidth / 2, 10 * scale, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // ===========================
  // 3. BACKGROUNDMAKER (public API)
  // ===========================
  class BackgroundMaker {
    constructor(canvas, options = {}) {
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('BackgroundMaker: canvas required');
      }
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = new EditorState();
      // Merge options
      const opts = Object.assign({
        fixedSize: false,
        roundingMode: 'image', // 'image' or 'all'
        paddingMode: 'margin'  // 'expand' or 'margin'
      }, options);
      this.renderer = new Renderer(this.ctx, opts);
    }

    setImage(src) {
      return new Promise((resolve, reject) => {
        if (src instanceof HTMLImageElement) {
          this.state.image = src;
          this.state.imageWidth = src.width;
          this.state.imageHeight = src.height;
          resolve();
        } else if (typeof src === 'string') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.state.image = img;
            this.state.imageWidth = img.width;
            this.state.imageHeight = img.height;
            resolve();
          };
          img.onerror = () => reject(new Error('Failed to load image from URL'));
          img.src = src;
        } else {
          reject(new Error('Unsupported image source'));
        }
      });
    }

    setOptions(options) {
      const allowed = [
        'padding', 'cornerRadius', 'gradientStart', 'gradientEnd', 'gradientAngle',
        'aspectRatio', 'frameEnabled', 'frameType', 'frameScale', 'frameColor',
        'imageOffsetX', 'imageOffsetY', 'frameOffsetX', 'frameOffsetY'
      ];
      for (const key of allowed) {
        if (key in options) {
          this.state[key] = options[key];
        }
      }
    }

    render() {
      if (!this.state.image) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      this.renderer.render(this.state);
    }

    toBlob(type = 'image/png', quality) {
      return new Promise((resolve) => {
        this.canvas.toBlob((blob) => resolve(blob), type, quality);
      });
    }

    toDataURL(type = 'image/png', quality) {
      return this.canvas.toDataURL(type, quality);
    }

    getCanvasSize() {
      return { width: this.canvas.width, height: this.canvas.height };
    }

    resetOptions() {
      this.state.resetOptions();
    }

    reset() {
      this.state.resetOptions();
      this.state.image = null;
      this.state.imageWidth = 0;
      this.state.imageHeight = 0;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getState() {
      return this.state.clone();
    }
  }

  // ----- Expose globally -----
  if (typeof window !== 'undefined') {
    window.BackgroundMaker = BackgroundMaker;
    console.log('[BackgroundMaker] Exposed as window.BackgroundMaker');
  }
})();