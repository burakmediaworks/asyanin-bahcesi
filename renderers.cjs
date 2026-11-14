(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PixelPreviewRenderers = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const GIFT_DURATION = 8.8;
  const GIFT_READY_TIME = 5.15;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const wrap = (t, duration) => ((t % duration) + duration) % duration;

  function clear(ctx, transparent) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (transparent) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    else {ctx.fillStyle = '#000';ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);}
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  }

  function sprite(ctx, image, rect, x, y, scale, alpha) {
    if (!image || !rect || scale <= 0) return;
    const anchorX = rect.anchorX == null ? rect.w / 2 : rect.anchorX;
    const anchorY = rect.anchorY == null ? rect.h : rect.anchorY;
    ctx.save();
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h,
      Math.round(x - anchorX * scale), Math.round(y - anchorY * scale),
      Math.round(rect.w * scale), Math.round(rect.h * scale));
    ctx.restore();
  }

  function renderFlowers(ctx, seconds, assets, options) {
    clear(ctx);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const flowers = assets.manifest.flowers || [];
    if (!assets.flowers || !flowers.length) return;
    const cellW = W / 4, cellH = H / 2;
    const t = Math.max(0, seconds);
    // One gentle gust per ten seconds; independent phases prevent metronomic motion.
    const gustT = wrap(t, 10.4);
    const gust = gustT > 4.8 && gustT < 7.4 ? Math.pow(Math.sin((gustT - 4.8) / 2.6 * Math.PI), 2) : 0;
    flowers.slice(0, 8).forEach((rect, i) => {
      const scale = Math.min(cellW * 0.88 / rect.w, cellH * 0.90 / rect.h);
      const width = Math.round(rect.w * scale), height = Math.round(rect.h * scale);
      const anchorX = (rect.anchorX == null ? rect.w / 2 : rect.anchorX) * scale;
      const anchorY = (rect.anchorY == null ? rect.h : rect.anchorY) * scale;
      const rootX = cellW * ((i % 4) + 0.5);
      const rootY = cellH * (Math.floor(i / 4) + 0.95);
      const left = Math.round(rootX - anchorX), top = Math.round(rootY - anchorY);
      const sway = (Math.sin(t * TAU * 2 / 10.4 + i * 0.79) * 1.8 + Math.sin(t * TAU / 10.4 + i) * 0.8 + gust * (2.6 + i % 3)) * W / 960;
      // Bend horizontal strips around the planted root. No whole-sprite sliding.
      const stripH = Math.max(1, Math.round(H / 320));
      for (let dy = 0; dy < height; dy += stripH) {
        const dh = Math.min(stripH, height - dy);
        const fromRoot = clamp((anchorY - dy) / Math.max(1, anchorY), 0, 1);
        const offset = Math.round(sway * fromRoot * fromRoot);
        ctx.drawImage(assets.flowers, rect.x, rect.y + dy / scale, rect.w, dh / scale,
          left + offset, top + dy, width, dh);
      }
    });
    if (gust > 0.08) {
      ctx.save();
      ctx.strokeStyle = '#d0b9d4';
      ctx.globalAlpha = 0.17 * gust;
      ctx.lineWidth = Math.max(1, Math.round(W / 960));
      const windProgress = clamp((gustT - 4.8) / 2.6, 0, 1);
      for (let i = 0; i < 2; i++) {
        const x = mix(-W * 0.12, W * 1.02, windProgress) - i * W * 0.27;
        const y = H * (0.48 + i * 0.48);
        ctx.beginPath();
        ctx.moveTo(Math.round(x), Math.round(y));
        ctx.lineTo(Math.round(x + W * 0.045), Math.round(y));
        ctx.lineTo(Math.round(x + W * 0.052), Math.round(y - H * 0.006));
        ctx.lineTo(Math.round(x + W * 0.081), Math.round(y - H * 0.006));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderWalk(ctx, seconds, assets, options) {
    clear(ctx);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const walk = assets.manifest.walk || {};
    const sequences = [walk.front || [], walk.back || []];
    if (!assets.girl) return;
    sequences.forEach((frames, index) => {
      if (!frames.length) return;
      // Two distinct source poses, followed by their opposite-foot body poses.
      // A shared head keeps the face, hair parting and neck registration stable.
      const poses = frames.slice(0, 2).map(rect => ({...rect, h: Math.max(456, rect.h), anchorY: 450}));
      const step = Math.floor(Math.max(0, seconds) * 6) % 4;
      const rect = poses[step % poses.length];
      const head = poses[0];
      const flip = step >= 2;
      const maxH = Math.max(...poses.map(r => r.h));
      const maxW = Math.max(...poses.map(r => r.w));
      const scale = Math.min(H * 0.86 / maxH, W * 0.31 / maxW);
      const rootX = W * (index ? 0.7 : 0.3), rootY = H * 0.95;
      const neckline = Math.round(rootY - head.anchorY * scale) + Math.round(112 * scale);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, neckline, W, H - neckline);
      ctx.clip();
      if (flip) {
        ctx.translate(rootX * 2, 0);
        ctx.scale(-1, 1);
      }
      sprite(ctx, assets.girl, rect, rootX, rootY, scale);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, neckline);
      ctx.clip();
      sprite(ctx, assets.girl, head, rootX, rootY, scale);
      ctx.restore();
    });
  }

  function renderPinkChestLight(ctx, age, x, frontY, chestWidth, W, H) {
    if (age < 0) return;
    const smooth = n => {const p = clamp(n, 0, 1); return p * p * (3 - 2 * p);};
    const intensity = smooth(age / 0.3) * (1 - smooth((age - 1.9) / 1.1));
    if (intensity <= 0) return;
    const pixel = Math.max(1, Math.round(W / 400));
    const mouthY = frontY - pixel * 2;
    const mouthWidth = chestWidth * 0.65;
    const snap = value => Math.round(value / pixel) * pixel;
    ctx.save();
    const inheritedAlpha = ctx.globalAlpha;
    ctx.beginPath();
    ctx.rect(0, 0, W, frontY + 1);
    ctx.clip();

    // Short translucent, stepped rays fan out from the chest mouth.
    // Their opacity fades with height; there is no pulse or flashing cycle.
    for (let beam = 0; beam < 7; beam++) {
      const direction = (beam - 3) / 3;
      const length = H * (0.34 + (1 - Math.abs(direction)) * 0.06) * mix(0.3, 1, smooth(age / 0.65));
      const startX = x + direction * mouthWidth * 0.13;
      const spread = direction * W * 0.32;
      const steps = 24;
      for (let step = 0; step < steps; step++) {
        const progress = step / steps;
        const next = (step + 1) / steps;
        const y0 = snap(mouthY - next * length);
        const y1 = snap(mouthY - progress * length);
        const centerX = snap(startX + spread * progress);
        const width = snap(pixel * mix(3, 9, progress));
        ctx.globalAlpha = inheritedAlpha * intensity * 0.29 * (1 - progress);
        ctx.fillStyle = beam % 2 ? '#ff8cdb' : '#fa59c5';
        ctx.fillRect(centerX - Math.round(width / 2), y0, width, Math.max(pixel, y1 - y0));
      }
    }

    // Pixel layers give the cavity a pink source of light without washing out wood.
    for (let layer = 3; layer >= 0; layer--) {
      const width = snap(mouthWidth * (1 + layer * 0.055));
      const height = pixel * (3 + layer * 2);
      ctx.globalAlpha = inheritedAlpha * intensity * (0.07 + (3 - layer) * 0.025);
      ctx.fillStyle = layer ? '#ed42b5' : '#ff87d4';
      ctx.fillRect(snap(x - width / 2), mouthY - height, width, height + pixel);
    }
    ctx.globalAlpha = inheritedAlpha * intensity * 0.72;
    ctx.fillStyle = '#ffb4e5';
    ctx.fillRect(snap(x - mouthWidth * 0.46), mouthY - pixel, snap(mouthWidth * 0.92), pixel);

    // One finite, staggered burst. Every pink pixel starts inside the chest.
    for (let i = 0; i < 22; i++) {
      const start = i * 0.062;
      const lifetime = 1.32 + (i % 5) * 0.085;
      const p = (age - start) / lifetime;
      if (p < 0 || p >= 1) continue;
      const spread = ((i * 0.61803398875) % 1) * 2 - 1;
      const sourceX = x + spread * mouthWidth * 0.26;
      const px = snap(sourceX + spread * W * 0.20 * ease(p));
      const py = snap(mouthY - pixel * 2 - H * (0.28 + (i % 4) * 0.035) * p);
      const size = pixel * (i % 5 === 0 ? 3 : 2);
      ctx.globalAlpha = inheritedAlpha * intensity * smooth(p / 0.12) * (1 - smooth((p - 0.58) / 0.42)) * 0.96;
      ctx.fillStyle = ['#ff86d6', '#ffb8e9', '#f65ac4'][i % 3];
      ctx.fillRect(px, py, size, size);
      if (i % 5 === 0) {
        ctx.globalAlpha *= 0.35;
        ctx.fillRect(px - pixel, py + pixel, size + pixel * 2, pixel);
        ctx.fillRect(px + pixel, py - pixel, pixel, size + pixel * 2);
      }
    }
    ctx.restore();
  }

  // The paper's inner plane in the unchanged bouquet source image. Its upward
  // right tilt is preserved for both the ink and the final interactive target.
  const notePoint = (u, v) => ({x: 510 + 192 * u + 12 * v, y: 793 - 23 * u + 88 * v});

  function bouquetProjection(rect, x, y, scale) {
    const anchorX = rect.anchorX == null ? rect.w / 2 : rect.anchorX;
    const anchorY = rect.anchorY == null ? rect.h : rect.anchorY;
    const left = Math.round(x - anchorX * scale);
    const top = Math.round(y - anchorY * scale);
    const scaleX = Math.round(rect.w * scale) / rect.w;
    const scaleY = Math.round(rect.h * scale) / rect.h;
    return {scaleY, point: p => ({x: left + (p.x - rect.x) * scaleX, y: top + (p.y - rect.y) * scaleY})};
  }

  function drawNoteLines(ctx, rect, x, y, scale, alpha) {
    const projection = bouquetProjection(rect, x, y, scale);
    const lines = [{v: 0.26, end: 0.86}, {v: 0.48, end: 0.77}, {v: 0.70, end: 0.64}];
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#111014';
    const thickness = Math.max(1, Math.round(3.5 * projection.scaleY));
    for (const line of lines) {
      // Small stepped segments retain the sprite's pixel edges on the tilted card.
      const steps = Math.ceil((line.end - 0.12) * 192 / 5);
      for (let i = 0; i < steps; i++) {
        const a = projection.point(notePoint(mix(0.12, line.end, i / steps), line.v));
        const b = projection.point(notePoint(mix(0.12, line.end, (i + 1) / steps), line.v));
        ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.max(1, Math.round(b.x) - Math.round(a.x)), thickness);
      }
    }
    ctx.restore();
  }

  function getGiftNoteBounds(width, height, assets) {
    const rect = assets && assets.manifest && assets.manifest.bouquet;
    if (!rect) return null;
    const scale = Math.min(width * 0.70 / rect.w, height * 0.84 / rect.h);
    const anchorX = rect.anchorX == null ? rect.w / 2 : rect.anchorX;
    const anchorY = rect.anchorY == null ? rect.h : rect.anchorY;
    const x = width * 0.5 + (anchorX - rect.w / 2) * scale;
    const y = height * 0.5 + (anchorY - rect.h / 2) * scale;
    const projection = bouquetProjection(rect, x, y, scale);
    const points = [[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]].map(([u, v]) => projection.point(notePoint(u, v)));
    const left = Math.min(...points.map(p => p.x));
    const top = Math.min(...points.map(p => p.y));
    return {x: left, y: top, width: Math.max(...points.map(p => p.x)) - left, height: Math.max(...points.map(p => p.y)) - top};
  }

  function renderGift(ctx, seconds, assets, options) {
    clear(ctx, options && options.transparent);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const frames = assets.manifest.chest || [];
    const bouquet = assets.manifest.bouquet;
    if (!assets.chest || !frames.length) return;
    const elapsed = Math.max(0, seconds);
    const t = options && options.holdAtEnd ? Math.min(elapsed, GIFT_READY_TIME) : wrap(elapsed, GIFT_DURATION);
    const smooth = value => {const p = clamp(value, 0, 1); return p * p * (3 - 2 * p);};
    const overallAlpha = t < 0.18 ? t / 0.18 : 1 - smooth((t - 7.9) / 0.6);
    const opening = clamp((t - 1.1) / 0.75, 0, 1);
    const frameIndex = Math.min(frames.length - 1, Math.floor(opening * frames.length));
    const rect = frames[frameIndex];
    const finalRect = frames[frames.length - 1];
    const maxW = Math.max(...frames.map(r => r.w));
    const maxH = Math.max(...frames.map(r => r.h));
    const baseScale = Math.min(W * 0.48 / maxW, H * 0.50 / maxH);
    const x = W * 0.5, baseY = H * 0.91;
    const finalAnchorY = finalRect.anchorY == null ? finalRect.h : finalRect.anchorY;
    const finalAnchorX = finalRect.anchorX == null ? finalRect.w / 2 : finalRect.anchorX;
    const frontRatio = assets.manifest.chestFrontRatio == null ? 0.64 : assets.manifest.chestFrontRatio;
    const chestAt = time => {
      const recession = smooth((time - 3.9) / 0.7);
      const scale = baseScale * mix(1, 0.82, recession);
      const y = baseY - H * 0.055 * recession;
      const top = y - finalAnchorY * scale;
      return {scale, y, top, frontY: Math.round(top + finalRect.h * frontRatio * scale)};
    };
    const chest = chestAt(t);
    const chestAlpha = 1 - smooth((t - 4.45) / 0.27);
    ctx.save();
    ctx.globalAlpha = overallAlpha;
    sprite(ctx, assets.chest, rect, x, chest.y, chest.scale, chestAlpha);

    if (t >= 1.86 && assets.bouquet && bouquet) {
      const age = t - 1.86;
      const progress = clamp(age / 1.9, 0, 1);
      const growth = progress * progress * (3 - 2 * progress);
      const emergence = ease(progress);
      const finalBouquetScale = Math.min(W * 0.45 / bouquet.w, H * 0.62 / bouquet.h);
      let bouquetScale = finalBouquetScale * mix(0.16, 1, growth);
      const bHeight = bouquet.h * bouquetScale;
      const baseFrontY = chestAt(3.9).frontY;
      let bouquetX = x;
      let bouquetRoot = baseFrontY + bHeight * mix(0.92, 0.10, emergence);
      const bouquetAnchorX = bouquet.anchorX == null ? bouquet.w / 2 : bouquet.anchorX;
      const bouquetAnchorY = bouquet.anchorY == null ? bouquet.h : bouquet.anchorY;
      const releaseTime = 4.28;
      if (t >= 3.9) {
        // Lift the last visible stems clear of the rim before moving the bouquet
        // into the foreground. The layer switch happens above the chest wall.
        const liftScale = finalBouquetScale * 1.05;
        const clearance = Math.max(4, H * 0.008);
        const clearRoot = chestAt(releaseTime).frontY - clearance - (bouquet.h - bouquetAnchorY) * liftScale;
        const initialRoot = baseFrontY + bouquet.h * finalBouquetScale * 0.10;
        if (t < releaseTime) {
          const lift = smooth((t - 3.9) / (releaseTime - 3.9));
          bouquetScale = mix(finalBouquetScale, liftScale, lift);
          bouquetRoot = mix(initialRoot, clearRoot, lift);
        } else {
          const approach = smooth((t - releaseTime) / (GIFT_READY_TIME - releaseTime));
          const foregroundScale = Math.min(W * 0.70 / bouquet.w, H * 0.84 / bouquet.h);
          const centeredX = W * 0.5 + (bouquetAnchorX - bouquet.w / 2) * foregroundScale;
          const centeredRoot = H * 0.5 + (bouquetAnchorY - bouquet.h / 2) * foregroundScale;
          bouquetScale = mix(liftScale, foregroundScale, approach);
          bouquetX = mix(x, centeredX, approach);
          bouquetRoot = mix(clearRoot, centeredRoot, approach);
        }
      }
      ctx.save();
      ctx.globalAlpha *= chestAlpha;
      renderPinkChestLight(ctx, age, x, chest.frontY, finalRect.w * chest.scale, W, H);
      ctx.restore();
      ctx.save();
      if (t < releaseTime) {
        ctx.beginPath();
        ctx.rect(0, 0, W, chest.frontY + 1);
        ctx.clip();
      }
      sprite(ctx, assets.bouquet, bouquet, bouquetX, bouquetRoot, bouquetScale, clamp(age / 0.18, 0, 1));
      drawNoteLines(ctx, bouquet, bouquetX, bouquetRoot, bouquetScale, clamp(age / 0.18, 0, 1));
      ctx.restore();
      if (t < releaseTime) {
        // Until the stems clear the mouth, the chest wall remains in front.
        const sourceOffset = Math.round(finalRect.h * frontRatio);
        ctx.save();
        ctx.globalAlpha *= chestAlpha;
        ctx.drawImage(assets.chest, finalRect.x, finalRect.y + sourceOffset,
          finalRect.w, finalRect.h - sourceOffset,
          Math.round(x - finalAnchorX * chest.scale), Math.round(chest.top + sourceOffset * chest.scale),
          Math.round(finalRect.w * chest.scale), Math.round((finalRect.h - sourceOffset) * chest.scale));
        ctx.restore();
      }
    }
    ctx.restore();
  }

  return { renderFlowers, renderWalk, renderGift, GIFT_DURATION, GIFT_READY_TIME, getGiftNoteBounds };
});
