/**
 * background-maker.js – Core library with forced fixed size.
 * The renderer will never resize the canvas.
 */
(function() {
  'use strict';
  console.log('[BackgroundMaker] Library script executed.');

  // ----- State -----
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

  // ----- Renderer (fixed size – always prevents resizing) -----
  class Renderer {
    constructor(ctx, options = {}) {
      this.ctx = ctx;
      // If fixedSize is true, we never resize the canvas.
      // We'll default to true to ensure safety.
      this.fixedSize = options.fixedSize !== undefined ? options.fixedSize : true;
      if (this.fixedSize) {
        console.log('[BackgroundMaker] fixedSize mode enabled – canvas will not resize.');
      }
    }

    render(state) {
      const ctx = this.ctx;
      const { image, padding, cornerRadius, gradientStart, gradientEnd, gradientAngle,
              aspectRatio, frameEnabled, frameType, frameScale, frameColor,
              imageOffsetX, imageOffsetY, frameOffsetX, frameOffsetY } = state;
      if (!image || !ctx) return;

      // Compute layout
      const layout = this.computeLayout(state);
      let { canvasWidth, canvasHeight, imageDrawWidth, imageDrawHeight,
            cropX, cropY, cropWidth, cropHeight } = layout;
      state.canvasWidth = canvasWidth;
      state.canvasHeight = canvasHeight;

      // Only resize if not fixed
      if (!this.fixedSize) {
        ctx.canvas.width = canvasWidth;
        ctx.canvas.height = canvasHeight;
      }

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

    // ----- Layout helpers (unchanged) -----
    computeLayout(state) {
      const { image, padding, aspectRatio, frameEnabled, frameType, frameScale } = state;
      const imgW = image.width, imgH = image.height;
      let targetRatio = null;
      if (aspectRatio !== 'custom') {
        const parts = aspectRatio.split(':').map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) targetRatio = parts[0] / parts[1];
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
        drawW = cropW; drawH = cropH;
      }
      let canvasW = drawW + 2 * padding;
      let canvasH = drawH + 2 * padding;
      if (frameEnabled && frameType !== 'none') {
        const frameMargins = this.getFrameMargins(frameType);
        canvasW += 2 * frameMargins.horizontal;
        canvasH += 2 * frameMargins.vertical;
      }
      return { canvasWidth: canvasW, canvasHeight: canvasH, imageDrawWidth: drawW, imageDrawHeight: drawH,
               cropX, cropY, cropWidth: cropW, cropHeight: cropH };
    }

    getFrameMargins(frameType) {
      switch (frameType) {
        case 'browser-chrome': case 'browser-safari': case 'browser-firefox': case 'browser-edge':
          return { horizontal: 20, vertical: 40 };
        case 'iphone-14': case 'iphone-13': return { horizontal: 20, vertical: 40 };
        case 'ipad-pro': return { horizontal: 30, vertical: 30 };
        case 'macbook': return { horizontal: 30, vertical: 20 };
        case 'imac': return { horizontal: 40, vertical: 25 };
        default: return { horizontal: 0, vertical: 0 };
      }
    }

    getContentArea(frameType, canvasW, canvasH, scale) {
      switch (frameType) {
        case 'browser-chrome': case 'browser-safari': case 'browser-firefox': case 'browser-edge': {
          const border = 2 * scale, titleBar = 30 * scale;
          return { x: border, y: border + titleBar, width: canvasW - 2*border, height: canvasH - border - titleBar - border };
        }
        case 'iphone-14': case 'iphone-13': {
          const bezel = 12 * scale, topNotch = 12 * scale;
          return { x: bezel, y: bezel + topNotch, width: canvasW - 2*bezel, height: canvasH - 2*bezel - topNotch - 6*scale };
        }
        case 'ipad-pro': { const bezel = 20 * scale; return { x: bezel, y: bezel, width: canvasW - 2*bezel, height: canvasH - 2*bezel }; }
        case 'macbook': { const bezel = 12 * scale; return { x: bezel, y: bezel, width: canvasW - 2*bezel, height: canvasH - 2*bezel - 20*scale }; }
        case 'imac': { const bezel = 20 * scale, chin = 30 * scale; return { x: bezel, y: bezel, width: canvasW - 2*bezel, height: canvasH - bezel - chin }; }
        default: return { x: 0, y: 0, width: canvasW, height: canvasH };
      }
    }

    drawBackground(ctx, w, h, start, end, angle, radius) {
      ctx.clearRect(0, 0, w, h);
      const deg = parseFloat(angle) || 135, rad = deg * Math.PI / 180;
      const cx = w/2, cy = h/2, r = Math.sqrt(w*w + h*h) / 2;
      const x1 = cx - r*Math.cos(rad), y1 = cy - r*Math.sin(rad);
      const x2 = cx + r*Math.cos(rad), y2 = cy + r*Math.sin(rad);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, start); grad.addColorStop(1, end);
      ctx.fillStyle = grad;
      if (radius > 0) { this.roundRect(ctx, 0, 0, w, h, radius); ctx.fill(); } else { ctx.fillRect(0, 0, w, h); }
    }

    drawImage(ctx, img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH, radius) {
      ctx.save();
      if (radius > 0) { this.roundRect(ctx, dstX, dstY, dstW, dstH, radius); ctx.clip(); }
      ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    // ----- Frame drawing (full implementation – unchanged) -----
    drawFrame(ctx, type, x, y, w, h, scale, color) {
      switch (type) {
        case 'browser-chrome': case 'browser-safari': case 'browser-firefox': case 'browser-edge':
          this.drawBrowserFrame(ctx, type, x, y, w, h, scale, color); break;
        case 'iphone-14': case 'iphone-13': this.drawiPhoneFrame(ctx, type, x, y, w, h, scale); break;
        case 'ipad-pro': this.drawiPadFrame(ctx, x, y, w, h, scale); break;
        case 'macbook': this.drawMacBookFrame(ctx, x, y, w, h, scale); break;
        case 'imac': this.drawiMacFrame(ctx, x, y, w, h, scale); break;
        default: break;
      }
    }

    drawBrowserFrame(ctx, type, x, y, w, h, scale, color) {
      const isDark = (color === 'dark' || color === 'black');
      const bgColor = isDark ? '#1f2937' : (color === 'black' ? '#000000' : (color === 'white' ? '#ffffff' : '#f3f4f6'));
      const borderColor = isDark ? '#374151' : '#e5e7eb';
      const radius = 8 * scale, titleBarHeight = 30 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 10 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scale;
      ctx.fillStyle = bgColor;
      this.roundRect(ctx, x, y, w, h, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2 * scale;
      this.roundRect(ctx, x, y, w, h, radius);
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
      const dotRadius = 6 * scale, dotY = y + titleBarHeight/2, dotSpacing = 10 * scale, startX = x + 12 * scale;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(startX, dotY, dotRadius, 0, 2*Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(startX + dotSpacing, dotY, dotRadius, 0, 2*Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(startX + 2*dotSpacing, dotY, dotRadius, 0, 2*Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#059669';
      ctx.stroke();
      const barX = x + 60 * scale, barY = y + 6 * scale, barW = w - 90 * scale, barH = 18 * scale, barRadius = 6 * scale;
      ctx.shadowBlur = 0;
      const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      barGrad.addColorStop(0, isDark ? '#1f2937' : '#ffffff');
      barGrad.addColorStop(1, isDark ? '#111827' : '#f9fafb');
      ctx.fillStyle = barGrad;
      this.roundRect(ctx, barX, barY, barW, barH, barRadius);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#4a5568' : '#d1d5db';
      ctx.lineWidth = 1.5 * scale;
      this.roundRect(ctx, barX, barY, barW, barH, barRadius);
      ctx.stroke();
      ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
      ctx.font = `bold ${10 * scale}px system-ui`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', barX + 6 * scale, barY + barH/2);
      ctx.fillStyle = isDark ? '#e5e7eb' : '#374151';
      ctx.font = `${11 * scale}px system-ui, -apple-system`;
      ctx.fillText('https://example.com', barX + 20 * scale, barY + barH/2);
      this.drawBrowserLogo(ctx, type, x + w - 40 * scale, y + titleBarHeight/2, 18 * scale);
    }

    drawBrowserLogo(ctx, type, x, y, size) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      switch (type) {
        case 'browser-chrome':
          const r = size/2;
          ctx.fillStyle = '#ea4335';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 2*Math.PI);
          ctx.fill();
          ctx.fillStyle = '#fbbc04';
          ctx.beginPath();
          ctx.arc(x - r/4, y, r/4, 0, 2*Math.PI);
          ctx.fill();
          ctx.fillStyle = '#34a853';
          ctx.beginPath();
          ctx.arc(x + r/4, y, r/4, 0, 2*Math.PI);
          ctx.fill();
          ctx.fillStyle = '#4285f4';
          ctx.beginPath();
          ctx.arc(x, y, r/6, 0, 2*Math.PI);
          ctx.fill();
          break;
        case 'browser-safari': ctx.fillStyle = '#007aff'; ctx.font = `bold ${size}px system-ui`; ctx.fillText('S', x, y+1); break;
        case 'browser-firefox': ctx.fillStyle = '#ff7139'; ctx.font = `bold ${size}px system-ui`; ctx.fillText('F', x, y+1); break;
        case 'browser-edge': ctx.fillStyle = '#0078d4'; ctx.font = `bold ${size}px system-ui`; ctx.fillText('E', x, y+1); break;
      }
      ctx.restore();
    }

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
      this.roundRect(ctx, x, y, w, h, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = borderWidth;
      this.roundRect(ctx, x, y, w, h, cornerRadius);
      ctx.stroke();
      const screenMargin = 12 * scale;
      const screenX = x + screenMargin;
      const screenY = y + screenMargin + (is14 ? 0 : 6 * scale);
      const screenW = w - 2 * screenMargin;
      const screenH = h - 2 * screenMargin - (is14 ? 0 : 6 * scale);
      ctx.fillStyle = '#000000';
      ctx.fillRect(screenX, screenY, screenW, screenH);
      if (is14) {
        const notchW = 150 * scale, notchH = 30 * scale;
        const notchX = x + (w - notchW) / 2, notchY = y + 12 * scale;
        ctx.fillStyle = '#000000';
        this.roundRect(ctx, notchX, notchY, notchW, notchH, 15 * scale);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(notchX + notchW/2, notchY + notchH/2, 5 * scale, 0, 2*Math.PI);
        ctx.fill();
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(notchX + 20 * scale, notchY + 12 * scale, notchW - 40 * scale, 3 * scale);
      }
      const indicatorW = 134 * scale, indicatorH = 5 * scale;
      const indicatorX = x + (w - indicatorW) / 2, indicatorY = y + h - 10 * scale - indicatorH;
      const grad = ctx.createLinearGradient(indicatorX, indicatorY, indicatorX, indicatorY + indicatorH);
      grad.addColorStop(0, 'rgba(255,255,255,0.4)');
      grad.addColorStop(1, 'rgba(255,255,255,0.2)');
      ctx.fillStyle = grad;
      this.roundRect(ctx, indicatorX, indicatorY, indicatorW, indicatorH, 3 * scale);
      ctx.fill();
      if (!is14) {
        const notchW = 100 * scale, notchH = 20 * scale;
        const notchX = x + (w - notchW) / 2, notchY = y + 12 * scale;
        ctx.fillStyle = '#000000';
        this.roundRect(ctx, notchX, notchY, notchW, notchH, 10 * scale);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(notchX + notchW/2, notchY + notchH/2, 4 * scale, 0, 2*Math.PI);
        ctx.fill();
      }
    }

    drawiPadFrame(ctx, x, y, w, h, scale) {
      const cornerRadius = 20 * scale, borderWidth = 3 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * scale;
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#2d3748');
      grad.addColorStop(0.5, '#1f2937');
      grad.addColorStop(1, '#2d3748');
      ctx.fillStyle = grad;
      this.roundRect(ctx, x, y, w, h, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = borderWidth;
      this.roundRect(ctx, x, y, w, h, cornerRadius);
      ctx.stroke();
      const margin = 20 * scale;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + margin, y + margin, w - 2*margin, h - 2*margin);
      const btnW = 134 * scale, btnH = 5 * scale;
      const btnX = x + (w - btnW) / 2, btnY = y + h - 10 * scale - btnH;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      this.roundRect(ctx, btnX, btnY, btnW, btnH, 3 * scale);
      ctx.fill();
    }

    drawMacBookFrame(ctx, x, y, w, h, scale) {
      const screenHeight = h - 20 * scale, cornerRadius = 8 * scale, baseHeight = 20 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scale;
      const grad = ctx.createLinearGradient(x, y, x, y + screenHeight);
      grad.addColorStop(0, '#2d3748');
      grad.addColorStop(1, '#1f2937');
      ctx.fillStyle = grad;
      this.roundRect(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2 * scale;
      this.roundRect(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.stroke();
      const margin = 12 * scale;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + margin, y + margin, w - 2*margin, screenHeight - 2*margin);
      const baseY = y + screenHeight;
      const baseGrad = ctx.createLinearGradient(x, baseY, x, baseY + baseHeight);
      baseGrad.addColorStop(0, '#e5e7eb');
      baseGrad.addColorStop(1, '#d1d5db');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(x, baseY, w, baseHeight);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, baseY, w, baseHeight);
      const trackW = 60 * scale, trackH = 6 * scale;
      const trackX = x + (w - trackW) / 2, trackY = baseY + 10 * scale;
      ctx.fillStyle = '#1f2937';
      this.roundRect(ctx, trackX, trackY, trackW, trackH, 3 * scale);
      ctx.fill();
      ctx.fillStyle = '#6b7280';
      ctx.font = `bold ${18 * scale}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      ctx.arc(x + w/2, baseY + baseHeight/2, 8 * scale, 0, 2*Math.PI);
      ctx.fill();
    }

    drawiMacFrame(ctx, x, y, w, h, scale) {
      const screenHeight = h - 30 * scale, cornerRadius = 12 * scale, chinHeight = 30 * scale;
      const standWidth = 80 * scale, standHeight = 200 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * scale;
      const grad = ctx.createLinearGradient(x, y, x, y + screenHeight);
      grad.addColorStop(0, '#f3f4f6');
      grad.addColorStop(1, '#e5e7eb');
      ctx.fillStyle = grad;
      this.roundRect(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 3 * scale;
      this.roundRect(ctx, x, y, w, screenHeight, cornerRadius);
      ctx.stroke();
      const margin = 20 * scale;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + margin, y + margin, w - 2*margin, screenHeight - 2*margin);
      const chinY = y + screenHeight;
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x, chinY, w, chinHeight);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, chinY, w, chinHeight);
      const standX = x + (w - standWidth) / 2, standY = chinY + chinHeight;
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
        standX + standWidth/2, standY + standHeight, 0,
        standX + standWidth/2, standY + standHeight, standWidth/2
      );
      baseGrad.addColorStop(0, '#6b7280');
      baseGrad.addColorStop(1, '#4b5563');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.ellipse(standX + standWidth/2, standY + standHeight, standWidth/2, 10 * scale, 0, 0, 2*Math.PI);
      ctx.fill();
    }
  }

  // ----- BackgroundMaker (public API) -----
  class BackgroundMaker {
    constructor(canvas, options = {}) {
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('BackgroundMaker: canvas required');
      }
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = new EditorState();
      // Force fixedSize to true for safety, but allow override.
      const opts = Object.assign({}, options, { fixedSize: true });
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