(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('world'),ctx=canvas.getContext('2d'),giftCanvas=$('gift-canvas'),giftCtx=giftCanvas.getContext('2d');
  const dialog=$('gift-dialog'),stage=$('gift-stage'),note=$('note-trigger'),card=$('video-card'),slot=$('video-slot'),chestButton=$('open-chest'),letterShell=$('letter-shell');
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),assets={manifest:window.PIXEL_PREVIEW_MANIFEST};
  const model=window.GardenModel,renderer=window.GardenRenderer,gifts=window.PixelPreviewRenderers;
  let state=model.create(),mode='intro',ready=false,lastTime=null,giftTime=0,giftReady=false,videoOpen=false,chestArmed=false,walked=0;
  let pointer=null,pointerOrigin={x:0,y:0},stick={x:0,y:0};
  let letterPhase='closed',revealToken=0,revealAnimations=[];
  const keys=new Set(),movementKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D']);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function announce(text){$('status').textContent=text;}
  function resize(){
    const box=canvas.getBoundingClientRect(),scale=Math.min(1,720/box.width,800/box.height);
    canvas.width=Math.max(1,Math.round(box.width*scale));canvas.height=Math.max(1,Math.round(box.height*scale));
    const giftBox=giftCanvas.getBoundingClientRect();
    giftCanvas.width=Math.max(1,Math.round(giftBox.width*1.5));giftCanvas.height=Math.max(1,Math.round(giftBox.height*1.5));
    layoutGift();
    if(letterPhase==='opening')completeLetterReveal();
  }
  function resetInput(){
    if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
    pointer=null;stick={x:0,y:0};keys.clear();$('joystick').hidden=true;
    state.player.moving=false;state.player.vx=state.player.vy=0;
  }
  function start(){
    if(!ready)return;
    mode='explore';$('welcome').hidden=true;$('hud').hidden=false;$('movement-help').hidden=false;
    canvas.focus({preventScroll:true});announce('Bahçedesin. Çiçeklerin arasındaki küçük sandığı bul.');
  }
  function freshGarden(){
    closeVideo();if(dialog.open)dialog.close();resetInput();
    const previous=state.chest;let next=model.create();
    for(let i=0;i<4&&Math.hypot(next.chest.x-previous.x,next.chest.y-previous.y)<.18;i++)next=model.create();
    state=next;mode='explore';giftReady=false;giftTime=0;walked=0;
    $('movement-help').classList.remove('faded');canvas.focus({preventScroll:true});announce('Yeni bir bahçe. Sandık başka bir yerde saklı.');
  }
  $('start').addEventListener('click',start);$('new-garden').addEventListener('click',freshGarden);
  canvas.addEventListener('pointerdown',event=>{
    if(mode!=='explore'||pointer!==null||event.button!==0)return;
    event.preventDefault();canvas.focus({preventScroll:true});pointer=event.pointerId;pointerOrigin={x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(pointer);stick={x:0,y:0};
    $('joystick').style.left=event.clientX+'px';$('joystick').style.top=event.clientY+'px';$('joystick-knob').style.transform='translate(0,0)';$('joystick').hidden=false;
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointer||mode!=='explore')return;
    const dx=event.clientX-pointerOrigin.x,dy=event.clientY-pointerOrigin.y,length=Math.hypot(dx,dy),radius=42;
    const magnitude=clamp((length-6)/(radius-6),0,1),nx=length?dx/length:0,ny=length?dy/length:0;
    stick={x:nx*magnitude,y:ny*magnitude};$('joystick-knob').style.transform=`translate(${nx*Math.min(length,32)}px,${ny*Math.min(length,32)}px)`;
  });
  const endPointer=event=>{if(event.pointerId===pointer)resetInput();};
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
  window.addEventListener('blur',()=>{resetInput();lastTime=null;});
  document.addEventListener('visibilitychange',()=>{resetInput();lastTime=null;const v=slot.querySelector('video');if(document.hidden&&v)v.pause();});
  document.addEventListener('keydown',event=>{
    if(mode==='explore'&&movementKeys.has(event.key)&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();keys.add(event.key);}
  });
  document.addEventListener('keyup',event=>keys.delete(event.key));
  function input(){return{x:stick.x+(keys.has('ArrowRight')||keys.has('d')||keys.has('D')?1:0)-(keys.has('ArrowLeft')||keys.has('a')||keys.has('A')?1:0),y:stick.y+(keys.has('ArrowDown')||keys.has('s')||keys.has('S')?1:0)-(keys.has('ArrowUp')||keys.has('w')||keys.has('W')?1:0)};}
  function showGift(completed=false){
    resetInput();closeVideo();mode=completed?'bouquet':'found';giftReady=completed;giftTime=completed?gifts.GIFT_READY_TIME:.9;chestArmed=false;
    chestButton.hidden=completed;note.hidden=!completed;note.disabled=!completed;
    $('gift-title').textContent=completed?'Hepsi senin.':'Küçük bir sürpriz.';
    $('gift-hint').textContent=completed?'Demetin üzerindeki mektuba dokun.':'Sandığı açmak için dokun.';
    dialog.showModal();resize();drawGift();
    (completed?note:chestButton).focus({preventScroll:true});announce(completed?'Demetin burada.':'Sandığı buldun. Açmak için bir kez daha dokun.');
  }
  function backGarden(){closeVideo();dialog.close();mode='explore';state.phase='explore';resetInput();canvas.focus({preventScroll:true});}
  $('back-garden').addEventListener('click',backGarden);
  chestButton.addEventListener('pointerdown',()=>{chestArmed=true;});
  chestButton.addEventListener('click',event=>{
    if(mode!=='found'||(!chestArmed&&event.detail!==0))return;
    mode='opening';giftTime=.9;chestButton.hidden=true;note.hidden=true;note.disabled=true;
    $('gift-title').textContent='';$('gift-hint').textContent='';$('back-garden').focus({preventScroll:true});
  });
  function layoutGift(){
    if(!ready||!dialog.open)return;
    const W=giftCanvas.width,H=giftCanvas.height;
    if(!giftReady){
      const frames=assets.manifest.chest,r=frames[0],scale=Math.min(W*.48/Math.max(...frames.map(f=>f.w)),H*.50/Math.max(...frames.map(f=>f.h)));
      chestButton.style.left='50%';chestButton.style.top=((H*.91-r.anchorY*scale+r.h*scale/2)/H*100)+'%';
      chestButton.style.width=(r.w*scale/W*100)+'%';chestButton.style.height=(r.h*scale/H*100)+'%';
    }
    const b=gifts.getGiftNoteBounds(W,H,assets);
    note.style.left=(b.x+b.width/2)/W*100+'%';note.style.top=(b.y+b.height/2)/H*100+'%';
    const ratio=giftCanvas.clientWidth/W,envelopeWidth=Math.max(104,b.width*ratio*1.25);
    note.style.width=envelopeWidth+'px';note.style.height=Math.max(50,envelopeWidth*.57)+'px';
    if(videoOpen){
      card.style.top=Math.max(0,(giftCanvas.clientHeight-card.offsetHeight)/2)+'px';
    }
  }
  function drawGift(){gifts.renderGift(giftCtx,giftTime,assets,{holdAtEnd:true,transparent:true});layoutGift();}
  function closeVideo(){
    revealToken++;revealAnimations.forEach(animation=>animation.cancel());revealAnimations=[];letterPhase='closed';
    stage.classList.remove('letter-opening','letter-open');letterShell.hidden=true;card.inert=false;card.removeAttribute('aria-busy');
    const v=slot.querySelector('video');if(v){v.pause();v.removeAttribute('src');v.load();}slot.replaceChildren();videoOpen=false;card.hidden=true;
    note.setAttribute('aria-expanded','false');note.hidden=!giftReady;note.disabled=!giftReady;
    if(giftReady)$('gift-hint').textContent='Demetin üzerindeki mektuba dokun.';
  }
  function playCardVideo(video){
    if(!videoOpen||letterPhase!=='open'||!video.isConnected||document.hidden)return;
    video.play().catch(()=>{if(video.isConnected&&videoOpen)$('gift-hint').textContent='Videoyu başlatmak için karta dokun.';});
  }
  function completeLetterReveal(){
    if(!videoOpen||letterPhase!=='opening')return;
    letterPhase='open';revealAnimations.forEach(animation=>animation.cancel());revealAnimations=[];
    stage.classList.remove('letter-opening');stage.classList.add('letter-open');letterShell.hidden=true;card.inert=false;card.removeAttribute('aria-busy');
    const video=slot.querySelector('video');if(!video)return;
    video.tabIndex=0;video.currentTime=0;playCardVideo(video);video.focus({preventScroll:true});
    $('gift-hint').textContent='';announce('Mektup açıldı. Video kartın içinde.');
  }
  function revealLetter(){
    const source={x:note.offsetLeft,y:note.offsetTop,width:note.offsetWidth,height:note.offsetHeight};
    note.hidden=true;letterShell.hidden=false;letterShell.style.left=source.x+'px';letterShell.style.top=source.y+'px';
    letterShell.style.width=source.width+'px';letterShell.style.height=source.height+'px';
    layoutGift();
    const scale=source.width*.82/card.offsetWidth,dx=source.x-card.offsetLeft,dy=source.y-card.offsetTop-card.offsetHeight/2;
    const lift=source.height/2+card.offsetHeight*scale/2+10;
    const pose=(x,y,s,angle=0)=>`translate(calc(-50% + ${x}px),${y}px) scale(${s}) rotate(${angle}deg)`;
    letterPhase='opening';stage.classList.add('letter-opening');card.inert=true;card.setAttribute('aria-busy','true');
    $('back-garden').focus({preventScroll:true});$('gift-hint').textContent='';
    const token=++revealToken,options={duration:1400,fill:'both',easing:'linear'};
    if(motion.matches){
      // Preserve the opening cue without the travel/zoom for reduced motion.
      const fade={duration:300,fill:'both',easing:'ease-out'};
      revealAnimations=[card.animate([{opacity:0},{opacity:1}],fade),letterShell.animate([{opacity:1},{opacity:0}],fade),giftCanvas.animate([{opacity:1},{opacity:0}],fade)];
    }else revealAnimations=[
      card.animate([
        {offset:0,transform:pose(dx,dy,scale,-7),opacity:1},
        {offset:.12,transform:pose(dx,dy,scale,-7),easing:'cubic-bezier(.2,.7,.2,1)'},
        {offset:.48,transform:pose(dx,dy-lift,scale,-3),easing:'cubic-bezier(.16,.7,.25,1)'},
        {offset:1,transform:pose(0,0,1),opacity:1}
      ],options),
      letterShell.animate([
        {offset:0,transform:'translate(-50%,-50%) rotate(-7deg)',opacity:1},
        {offset:.48,transform:'translate(-50%,-50%) rotate(-7deg)',opacity:1},
        {offset:.70,transform:'translate(-50%,calc(-50% + 12px)) rotate(-7deg) scale(.85)',opacity:.8},
        {offset:.84,transform:'translate(-50%,calc(-50% + 18px)) rotate(-7deg) scale(.72)',opacity:0},
        {offset:1,opacity:0}
      ],options),
      giftCanvas.animate([{offset:0,opacity:1,transform:'scale(1)'},{offset:.34,opacity:1},{offset:.80,opacity:0,transform:'translateY(10px) scale(.94)'},{offset:1,opacity:0,transform:'translateY(10px) scale(.94)'}],options)
    ];
    Promise.all(revealAnimations.map(animation=>animation.finished)).then(()=>{if(token===revealToken)completeLetterReveal();}).catch(()=>{});
  }
  note.addEventListener('click',()=>{
    if(!giftReady||videoOpen)return;videoOpen=true;card.hidden=false;note.setAttribute('aria-expanded','true');
    const video=document.createElement('video');video.src='assets/card-first-10s.mp4';video.loop=true;video.muted=false;video.playsInline=true;video.controls=false;
    video.disablePictureInPicture=true;video.disableRemotePlayback=true;video.tabIndex=-1;video.setAttribute('aria-label','10 saniyelik sesli video. Kapatmak için Escape tuşuna bas.');
    video.preload='auto';slot.replaceChildren(video);
    const play=()=>playCardVideo(video);
    video.addEventListener('click',()=>{if(video.paused)play();});video.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(video.paused)play();}});
    video.addEventListener('playing',()=>{$('gift-hint').textContent='';});
    video.addEventListener('error',()=>{if(video.isConnected&&video.hasAttribute('src'))$('gift-hint').textContent='Video yüklenemedi. Kapatıp tekrar deneyebilirsin.';});
    revealLetter();
  });
  dialog.addEventListener('pointerdown',event=>{if(videoOpen&&!slot.contains(event.target)){closeVideo();note.focus({preventScroll:true});}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(videoOpen){closeVideo();note.focus({preventScroll:true});}else backGarden();});
  function tick(timestamp){
    const dt=lastTime===null?0:Math.min((timestamp-lastTime)/1000,.05);lastTime=document.hidden?null:timestamp;
    if(ready&&!document.hidden){
      if(mode==='explore'){
        const result=model.update(state,input(),dt,{width:canvas.width,height:canvas.height});
        if(state.player.moving){walked+=dt;if(walked>3)$('movement-help').classList.add('faded');}
        if(result.discovered)showGift();
      }
      renderer.draw(ctx,timestamp/1000,state,assets,{reducedMotion:motion.matches});
      if(dialog.open){
        if(mode==='opening'){
          giftTime=Math.min(gifts.GIFT_READY_TIME,giftTime+dt);
          if(giftTime>=gifts.GIFT_READY_TIME){mode='bouquet';giftReady=true;note.hidden=false;note.disabled=false;$('gift-title').textContent='Hepsi senin.';$('gift-hint').textContent='Demetin üzerindeki mektuba dokun.';drawGift();announce('Demet hazır. Üzerindeki mektupta bir sürpriz daha var.');}
        }
        if(mode==='opening'||mode==='found')drawGift();
      }
    }
    requestAnimationFrame(tick);
  }
  function load(path){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Görsel yüklenemedi'));image.src=path;});}
  async function init(){
    try{
      await Promise.all(Object.keys(assets.manifest.files).map(async name=>{assets[name]=await load(assets.manifest.files[name]);}));
      ready=true;resize();$('start').disabled=false;$('start').textContent='Keşfe çık';requestAnimationFrame(tick);
    }catch(error){$('start').textContent='Yeniden dene';$('start').disabled=false;$('start').addEventListener('click',()=>location.reload(),{once:true});announce('Bahçe yüklenemedi. Yeniden deneyebilirsin.');console.error(error);}
  }
  new ResizeObserver(()=>{resize();if(ready&&dialog.open)drawGift();}).observe($('garden'));
  window.gardenGame={snapshot:()=>({mode,ready,seed:state.seed,player:{...state.player},chest:{...state.chest},flowerCount:state.flowers.length,giftReady,videoOpen,letterPhase,viewport:{width:canvas.width,height:canvas.height}})};
  init();
})();
