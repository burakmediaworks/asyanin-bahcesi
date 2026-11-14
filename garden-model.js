(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GardenModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const BOUNDS = Object.freeze({minX:0.085,maxX:0.915,minY:0.05,maxY:0.95});
  const START = Object.freeze({x:0.5,y:0.88});
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

  function seedValue(value) {
    if (value == null) {
      if (typeof globalThis === 'object' && globalThis.crypto && globalThis.crypto.getRandomValues) {
        return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
      }
      return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
    let hash = 2166136261;
    for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return hash >>> 0;
  }

  function randomGenerator(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value + 0x6D2B79F5) >>> 0;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(seed) {
    const actualSeed = seedValue(seed);
    const random = randomGenerator(actualSeed);
    // Every candidate is in open terrain and at least .24 world units from spawn.
    const candidates = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 5; column++) {
        const x = 0.17 + column * 0.165 + (random() - 0.5) * 0.055;
        const y = 0.18 + row * 0.15 + (random() - 0.5) * 0.045;
        if (Math.hypot(x - START.x, y - START.y) >= 0.24) candidates.push({x,y});
      }
    }
    const location = candidates[Math.floor(random() * candidates.length)];
    const flowers = [];
    for (let row = 0; row < 18; row++) {
      for (let column = 0; column < 26; column++) {
        let x = (column + 0.5 + (random() - 0.5) * 0.92) / 26;
        let y = (row + 0.5 + (random() - 0.5) * 0.94) / 18;
        // A small irregular clearing makes the first step readable without an empty garden.
        const dx = x - START.x, dy = y - START.y;
        const radius = Math.hypot(dx, dy);
        if (radius < 0.045) {
          const angle = radius > 0.001 ? Math.atan2(dy, dx) : random() * TAU;
          const outside = 0.048 + random() * 0.012;
          x = START.x + Math.cos(angle) * outside;
          y = START.y + Math.sin(angle) * outside;
        }
        flowers.push({
          x:clamp(x,0.012,0.988),y:clamp(y,0.012,0.988),
          color:Math.floor(random() * 8),height:0.8 + random() * 0.4,
          phase:random() * TAU,bend:0,velocity:0,contactSide:0,contactMemory:0
        });
      }
    }
    return {
      seed:actualSeed,phase:'explore',time:0,
      player:{x:START.x,y:START.y,facing:'front',moving:false,walkTime:0,vx:0,vy:0},
      chest:{x:location.x,y:location.y,found:false},flowers
    };
  }

  function update(state, input, dt, viewport) {
    const seconds = clamp(finite(dt,0),0,0.05);
    const width = Math.max(1,finite(viewport && viewport.width,360));
    const height = Math.max(1,finite(viewport && viewport.height,640));
    const groundHeight = height * 0.68;
    const unit = Math.min(width,height);
    const player = state.player;
    state.time += seconds;
    let ix = finite(input && input.x,0), iy = finite(input && input.y,0);
    const length = Math.hypot(ix,iy);
    if (length > 1) {ix /= length;iy /= length;}
    if (length < 0.035 || state.phase !== 'explore') {ix = 0;iy = 0;}

    const oldX = player.x, oldY = player.y;
    const speed = unit * 0.26;
    player.x = clamp(player.x + ix * speed * seconds / width,BOUNDS.minX,BOUNDS.maxX);
    player.y = clamp(player.y + iy * speed * seconds / groundHeight,BOUNDS.minY,BOUNDS.maxY);
    player.vx = seconds ? (player.x - oldX) / seconds : 0;
    player.vy = seconds ? (player.y - oldY) / seconds : 0;
    player.moving = Math.abs(player.vx) + Math.abs(player.vy) > 0.00001;
    if (player.moving) {
      player.walkTime += seconds * Math.min(1,Math.hypot(player.vx * width,player.vy * groundHeight) / speed);
      // Keep the selected axis around diagonals; only a clear turn changes it.
      const horizontal = player.facing === 'left' || player.facing === 'right';
      const faceHorizontally = horizontal ? Math.abs(iy) <= Math.abs(ix) * 1.25 : Math.abs(ix) > Math.abs(iy) * 1.25;
      if (faceHorizontally) player.facing = ix < 0 ? 'left' : 'right';
      else player.facing = iy < 0 ? 'back' : 'front';
    }

    // Match the renderer's projected sizes. Contact follows the visible plant
    // body and the girl's torso rather than treating both as points at their roots.
    const girlHeight = 1.45 * clamp(unit * 0.17,52,76) * (0.81 + 0.27 * player.y);
    const torsoX = player.x * width + player.vx * width * 0.06;
    const torsoY = player.y * groundHeight - girlHeight * 0.42 + player.vy * groundHeight * 0.06;
    for (const flower of state.flowers) {
      const flowerHeight = clamp(unit * 0.091,28,42) * (0.62 + 0.58 * flower.y) * (flower.height || 1);
      const dx = flower.x * width - torsoX;
      const dy = flower.y * groundHeight - flowerHeight * 0.58 - torsoY;
      const contactWidth = girlHeight * 0.15 + flowerHeight * 0.22 + 2;
      const contactHeight = girlHeight * 0.24 + flowerHeight * 0.40;
      const contactDistance = Math.hypot(dx / contactWidth,dy / contactHeight);
      let target = 0;
      const touching = player.moving && contactDistance < 1;
      if (touching) {
        if (!flower.contactSide) {
          flower.contactSide = Math.abs(dx) > 2 ? Math.sign(dx) : (Math.sign(ix) || (Math.sin(flower.phase || 0) < 0 ? -1 : 1));
        }
        flower.contactMemory = 0.22;
        target = flower.contactSide * 0.94 * Math.pow(1 - contactDistance,0.55);
      } else {
        flower.contactMemory = Math.max(0,(flower.contactMemory || 0) - seconds);
        if (!flower.contactMemory) flower.contactSide = 0;
      }
      // Fast contact response, then a softer underdamped return with one small overshoot.
      const stiffness = touching ? 220 : 56;
      const damping = touching ? 25 : 9.5;
      const steps = Math.max(1,Math.ceil(seconds / 0.008));
      const step = seconds / steps;
      for (let i = 0; i < steps; i++) {
        flower.velocity += ((target - flower.bend) * stiffness - flower.velocity * damping) * step;
        flower.bend = clamp(flower.bend + flower.velocity * step,-1,1);
      }
      if (!touching && Math.abs(flower.bend) < 0.001 && Math.abs(flower.velocity) < 0.01) {
        flower.bend = 0;flower.velocity = 0;
      }
    }

    const nearChest = Math.hypot((player.x - state.chest.x) * width,(player.y - state.chest.y) * groundHeight) <= unit * 0.075;
    if (state.phase === 'explore' && !state.chest.found && nearChest) {
      state.chest.found = true;
      state.phase = 'discovered';
      player.moving = false;player.vx = 0;player.vy = 0;
      return {discovered:true};
    }
    return {discovered:false};
  }

  return {create,update,BOUNDS};
});
