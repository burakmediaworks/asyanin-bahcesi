(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GardenRenderer = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const scenes = new WeakMap();
  function project(x, y, width, height) {
    return {x: x * width, y: height * (0.25 + 0.68 * y)};
  }
  function random(seed) {
    let n = seed >>> 0;
    return function () {
      n += 0x6D2B79F5;
      let t = n;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeSurface(ctx, width, height) {
    let surface;
    if (typeof OffscreenCanvas !== 'undefined') surface = new OffscreenCanvas(width, height);
    else if (typeof document !== 'undefined') {
      surface = document.createElement('canvas');
      surface.width = width;
      surface.height = height;
    } else {
      try {surface = new ctx.canvas.constructor(width, height);} catch (_) {return null;}
    }
    return surface;
  }
  function pixelCloud(ctx, x, y, width, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y + 3), Math.round(width), 3);
    ctx.fillRect(Math.round(x + width * 0.13), Math.round(y), Math.round(width * 0.66), 4);
    ctx.fillRect(Math.round(x + width * 0.38), Math.round(y - 2), Math.round(width * 0.27), 3);
  }
  function hill(ctx, W, H, base, amplitude, phase, color) {
    ctx.fillStyle = color;
    const step = Math.max(2, Math.round(W / 140));
    for (let x = 0; x < W; x += step) {
      const ridge = Math.sin(x / W * 7.8 + phase) * 0.65 + Math.sin(x / W * 18 + phase * 0.6) * 0.35;
      const y = Math.round(H * (base + ridge * amplitude));
      ctx.fillRect(x, y, step, Math.ceil(H * 0.34 - y));
    }
  }
  function drawBackground(ctx, W, H, seed) {
    const rand = random((seed || 3) ^ 0x3a5f13);
    const bands = [
      [0, '#28233f'], [.065, '#3c2a4c'], [.12, '#63324e'],
      [.165, '#963d54'], [.205, '#bd5055'], [.24, '#d66c59'],
      [.27, '#62374c'], [.31, '#383144'], [.43, '#2d2d3d'],
      [.58, '#252c37'], [.75, '#202a31'], [.9, '#1b252d']
    ];
    bands.forEach((band, i) => {
      const top = Math.floor(band[0] * H);
      const bottom = Math.ceil((bands[i + 1] ? bands[i + 1][0] : 1) * H);
      ctx.fillStyle = band[1];
      ctx.fillRect(0, top, W, bottom - top);
    });

    // The setting sun is fixed; stepped scan lines keep the low-resolution scene crisp.
    const sunX = Math.round(W * 0.70), sunY = Math.round(H * 0.185);
    const radius = Math.max(18, Math.round(Math.min(W * .105, H * .075)));
    const unit = Math.max(1, Math.round(Math.min(W, H) / 360));
    for (let y = -radius; y <= radius; y += unit * 2) {
      const chord = Math.sqrt(Math.max(0, radius * radius - y * y));
      const tint = (y + radius) / (radius * 2);
      ctx.fillStyle = tint < .30 ? '#ffba70' : tint < .60 ? '#ff965a' : tint < .82 ? '#ef714c' : '#d95246';
      ctx.fillRect(Math.round(sunX - chord), sunY + y, Math.round(chord * 2), unit * 2);
    }
    pixelCloud(ctx, W * .10, H * .11, W * .24, '#9f4c63');
    pixelCloud(ctx, W * .40, H * .075, W * .16, '#754359');
    pixelCloud(ctx, W * .80, H * .15, W * .18, '#aa4b5c');
    pixelCloud(ctx, W * .57, H * .23, W * .24, '#ca645a');
    hill(ctx, W, H, .223, .013, 1.2, '#684053');
    hill(ctx, W, H, .241, .007, 2.7, '#473247');

    // Broken, warm flecks suggest a narrow footpath without restricting movement.
    for (let row = 0; row < 100; row++) {
      const y = row / 100;
      const center = .50 + Math.sin(y * 7.2 + .5) * .085;
      const point = project(center, y, W, H);
      const halfWidth = W * (.012 + y * .032);
      const rowH = Math.ceil(H * .0068) + 1;
      ctx.fillStyle = row % 3 ? '#44313b' : '#4a343e';
      ctx.globalAlpha = .52;
      ctx.fillRect(Math.round(point.x - halfWidth), Math.round(point.y), Math.round(halfWidth * 2), rowH);
    }
    ctx.globalAlpha = 1;
    const grassColors = ['#304136', '#394238', '#35433c', '#4a3c42', '#2c3940', '#4f413e'];
    for (let i = 0; i < 1050; i++) {
      const x = rand(), y = rand();
      const point = project(x, y, W, H);
      const size = (y > .55 ? 2 : 1) * unit;
      ctx.fillStyle = grassColors[Math.floor(rand() * grassColors.length)];
      const tall = rand() > .72;
      ctx.fillRect(Math.round(point.x), Math.round(point.y), size, tall ? size * 3 : size);
      if (tall) ctx.fillRect(Math.round(point.x - size), Math.round(point.y + size), size * 3, size);
    }
    // Fine roots and grass hide the lower boundary without a hard arena outline.
    for (let i = 0; i < 150; i++) {
      const x = rand() * W, y = H * (.925 + rand() * .075);
      ctx.fillStyle = i % 3 ? '#17262b' : '#27372e';
      const stem = 3 + Math.round(rand() * 7);
      ctx.fillRect(Math.round(x), Math.round(y - stem), unit, stem);
      ctx.fillRect(Math.round(x - unit), Math.round(y - stem / 2), unit * 3, unit);
    }
  }
  function background(ctx, state) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    let cached = scenes.get(ctx.canvas);
    if (!cached || cached.width !== W || cached.height !== H || cached.seed !== state.seed) {
      const surface = makeSurface(ctx, W, H);
      cached = {width: W, height: H, seed: state.seed, surface};
      if (surface) drawBackground(surface.getContext('2d'), W, H, state.seed);
      scenes.set(ctx.canvas, cached);
    }
    if (cached.surface) ctx.drawImage(cached.surface, 0, 0);
    else drawBackground(ctx, W, H, state.seed);
  }
  function shadow(ctx, x, y, width, alpha) {
    ctx.save();
    ctx.fillStyle = '#101923';
    ctx.globalAlpha *= alpha;
    ctx.fillRect(Math.round(x - width * .5), Math.round(y - 1), Math.round(width), 3);
    ctx.fillRect(Math.round(x - width * .35), Math.round(y - 2), Math.round(width * .7), 5);
    ctx.restore();
  }
  function anchoredSprite(ctx, image, frame, x, y, scale) {
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h,
      Math.round(x - frame.anchorX * scale), Math.round(y - frame.anchorY * scale),
      Math.round(frame.w * scale), Math.round(frame.h * scale));
  }
  function girlHeight(W, H, y) {
    return 1.45 * clamp(Math.min(W, H) * .17, 52, 76) * mix(.81, 1.08, y);
  }
  function renderGirl(ctx, player, assets) {
    // Keep the feet planted while the walking silhouette gently counter-sways.
    if (!player.moving) return renderGirlPose(ctx, player, assets);
    const point = project(player.x, player.y, ctx.canvas.width, ctx.canvas.height);
    const sway = Math.sin((player.walkTime || 0) * 6 * TAU / 4) * .012;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(sway);
    ctx.translate(-point.x, -point.y);
    renderGirlPose(ctx, player, assets);
    ctx.restore();
  }
  function renderGirlPose(ctx, player, assets) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const graceful = player.moving && assets.manifest.walk.graceful;
    const useSideGait = graceful && assets.girlSideGraceful;
    const sideFrames = (useSideGait ? graceful : assets.manifest.walk)[player.facing];
    const step = player.moving ? Math.floor((player.walkTime || 0) * 6) % 4 : 0;
    if ((player.facing === 'left' || player.facing === 'right') && assets.girlSide && sideFrames) {
      const point = project(player.x, player.y, W, H);
      const scale = girlHeight(W, H, player.y) / (useSideGait ? graceful.sideReferenceHeight : assets.manifest.walk.sideReferenceHeight);
      shadow(ctx, point.x, point.y, 22 * scale * 7, .65);
      anchoredSprite(ctx, useSideGait ? assets.girlSideGraceful : assets.girlSide, sideFrames[step], point.x, point.y, scale);
      return;
    }
    const useFrontGait = graceful && assets.girlGraceful;
    const frames = (useFrontGait ? graceful : assets.manifest.walk)[player.facing === 'back' ? 'back' : 'front'];
    if (!assets.girl || !frames || !frames.length) return;
    const point = project(player.x, player.y, W, H);
    const frontStep = player.moving ? step : 0;
    const pose = frames[frontStep % 2];
    const frame = useFrontGait ? pose : {...pose, h: Math.max(456, pose.h), anchorY: 450};
    const head = useFrontGait ? frames[0] : {...frames[0], h: Math.max(456, frames[0].h), anchorY: 450};
    const sprite = useFrontGait ? assets.girlGraceful : assets.girl;
    const scale = girlHeight(W, H, player.y) / (useFrontGait ? graceful.referenceHeight : 456);
    const neckline = Math.round(point.y - head.anchorY * scale) + Math.round(112 * scale);
    shadow(ctx, point.x, point.y, 22 * scale * 7, .65);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, neckline, W, H - neckline);
    ctx.clip();
    if (frontStep >= 2) {ctx.translate(point.x * 2, 0);ctx.scale(-1, 1);}
    anchoredSprite(ctx, sprite, frame, point.x, point.y, scale);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, neckline);
    ctx.clip();
    anchoredSprite(ctx, sprite, head, point.x, point.y, scale);
    ctx.restore();
  }
  function renderChest(ctx, chest, seconds, assets, reducedMotion) {
    if (!assets.chest || !assets.manifest.chest || chest.found) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const point = project(chest.x, chest.y, W, H);
    const frame = assets.manifest.chest[0];
    const width = clamp(Math.min(W, H) * .067, 23, 32) * mix(.85, 1.04, chest.y);
    shadow(ctx, point.x, point.y, width * .9, .65);
    anchoredSprite(ctx, assets.chest, frame, point.x, point.y, width / frame.w);
    const t = seconds % 7;
    if (!reducedMotion && t > 5.8 && t < 6.6) {
      const glow = Math.sin((t - 5.8) / .8 * Math.PI);
      ctx.save();
      ctx.globalAlpha = glow * .8;
      ctx.fillStyle = '#ffe5af';
      const x = Math.round(point.x + width * .22), y = Math.round(point.y - width * .68);
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x, y - 2, 1, 5);
      ctx.restore();
    }
  }
  function renderFlower(ctx, flower, seconds, player, assets, reducedMotion, gust) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const rect = assets.manifest.flowers[flower.color % assets.manifest.flowers.length];
    if (!rect || !assets.flowers) return;
    const point = project(flower.x, flower.y, W, H);
    const h = clamp(Math.min(W, H) * .091, 28, 42) * mix(.62, 1.2, flower.y) * (flower.height || 1);
    const scale = h / rect.anchorY;
    const phase = flower.phase || 0;
    const sway = reducedMotion ? 0 : Math.sin(seconds * 1.18 + phase) * .64 + Math.sin(seconds * .57 + phase * 1.7) * .38 + gust * 1.8;
    const bend = clamp(flower.bend || 0, -1, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Proximity never changes flower opacity: stems bend aside while petals
    // stay visible, including when a flower overlaps the walking character.
    ctx.globalAlpha = 1;
    ctx.translate(Math.round(point.x), Math.round(point.y));
    if (Math.abs(bend) < .015) {
      ctx.rotate(Math.atan2(sway,Math.max(1,h)));
      ctx.drawImage(assets.flowers, rect.x, rect.y, rect.w, rect.h,
        Math.round(-rect.anchorX * scale), Math.round(-rect.anchorY * scale),
        Math.round(rect.w * scale), Math.round(rect.h * scale));
    } else {
      // Curve the flexible stalk from its fixed root. The flower head rotates
      // as one piece at the stalk's tangent, rather than stretching its petals.
      const headCut = Math.round(rect.anchorY * .56);
      const stalkHeight = (rect.anchorY - headCut) * scale;
      const displacement = bend * h * .22 + sway * .44;
      const strip = Math.max(1,Math.round(2 / scale));
      for (let sy=headCut;sy<rect.h;sy+=strip) {
        const sh=Math.min(strip+1,rect.h-sy);
        const t=clamp((rect.anchorY-sy)/(rect.anchorY-headCut),0,1);
        const offset=displacement*t*t;
        ctx.drawImage(assets.flowers,rect.x,rect.y+sy,rect.w,sh,
          Math.round(-rect.anchorX*scale+offset),Math.round((sy-rect.anchorY)*scale),
          Math.round(rect.w*scale),Math.max(1,Math.ceil(sh*scale)));
      }
      ctx.translate(displacement,-stalkHeight);
      ctx.rotate(Math.atan2(displacement*2,stalkHeight));
      ctx.drawImage(assets.flowers,rect.x,rect.y,rect.w,headCut,
        Math.round(-rect.anchorX*scale),Math.round(-headCut*scale),
        Math.round(rect.w*scale),Math.round(headCut*scale));
    }
    ctx.restore();
  }
  function wind(ctx, seconds, gust) {
    if (gust < .04) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const progress = ((seconds % 14) - 9.4) / 3.4;
    ctx.save();
    ctx.globalAlpha = gust * .26;
    ctx.fillStyle = '#dab2af';
    for (let i = 0; i < 3; i++) {
      const x = Math.round((-0.3 + progress * 1.7 - i * .24) * W);
      const y = Math.round(H * (.42 + i * .17));
      ctx.fillRect(x, y, Math.round(W * .035), 1);
      ctx.fillRect(x + Math.round(W * .035), y - 1, Math.round(W * .023), 1);
      ctx.fillRect(x + Math.round(W * .062), y - 1, Math.round(W * .012), 1);
    }
    ctx.restore();
  }
  function draw(ctx, seconds, state, assets, options) {
    if (!ctx || !state || !assets || !assets.manifest) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    background(ctx, state);
    const reducedMotion = !!(options && options.reducedMotion);
    const time = Math.max(0, seconds || 0);
    const gustTime = time % 14;
    const gust = reducedMotion || gustTime < 9.4 || gustTime > 12.8 ? 0 : Math.pow(Math.sin((gustTime - 9.4) / 3.4 * Math.PI), 2);
    const player = state.player || {x:.5, y:.88, facing:'back', moving:false, walkTime:0};
    const layers = (state.flowers || []).map(flower => ({y:flower.y, type:0, value:flower}));
    if (state.chest && !state.chest.found) layers.push({y:state.chest.y, type:1, value:state.chest});
    layers.push({y:player.y, type:2, value:player});
    layers.sort((a, b) => a.y - b.y || a.type - b.type);
    layers.forEach(layer => {
      if (layer.type === 0) renderFlower(ctx, layer.value, time, player, assets, reducedMotion, gust);
      else if (layer.type === 1) renderChest(ctx, layer.value, time, assets, reducedMotion);
      else renderGirl(ctx, layer.value, assets);
    });
    if (!reducedMotion) wind(ctx, time, gust);
    ctx.restore();
  }

  return {project, draw, renderGirl};
});
