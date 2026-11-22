/* ALTITUDE — cinematic takeoff scene (Three.js r128, no build step).
   Everything is procedural: aircraft, airport, sky, clouds. No external assets. */
(function () {
'use strict';
console.log('[ALTITUDE] scene.js build v4 — realistic airport world (glow fix)');
const API = window.SkyScene = { ok: false, T: 0, introDone: false };

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

API.init = function (canvas, opts) {
  opts = opts || {};
  if (typeof THREE === 'undefined' || !webglOK()) return false;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }

  const mobile = matchMedia('(max-width: 820px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  const reduced = !!opts.reduced;
  const INTRO = 48;                 // seconds until the idle "cruise" shot
  const SKIP_T = 52;
  let pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
  renderer.setPixelRatio(pr);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 40000);
  const sunDir = new THREE.Vector3(0.55, 0.17, -0.82).normalize();
  const FOG = new THREE.Color(0.86, 0.72, 0.60);
  scene.fog = new THREE.FogExp2(FOG, 0.00026);

  // Aircraft visibility lighting. The original scene relied almost entirely on
  // physically-based materials but did not provide a scene-level light, which
  // made the aircraft render as a black silhouette against the sky.
  const hemiLight = new THREE.HemisphereLight(0xdbeeff, 0x4a4038, 2.2);
  scene.add(hemiLight);
  const sunLight = new THREE.DirectionalLight(0xffe4c2, 3.0);
  sunLight.position.set(260, 420, -380);
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 1400;
  sunLight.shadow.camera.left = -500;
  sunLight.shadow.camera.right = 500;
  sunLight.shadow.camera.top = 500;
  sunLight.shadow.camera.bottom = -500;


  /* ───────────── Sky + image-based lighting ───────────── */
  const skyUniforms = { uSun: { value: sunDir }, uLin: { value: 0 }, uAlt: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      uniform vec3 uSun; uniform float uLin; uniform float uAlt; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        vec3 zen = vec3(0.027,0.082,0.16), hi = vec3(0.17,0.42,0.72), mid = vec3(0.47,0.72,0.91), hor = vec3(0.96,0.77,0.58), haze = vec3(0.86,0.72,0.60);
        float t = clamp(h,0.,1.);
        vec3 col = mix(hor, mid, smoothstep(0.0,0.2,t));
        col = mix(col, hi, smoothstep(0.14,0.55,t));
        col = mix(col, zen, smoothstep(0.5,1.0,t));
        float s = max(dot(d,uSun),0.);
        col += vec3(1.0,0.60,0.28)*pow(s,4.)*0.5;
        col += vec3(1.0,0.78,0.5)*pow(s,36.)*0.65;
        col += vec3(1.0,0.95,0.8)*smoothstep(0.9992,0.9997,s)*3.0;
        col = mix(col, haze, smoothstep(0.015,-0.07,h));
        col = mix(col, col*vec3(0.84,0.94,1.1), uAlt*0.55);
        if(uLin>0.5) col = pow(col, vec3(2.2));
        gl_FragColor = vec4(col,1.);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  {
    // Canvas-based environment map. This deliberately avoids rendering the sky
    // shader into PMREM, so the environment uses explicit sRGB pixel colours.
    const ew=512, eh=256, ec=document.createElement('canvas'); ec.width=ew; ec.height=eh;
    const ectx=ec.getContext('2d'), ed=ectx.createImageData(ew,eh);
    const eSun=new THREE.Vector3(.55,.17,-.82).normalize();
    for(let y=0;y<eh;y++){
      const v=y/(eh-1), h=1-v, t=Math.max(0,Math.min(1,(h+.02)/1.02));
      let r,g,b;
      if(t<.2){ const u=t/.2; r=0.96+(0.47-0.96)*u; g=0.77+(0.72-0.77)*u; b=0.58+(0.91-0.58)*u; }
      else if(t<.55){ const u=(t-.2)/.35; r=0.47+(0.17-0.47)*u; g=0.72+(0.42-0.72)*u; b=0.91+(0.72-0.91)*u; }
      else { const u=(t-.55)/.45; r=0.17+(0.027-0.17)*u; g=0.42+(0.082-0.42)*u; b=0.72+(0.16-0.72)*u; }
      for(let x=0;x<ew;x++){
        const i=(y*ew+x)*4, lon=(x/ew)*Math.PI*2-Math.PI, dx=Math.cos(lon)*Math.cos((v-.5)*Math.PI), dz=Math.sin(lon)*Math.cos((v-.5)*Math.PI), dy=Math.sin((v-.5)*Math.PI);
        const s=Math.max(0,dx*eSun.x+dy*eSun.y+dz*eSun.z);
        const warm=.5*Math.pow(s,4)+.65*Math.pow(s,36);
        ed.data[i]=Math.min(255,(r+warm)*255); ed.data[i+1]=Math.min(255,(g+warm*.60)*255); ed.data[i+2]=Math.min(255,(b+warm*.28)*255); ed.data[i+3]=255;
      }
    }
    ectx.putImageData(ed,0,0);
    const envTex=new THREE.CanvasTexture(ec); envTex.encoding=THREE.sRGBEncoding; envTex.mapping=THREE.EquirectangularReflectionMapping; envTex.needsUpdate=true;
    const pmrem=new THREE.PMREMGenerator(renderer);
    scene.environment=pmrem.fromEquirectangular(envTex).texture;
    pmrem.dispose(); envTex.dispose();
  }

  const sun = new THREE.DirectionalLight(0xffd0a0, 2.7);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 900 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xa9c8ea, 0x6a5a48, 0.55));

  /* ───────────── Canvas texture helpers ───────────── */
  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const glowTex = canvasTex(64, 64, (ctx, w, h) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); });
  const noise = (ctx, w, h, n, a, r) => { for (let i = 0; i < n; i++) { const v = (r() * 255) | 0; ctx.fillStyle = `rgba(${v},${v},${v},${a})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } };

  /* ───────────── Glow points (lights, exhaust) ───────────── */
  const glowUniforms = { uScale: { value: 800 }, uFog: { value: 0.00026 } };
  const glowMat = new THREE.ShaderMaterial({
    uniforms: glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying vec3 vC; varying float vA; uniform float uScale; uniform float uFog;
      void main(){ vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.); float d = max(-mv.z,1.);
        vA = aAlpha*exp(-pow(d*uFog,2.)); gl_PointSize = clamp(aSize*uScale/d, 1.5, 200.); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.; float a = smoothstep(1.,0.,d); a *= a; gl_FragColor = vec4(vC, a*vA); }'
  });
  function makeGlow(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    const p = new THREE.Points(g, glowMat); p.frustumCulled = false; return p;
  }
  function staticGlow(list, color, size, alpha) {
    const p = makeGlow(list.length), a = p.geometry.attributes;
    list.forEach((v, i) => { a.position.setXYZ(i, v[0], v[1], v[2]); a.aColor.setXYZ(i, color[0], color[1], color[2]); a.aSize.setX(i, size); a.aAlpha.setX(i, alpha); });
    scene.add(p); return p;
  }

  /* ───────────── Ground, runway, airport ───────────── */
  const GS = 30000, GREP = 700;
  const grassTex = canvasTex(512, 512, (ctx, w, h) => {
    const r = rng(7); ctx.fillStyle = '#4a4f30'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) { ctx.fillStyle = `rgba(${60 + r() * 40},${64 + r() * 36},${30 + r() * 20},.25)`; ctx.beginPath(); ctx.arc(r() * w, r() * h, 20 + r() * 70, 0, 7); ctx.fill(); }
    noise(ctx, w, h, 6000, .1, r);
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(GREP, GREP);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GS, GS), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0, color: C('#b0a890') }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const RWY_L = 4200, RWY_Z0 = 300;
  const asphalt = canvasTex(512, 1024, (ctx, w, h) => {
    const r = rng(11); ctx.fillStyle = '#34363a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const v = 44 + r() * 14; ctx.fillStyle = `rgba(${v},${v + 1},${v + 3},.35)`; ctx.fillRect(r() * w, r() * h, 30 + r() * 140, 20 + r() * 120); }
    noise(ctx, w, h, 16000, .12, r);
    ctx.fillStyle = '#d9d7d0';
    ctx.fillRect(14, 0, 8, h); ctx.fillRect(w - 22, 0, 8, h);        // edge lines
    [0, 512].forEach(y => ctx.fillRect(w / 2 - 4, y, 8, 256));        // dashed centreline
    ctx.fillStyle = 'rgba(15,15,18,.28)'; for (let i = 0; i < 9; i++) ctx.fillRect(w / 2 - 40 + i * 4 + r() * 70 - 35, 300 + r() * 600, 3, 80 + r() * 130);
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(1, RWY_L / 120);
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(60, RWY_L), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.72, metalness: 0.05, envMapIntensity: 0.7 }));
  runway.rotation.x = -Math.PI / 2; runway.position.set(0, 0.12, RWY_Z0 - RWY_L / 2); runway.receiveShadow = true; scene.add(runway);

  const markTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#e4e2da';
    for (let i = 0; i < 12; i++) ctx.fillRect(40 + i * 36 + (i > 5 ? 20 : 0), 10, 22, 190);
    ctx.font = '700 150px Sora, Arial'; ctx.textAlign = 'center'; ctx.fillText('09', w / 2, 400);
  });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: markTex, transparent: true, roughness: .8 }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.16, RWY_Z0 - 42); mark.receiveShadow = true; scene.add(mark);
  const aimTex = canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = '#e4e2da'; ctx.fillRect(30, 40, 50, 180); ctx.fillRect(w - 80, 40, 50, 180); for (let i = 0; i < 3; i++) { ctx.fillRect(100, 40 + i * 30, 12, 20); ctx.fillRect(w - 112, 40 + i * 30, 12, 20); } });
  [-300, -700].forEach(z => { const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: aimTex, transparent: true, roughness: .8 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.16, z); m.receiveShadow = true; scene.add(m); });
  // apron / taxiway
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 900), new THREE.MeshStandardMaterial({ map: asphalt, color: C('#9a9a9a'), roughness: .8 }));
  apron.material.map = asphalt.clone(); apron.material.map.needsUpdate = true; apron.material.map.wrapS = apron.material.map.wrapT = THREE.RepeatWrapping; apron.material.map.repeat.set(4, 8);
  apron.rotation.x = -Math.PI / 2; apron.position.set(-170, 0.1, -140); apron.receiveShadow = true; scene.add(apron);
  const taxi = new THREE.Mesh(new THREE.PlaneGeometry(26, 900), new THREE.MeshStandardMaterial({ color: C('#3a3c40'), roughness: .8 }));
  taxi.rotation.x = -Math.PI / 2; taxi.position.set(-100, 0.11, -140); scene.add(taxi);

  // runway + approach lights
  {
    const edge = [], gl = [], rd = [];
    for (let z = RWY_Z0; z > RWY_Z0 - RWY_L; z -= 60) { edge.push([-32, 0.5, z], [32, 0.5, z]); }
    for (let x = -28; x <= 28; x += 5.6) { gl.push([x, 0.5, RWY_Z0 + 2]); rd.push([x, 0.5, RWY_Z0 - RWY_L - 2]); }
    for (let z = RWY_Z0 + 40; z < RWY_Z0 + 900; z += 30) { edge.push([0, 0.9, z]); }
    staticGlow(edge, [1.0, 0.78, 0.5], 1.7, 0.95); staticGlow(gl, [0.2, 1, 0.4], 1.8, 0.95); staticGlow(rd, [1, 0.15, 0.12], 1.8, 0.95);
  }

  // terminal, tower, hangars
  const airport = new THREE.Group(); scene.add(airport);
  {
    const facade = canvasTex(512, 128, (ctx, w, h) => { const r = rng(3); ctx.fillStyle = '#8e969f'; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) for (let y = 14; y < h - 10; y += 28) { ctx.fillStyle = r() > .3 ? '#2b3b4c' : '#1c2733'; ctx.fillRect(x + 2, y, 12, 18); } });
    facade.wrapS = facade.wrapT = THREE.RepeatWrapping; facade.repeat.set(10, 1);
    const lit = canvasTex(512, 128, (ctx, w, h) => { const r = rng(5); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) for (let y = 14; y < h - 10; y += 28) { if (r() > .45) { ctx.fillStyle = r() > .5 ? '#ffcf8a' : '#ffe9c2'; ctx.fillRect(x + 2, y, 12, 18); } } });
    lit.wrapS = lit.wrapT = THREE.RepeatWrapping; lit.repeat.set(10, 1);
    const bm = new THREE.MeshStandardMaterial({ map: facade, emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: .7, roughness: .6, metalness: .2 });
    const roofM = new THREE.MeshStandardMaterial({ color: C('#d9dde2'), roughness: .5 });
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; airport.add(o); return o; };
    add(new THREE.BoxGeometry(70, 20, 430), bm, -330, 10, -70);
    add(new THREE.BoxGeometry(76, 2.5, 436), roofM, -330, 21, -70);
    for (let i = 0; i < 5; i++) { add(new THREE.BoxGeometry(150, 12, 24), bm, -250 + 0, 6, -230 + i * 88 - 24).scale.x = 1; }
    add(new THREE.CylinderGeometry(4.2, 5.4, 64, 20), new THREE.MeshStandardMaterial({ color: C('#cfd5db'), roughness: .5 }), -300, 32, 210);
    add(new THREE.CylinderGeometry(10, 8, 9, 20), new THREE.MeshStandardMaterial({ color: C('#1b2a38'), roughness: .2, metalness: .6, emissive: 0x2a3a4a, emissiveIntensity: .5 }), -300, 68, 210);
    add(new THREE.CylinderGeometry(11, 11, 1.4, 20), roofM, -300, 73.4, 210);
    for (let i = 0; i < 3; i++) { const h = add(new THREE.CylinderGeometry(24, 24, 120, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: C('#8a949e'), roughness: .5, metalness: .3, side: THREE.DoubleSide }), -150, 0, 360 + i * 70); h.rotation.set(Math.PI / 2, 0, Math.PI / 2); h.position.y = 0.1; }
    const poles = []; for (let i = 0; i < 9; i++) poles.push([-80, 22, 120 - i * 100]);
    poles.forEach(p => add(new THREE.CylinderGeometry(.4, .6, 22, 8), roofM, p[0], 11, p[2]));
    staticGlow(poles.map(p => [p[0], p[1] + 0.5, p[2]]), [1, .82, .55], 9, .8);
    staticGlow([[-300, 79, 210]], [1, .25, .2], 6, .9);
  }
  /* ───────────── Expanded airport world dressing ─────────────
     The aircraft, sky, clouds, trajectory and camera are intentionally untouched.
     Everything below is scenery placed around the existing airport. */
  const worldVehicles = [];
  const worldLights = [];
  const cityR = rng(90210);

  const worldMat = (hex, rough=0.72, metal=0) =>
    new THREE.MeshStandardMaterial({ color:C(hex), roughness:rough, metalness:metal });

  const windowTex = canvasTex(128, 256, (ctx,w,h) => {
    ctx.fillStyle = '#68727a'; ctx.fillRect(0,0,w,h);
    for(let y=8;y<h-8;y+=18){
      for(let x=6;x<w-5;x+=15){
        const lit = ((x*7+y*3)%61) > 23;
        ctx.fillStyle = lit ? '#b9d4df' : '#263640';
        ctx.fillRect(x,y,8,10);
      }
    }
    ctx.fillStyle='rgba(255,255,255,.10)';
    for(let y=0;y<h;y+=64) ctx.fillRect(0,y,w,2);
  });
  windowTex.wrapS=windowTex.wrapT=THREE.RepeatWrapping;
  windowTex.repeat.set(1,4);

  const terminalGlassTex = canvasTex(512,256,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#182d3b'); g.addColorStop(.45,'#6d9caf'); g.addColorStop(1,'#203b4b');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(210,235,242,.42)'; ctx.lineWidth=3;
    for(let x=0;x<w;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+18,h);ctx.stroke();}
    for(let y=0;y<h;y+=58){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  });
  terminalGlassTex.wrapS=terminalGlassTex.wrapT=THREE.RepeatWrapping;

  const terminalGlass = new THREE.MeshPhysicalMaterial({
    map:terminalGlassTex, transparent:true, opacity:.78,
    roughness:.18, metalness:.12, clearcoat:.45
  });
  const terminalWhite = worldMat('#dce3e8',.48,.12);
  const terminalDark = worldMat('#26333d',.42,.2);
  const roofDark = worldMat('#46535e',.48,.35);
  const concrete = worldMat('#aab0b4',.82,0);
  const roadMat = worldMat('#292d31',.94,0);
  const taxiYellow = worldMat('#d6b64a',.7,0);
  const safetyOrange = worldMat('#d86f2d',.58,.05);
  const fenceMat = worldMat('#66727a',.72,.25);

  function worldAdd(geo,mat,x,y,z,opts){
    const o=new THREE.Mesh(geo,mat);
    o.position.set(x,y,z);
    if(opts&&opts.rotation) o.rotation.set(opts.rotation[0]||0,opts.rotation[1]||0,opts.rotation[2]||0);
    if(opts&&opts.scale) o.scale.set(opts.scale[0],opts.scale[1],opts.scale[2]);
    o.castShadow=opts&&opts.castShadow!==undefined?opts.castShadow:true;
    o.receiveShadow=opts&&opts.receiveShadow!==undefined?opts.receiveShadow:true;
    airport.add(o); return o;
  }

  function makeRoad(x,z,w,d,rot=0){
    const r=worldAdd(new THREE.PlaneGeometry(w,d),roadMat,x,.145,z,{castShadow:false});
    r.rotation.x=-Math.PI/2; r.rotation.z=rot; return r;
  }

  function makeRoadMark(x,z,w,d,rot=0,color='#e7dfb7'){
    const m=worldAdd(new THREE.PlaneGeometry(w,d),worldMat(color,.9,0),x,.17,z,{castShadow:false});
    m.rotation.x=-Math.PI/2; m.rotation.z=rot; return m;
  }

  /* Large terminal concourse behind the parked fleet. */
  {
    const base=worldAdd(new THREE.BoxGeometry(230,18,300),terminalWhite,-340,9,-105);
    base.receiveShadow=true;
    worldAdd(new THREE.BoxGeometry(238,2.8,308),roofDark,-340,19.5,-105);

    // Continuous glass curtain wall facing the apron.
    for(let i=0;i<9;i++){
      worldAdd(new THREE.BoxGeometry(24,12,2.2),terminalGlass,-432+i*23,8,-257);
      worldAdd(new THREE.BoxGeometry(24,12,2.2),terminalGlass,-432+i*23,8,47);
    }

    // Arched canopy: repeated structural ribs with a light roof strip.
    const ribGeo=new THREE.TorusGeometry(19,1.15,8,28,Math.PI);
    for(let i=0;i<7;i++){
      const rib=worldAdd(ribGeo,terminalWhite,-410+i*23,20.5,-260,{castShadow:true});
      rib.rotation.x=Math.PI/2;
      rib.rotation.z=Math.PI;
      rib.scale.set(1,1.25,1);
    }
    worldAdd(new THREE.BoxGeometry(166,2.2,5),roofDark,-340,31,-260);

    // Entrance canopies and signs.
    for(let i=0;i<4;i++){
      const x=-405+i*43;
      worldAdd(new THREE.BoxGeometry(31,1.2,13),terminalWhite,x,9,-272);
      worldAdd(new THREE.BoxGeometry(1,7,1),terminalDark,x-13,5,-272);
      worldAdd(new THREE.BoxGeometry(1,7,1),terminalDark,x+13,5,-272);
    }

    // Three passenger piers.
    [-395,-340,-285].forEach((x,idx)=>{
      worldAdd(new THREE.BoxGeometry(26,8,150),terminalWhite,x,4,-345-idx*8);
      worldAdd(new THREE.BoxGeometry(22,6,146),terminalGlass,x,7,-345-idx*8);
      for(let g=0;g<3;g++){
        const z=-305-g*42-idx*8;
        worldAdd(new THREE.BoxGeometry(20,1.1,6),roofDark,x,11,z);
        worldAdd(new THREE.BoxGeometry(4,4,16),terminalWhite,x+15,5,z);
        // jet bridge
        const jb=worldAdd(new THREE.BoxGeometry(30,3.2,5),terminalGlass,x+29,8,z,{castShadow:true});
        jb.rotation.y=(idx%2?-0.06:0.06);
        worldAdd(new THREE.CylinderGeometry(3.2,3.2,5,16),terminalWhite,x+44,6.5,z,{rotation:[0,0,0]});
      }
    });

    // Terminal roof equipment and service blocks.
    for(let i=0;i<12;i++){
      worldAdd(new THREE.BoxGeometry(7,2.4,4),terminalDark,-440+(i%6)*38,22.2,-90+Math.floor(i/6)*32);
    }
  }

  /* Three large arched maintenance hangars behind the departure area. */
  {
    function hangar(x,z,w,d,h){
      const shape=new THREE.Shape();
      shape.moveTo(-w/2,0); shape.lineTo(w/2,0); shape.lineTo(w/2,h*.52);
      shape.absarc(0,h*.52,w/2,0,Math.PI,false); shape.lineTo(-w/2,0);
      const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1});
      geo.translate(0,0,-d/2);
      const shell=worldAdd(geo,worldMat('#727c84',.64,.18),x,h*.02,z);
      shell.castShadow=true;
      const door=worldAdd(new THREE.PlaneGeometry(w*.76,h*.43),worldMat('#20282e',.5,.35),x,h*.23,z-d/2-.02);
      door.rotation.y=Math.PI; door.receiveShadow=false;
      // glowing hangar seam
      const seam=worldAdd(new THREE.PlaneGeometry(w*.015,h*.43),worldMat('#e2b85f',.35,.25),x,h*.23,z-d/2-.05);
      seam.rotation.y=Math.PI;
      return shell;
    }
    hangar(180,210,150,105,72);
    hangar(355,235,165,112,78);
    hangar(540,260,175,118,82);
    for(let i=0;i<3;i++){
      worldAdd(new THREE.BoxGeometry(110+i*10,2,4),roofDark,180+i*175,4,155+i*25);
    }
  }

  /* Cargo, fuel and airport operations zone. */
  {
    for(let i=0;i<6;i++){
      const x=180+i*62;
      worldAdd(new THREE.BoxGeometry(52,14,70),worldMat(i%2?'#8a9297':'#727b82',.75,.15),x,7,-120-i*12);
      worldAdd(new THREE.BoxGeometry(46,8,2),terminalDark,x,7,-155-i*12);
    }

    // Fuel tanks with containment rings.
    [180,235,290].forEach((x,i)=>{
      worldAdd(new THREE.CylinderGeometry(15,15,24,32),worldMat('#c7cdd0',.4,.65),x,12,470+i*5);
      worldAdd(new THREE.TorusGeometry(16.5,1.2,8,32),safetyOrange,x,.5,470+i*5,{rotation:[Math.PI/2,0,0]});
      worldAdd(new THREE.BoxGeometry(4,20,4),terminalDark,x+12,10,470+i*5);
    });
  }

  /* Taxiway loop and connectors beside the runway. */
  makeRoad(-78,-260,38,720,0);
  makeRoad(-145,-70,150,28,0);
  makeRoad(-145,-430,150,28,0);
  makeRoad(100,80,240,24,0);
  makeRoad(100,310,240,24,0);
  for(let z=-570;z<160;z+=42){
    makeRoadMark(-78,z,2.2,16,0);
  }
  for(let z=-540;z<100;z+=28){
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x56d7ff,transparent:true,depthWrite:false,fog:false}));
    glow.scale.set(1.2,1.2,1); glow.position.set(-97,.55,z); airport.add(glow); worldLights.push(glow);
  }

  /* Perimeter road, parking and roadside barriers. */
  makeRoad(-520,-700,36,1200,0);
  makeRoad(-520,-1310,36,420,0);
  for(let z=-1200;z<-260;z+=34){
    makeRoadMark(-500,z,1.4,10,0,'#d7d7cf');
  }
  for(let row=0;row<5;row++){
    for(let col=0;col<9;col++){
      const x=-650+col*18, z=-520-row*24;
      worldAdd(new THREE.BoxGeometry(5.4,1.8,10),row%2?worldMat('#cbd1d4',.55,.2):worldMat('#7b8790',.65,.2),x,.9,z,{castShadow:false});
      makeRoadMark(x+4,z,0.8,8,0,'#d9d5c6');
    }
  }

  /* Airport perimeter fencing: posts + three horizontal rails. */
  for(let z=-1500;z<500;z+=22){
    worldAdd(new THREE.BoxGeometry(.16,3.2,.16),fenceMat,-760,1.6,z,{castShadow:false});
    if(z%44===0){
      worldAdd(new THREE.BoxGeometry(.08,1.4,22),fenceMat,-760,1.4,z,{castShadow:false});
    }
  }
  for(let x=-760;x<760;x+=28){
    worldAdd(new THREE.BoxGeometry(.16,3.2,.16),fenceMat,x,1.6,-1510,{castShadow:false});
  }

  /* Floodlight masts around the apron. */
  for(let i=0;i<10;i++){
    const x=-510+i*48, z=-500-(i%5)*120;
    worldAdd(new THREE.CylinderGeometry(.35,.55,26,10),terminalDark,x,13,z);
    worldAdd(new THREE.BoxGeometry(5,1.2,2),terminalDark,x,26,z);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffdca0,transparent:true,depthWrite:false,fog:false}));
    glow.scale.set(9,9,1); glow.position.set(x,25.5,z); airport.add(glow); worldLights.push(glow);
  }

  /* Moving service vehicles, deliberately kept small so they never compete with the hero aircraft. */
  function addVehicle(x,z,route,mat){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(5.5,2.1,9),mat); body.position.y=1.35; g.add(body);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(4.1,1.0,4.2),terminalGlass); roof.position.y=2.85; g.add(roof);
    const beacon=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffb52e,transparent:true,depthWrite:false,fog:false})); beacon.scale.set(1.4,1.4,1); beacon.position.set(0,3.4,0); g.add(beacon);
    g.position.set(x,0,z); airport.add(g); worldVehicles.push({g,route,baseX:x,baseZ:z});
  }
  for(let i=0;i<8;i++) addVehicle(-180+(i%4)*35,-80-Math.floor(i/4)*190, i%2, i%2?taxiYellow:safetyOrange);

  /* ───────────── Distant city: batched facade bands on both sides ───────────── */
  {
    const cityGroup=new THREE.Group(); scene.add(cityGroup);
    const boxGeo=new THREE.BoxGeometry(1,1,1);
    const shades=[
      worldMat('#56626d',.9,.05),
      worldMat('#6f7880',.88,.04),
      worldMat('#454f59',.92,.03)
    ];
    const batches=mobile?3:6;
    for(let b=0;b<shades.length;b++){
      const count=batches*26;
      const im=new THREE.InstancedMesh(boxGeo,shades[b],count);
      const mat4=new THREE.Matrix4(), scale=new THREE.Vector3();
      let idx=0;
      for(let side=-1;side<=1;side+=2){
        for(let i=0;i<count/2;i++){
          const z=-280-cityR()*3000;
          const x=side*(620+cityR()*1700);
          const w=35+cityR()*65;
          const d=38+cityR()*75;
          const h=30+Math.pow(cityR(),.45)*(b===2?250:150);
          scale.set(w,h,d); mat4.compose(new THREE.Vector3(x,h/2-.2,z),new THREE.Quaternion(),scale); im.setMatrixAt(idx++,mat4);
        }
      }
      im.castShadow=false; im.receiveShadow=true; cityGroup.add(im);
    }

    // A closer layer with actual facade/window texture gives the skyline depth.
    const closeMat=new THREE.MeshStandardMaterial({map:windowTex,roughness:.74,metalness:.12});
    const closeCount=mobile?34:60;
    const close=new THREE.InstancedMesh(boxGeo,closeMat,closeCount);
    const m4=new THREE.Matrix4(), scv=new THREE.Vector3();
    for(let i=0;i<closeCount;i++){
      const side=i%2?-1:1;
      const x=side*(510+cityR()*500), z=-180-cityR()*1800;
      const w=24+cityR()*48, d=28+cityR()*48, h=45+cityR()*125;
      scv.set(w,h,d); m4.compose(new THREE.Vector3(x,h/2-.1,z),new THREE.Quaternion(),scv); close.setMatrixAt(i,m4);
    }
    close.castShadow=false; cityGroup.add(close);

    // Rooftop variety: antenna blocks and water tanks on selected towers.
    for(let i=0;i<(mobile?10:22);i++){
      const side=i%2?-1:1, x=side*(800+cityR()*1100), z=-400-cityR()*1800, h=110+cityR()*130;
      worldAdd(new THREE.BoxGeometry(8,8,8),terminalDark,x,h,z,{castShadow:false});
      worldAdd(new THREE.CylinderGeometry(3,3,8,12),terminalWhite,x+7,h+4,z,{castShadow:false});
    }
  }

  /* Streetlights and utility poles around the outer road. */
  for(let i=0;i<28;i++){
    const z=-1500+i*70;
    worldAdd(new THREE.CylinderGeometry(.18,.28,8,8),terminalDark,-555,4,z,{castShadow:false});
    const arm=worldAdd(new THREE.BoxGeometry(3,.18,.18),terminalDark,-553.5,7.8,z,{castShadow:false});
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffd38a,transparent:true,depthWrite:false,fog:false}));
    glow.scale.set(3.2,3.2,1); glow.position.set(-552,7.7,z); airport.add(glow); worldLights.push(glow);
  }

  /* ───────────── REALISM PASS: architecture, surfaces and vegetation ─────────────
     This pass changes only the surrounding world. The aircraft, sky, clouds,
     trajectory and camera remain untouched. */
  {
    const facadeWarm = worldMat('#b8b5ad', .78, .02);
    const facadeCool = worldMat('#7e8991', .70, .10);
    const facadeDark = worldMat('#36434d', .48, .22);
    const glassBlue = new THREE.MeshPhysicalMaterial({ color:C('#4b7182'), roughness:.16, metalness:.18, clearcoat:.7, clearcoatRoughness:.18 });
    const glassLit = new THREE.MeshStandardMaterial({ color:C('#91b6c2'), roughness:.25, metalness:.05, emissive:C('#182b32'), emissiveIntensity:.18 });
    const metalRoof = worldMat('#59636a', .43, .62);
    const concreteEdge = worldMat('#8d9498', .86, .02);
    const darkRubber = worldMat('#22282c', .9, .02);

    // Break the terminal into believable material zones instead of one white slab.
    for(let i=0;i<10;i++){
      const x=-455+i*25.5;
      worldAdd(new THREE.BoxGeometry(23.2,7.4,1.15), i%3===0?facadeCool:facadeWarm, x,13.2,-256.0);
      worldAdd(new THREE.BoxGeometry(.55,13.5,2.4), facadeDark, x-11.5,8.2,-257.4);
      worldAdd(new THREE.BoxGeometry(.55,13.5,2.4), facadeDark, x+11.5,8.2,-257.4);
    }
    // Glass entrance bays with vertical mullions and interior glow.
    for(let i=0;i<8;i++){
      const x=-438+i*28;
      worldAdd(new THREE.BoxGeometry(24,10,1.0), glassBlue, x,7.2,-273.0);
      for(let j=-1;j<=1;j++) worldAdd(new THREE.BoxGeometry(.18,10.4,.35), facadeDark, x+j*8,7.2,-273.65,{castShadow:false});
      worldAdd(new THREE.BoxGeometry(24,1.0,.8), metalRoof, x,12.3,-273.5);
    }
    // Roof plant: HVAC housings, ducts, vents and maintenance walkways.
    for(let i=0;i<18;i++){
      const x=-440+(i%9)*25, z=-145+Math.floor(i/9)*62;
      worldAdd(new THREE.BoxGeometry(8,3.2,5.5), metalRoof,x,23.2,z);
      worldAdd(new THREE.BoxGeometry(5.2,1.0,2.2), concreteEdge,x,25.0,z+3.5);
      worldAdd(new THREE.CylinderGeometry(.65,.65,2.5,10), metalRoof,x+2.2,25.3,z-2.0);
    }
    // Service doors and loading-bay rhythm.
    for(let i=0;i<12;i++){
      const x=-430+i*16;
      worldAdd(new THREE.BoxGeometry(7.2,5.2,.28), facadeDark,x,4.2,-257.9,{castShadow:false});
      worldAdd(new THREE.BoxGeometry(6.4,.25,.35), safetyOrange,x,6.75,-258.1,{castShadow:false});
    }

    // Hangar realism: panel ribs, door frames and side service buildings.
    [180,355,540].forEach((x,hi)=>{
      const z=210+hi*25, w=150+hi*12, h=72+hi*5;
      for(let j=-4;j<=4;j++) worldAdd(new THREE.BoxGeometry(1.25,h*.58,2.0), metalRoof,x+j*w/10,h*.30,z-53);
      for(let j=-3;j<=3;j++) worldAdd(new THREE.BoxGeometry(1.0,h*.42,2.4), facadeDark,x+j*w/9,h*.22,z-53);
      worldAdd(new THREE.BoxGeometry(w*.78,1.1,2.8), metalRoof,x,h*.46,z-54);
      worldAdd(new THREE.BoxGeometry(14,7,12), facadeCool,x+w*.57,3.5,z-25);
      worldAdd(new THREE.BoxGeometry(9,5,.3), glassLit,x+w*.57,6.0,z-31,{castShadow:false});
    });

    // Cargo buildings: roof parapets and repeated dock doors.
    for(let i=0;i<6;i++){
      const x=180+i*62, z=-120-i*12;
      worldAdd(new THREE.BoxGeometry(54,1.4,72), metalRoof,x,14.4,z);
      for(let j=-2;j<=2;j++){
        worldAdd(new THREE.BoxGeometry(6.5,6.5,.35), facadeDark,x+j*9,5.0,z-35.3,{castShadow:false});
        worldAdd(new THREE.BoxGeometry(5.2,.22,.4), safetyOrange,x+j*9,8.4,z-35.6,{castShadow:false});
      }
      worldAdd(new THREE.BoxGeometry(18,3,12), concreteEdge,x-15,16.0,z+12);
    }

    // Apron material breakup: darker tire lanes and concrete service pads.
    for(let i=0;i<9;i++){
      const z=-560+i*74;
      worldAdd(new THREE.BoxGeometry(205,.035,18), roadMat,-250,.19,z,{castShadow:false});
      for(let j=-1;j<=1;j++) worldAdd(new THREE.BoxGeometry(2.2,.045,15), darkRubber,-250+j*82,.205,z,{castShadow:false});
    }

    // More convincing roadside assets: guardrails and reflector posts.
    for(let z=-1420;z<430;z+=36){
      worldAdd(new THREE.CylinderGeometry(.12,.16,1.15,8), safetyOrange,-540,.58,z,{castShadow:false});
      if(z%72===0) worldAdd(new THREE.BoxGeometry(9,.16,.16), concreteEdge,-540,.9,z,{castShadow:false});
    }

    // City facade detail layer: setbacks, glass cores and rooftop mechanical boxes.
    const cityDetail=new THREE.Group(); scene.add(cityDetail);
    const cityPalette=[facadeWarm,facadeCool,facadeDark,worldMat('#6f6258',.82,.02),worldMat('#506978',.54,.16)];
    const cr=cityR;
    for(let i=0;i<(mobile?42:86);i++){
      const side=i%2?-1:1;
      const x=side*(520+cr()*1450), z=-300-cr()*2400;
      const w=30+cr()*62, d=28+cr()*58, h=55+Math.pow(cr(),.52)*210;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),cityPalette[i%cityPalette.length]);
      body.position.set(x,h/2-.3,z); body.castShadow=false; body.receiveShadow=true; cityDetail.add(body);
      // recessed glass core / facade strip
      if(i%3!==0){
        const core=new THREE.Mesh(new THREE.BoxGeometry(w*.24,.86*h,d*.92),glassBlue);
        core.position.set(x,h*.49,z); cityDetail.add(core);
      }
      // vertical facade fins
      for(let k=-1;k<=1;k++){
        const fin=new THREE.Mesh(new THREE.BoxGeometry(.55,h*.88,d*.94),facadeDark);
        fin.position.set(x+k*w*.28,h*.48,z); cityDetail.add(fin);
      }
      // rooftop mechanical box and parapet
      if(i%2===0){
        const roof=new THREE.Mesh(new THREE.BoxGeometry(w*.5,5,d*.45),metalRoof); roof.position.set(x,h+2.5,z); cityDetail.add(roof);
        const tank=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,4,12),concreteEdge); tank.position.set(x+w*.18,h+6,z); cityDetail.add(tank);
      }
      // low-rise podium creates a less toy-like skyline base
      if(i%4===0){
        const pod=new THREE.Mesh(new THREE.BoxGeometry(w*1.5,12,d*1.35),facadeWarm); pod.position.set(x,6,z); cityDetail.add(pod);
      }
    }

    // A few recognizable skyline landmarks with antennae.
    [
      [side=>side*1050,-1180,260,42],
      [side=>side*1320,-1760,330,34],
      [side=>side*820,-2260,220,55]
    ].forEach((v,i)=>{
      const side=i%2?-1:1, x=Math.abs(v[0](side)), z=v[1], h=v[2], w=v[3];
      const tower=new THREE.Mesh(new THREE.BoxGeometry(w,w*.75,h),cityPalette[4]); tower.position.set(x,h/2,z); cityDetail.add(tower);
      const crown=new THREE.Mesh(new THREE.BoxGeometry(w*.72,w*.62,8),glassLit); crown.position.set(x,h+4,z); cityDetail.add(crown);
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,28,10),metalRoof); mast.position.set(x,h+22,z); cityDetail.add(mast);
    });
  }

  /* Animate only the newly-added world vehicles/lights. */
  function updateWorld(t){
    for(let i=0;i<worldVehicles.length;i++){
      const v=worldVehicles[i], u=(t*.055+i*.17)%1;
      if(v.route===0){
        v.g.position.x=v.baseX+Math.sin(t*.25+i)*18;
        v.g.position.z=v.baseZ+u*310-155;
        v.g.rotation.y=Math.PI/2;
      }else{
        v.g.position.x=v.baseX+u*150-75;
        v.g.position.z=v.baseZ+Math.sin(t*.2+i)*16;
        v.g.rotation.y=0;
      }
    }
    const pulse=.72+.28*(.5+.5*Math.sin(t*4.5));
    for(let i=0;i<worldLights.length;i++) worldLights[i].material.opacity=.72*pulse;
  }

  // Organic airport landscaping: layered broadleaf canopies replace the old cone trees.
  {
    const n = mobile ? 150 : 420, r = rng(21);
    const trunkGeo = new THREE.CylinderGeometry(.18,.28,3.2,7);
    const canopyGeo = new THREE.SphereGeometry(1,8,6);
    const trunkMat = worldMat('#5a4636',.92,0);
    const canopyMats = [worldMat('#38563a',.96,0),worldMat('#486a43',1,0),worldMat('#5d7548',1,0)];
    const trunks=[];
    const canopies=canopyMats.map(mat=>new THREE.InstancedMesh(canopyGeo,mat,Math.ceil(n/3)));
    canopies.forEach(im=>{im.castShadow=true;im.receiveShadow=true;scene.add(im);});
    const tm=new THREE.Matrix4(), cm=new THREE.Matrix4(), q=new THREE.Quaternion(), sc=new THREE.Vector3();
    const p=new THREE.Vector3(); let ti=0, ci=[0,0,0];
    for(let i=0;i<n;i++){
      let x=(r()<.5?-1:1)*(115+Math.pow(r(),1.55)*980), z=360-r()*5100;
      if(x>-520&&x<-100&&z>-420&&z<480) x=180+r()*340;
      const h=2.4+r()*3.6, crown=3.2+r()*4.5, lean=(r()-.5)*.22;
      p.set(x,0,z); tm.compose(p,q.setFromEuler(new THREE.Euler(0,r()*Math.PI*2,lean)),new THREE.Vector3(1,h/3,1));
      // Use individual trunk meshes sparingly; only mature trees get a visible trunk.
      if(i%3===0){const t=new THREE.Mesh(trunkGeo,trunkMat);t.position.set(x,h/2,z);t.scale.setScalar(.75+r()*.7);t.castShadow=true;scene.add(t);trunks.push(t);}
      const parts=2+(i%3), idx=i%3;
      for(let j=0;j<parts;j++){
        const a=r()*Math.PI*2, rad=crown*(.55+r()*.45), y=h+(j%2)*1.25+r()*1.5;
        const ox=Math.cos(a)*crown*.34, oz=Math.sin(a)*crown*.34;
        sc.set(rad*(.8+r()*.35),rad*(.65+r()*.35),rad*(.8+r()*.35));
        cm.compose(new THREE.Vector3(x+ox,y,z+oz),q.setFromEuler(new THREE.Euler((r()-.5)*.15,r()*Math.PI*2,(r()-.5)*.15)),sc);
        if(ci[idx]<canopies[idx].count) canopies[idx].setMatrixAt(ci[idx]++,cm);
      }
    }
    canopies.forEach((im,i)=>{im.instanceMatrix.needsUpdate=true;});
  }
  // layered distant ridges
  const ridges = new THREE.Group(); scene.add(ridges);
  [[-6200, '#9e8f94', 380, 1], [-7300, '#b3a09c', 300, 2], [-8600, '#c7ae9d', 220, 3]].forEach(([z, colr, hgt, sd]) => {
    const r = rng(sd * 31), pts = [], N = 90; pts.push(new THREE.Vector2(-9000, -400));
    for (let i = 0; i <= N; i++) { const x = -9000 + 18000 * i / N; pts.push(new THREE.Vector2(x, (Math.sin(i * .21 + sd) * .4 + Math.sin(i * .57 + sd * 2) * .3 + r() * .35 + .35) * hgt)); }
    pts.push(new THREE.Vector2(9000, -400));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), new THREE.MeshBasicMaterial({ color: C(colr), fog: false }));
    mesh.position.z = z; ridges.add(mesh);
  });

  /* ───────────── Clouds ───────────── */
  const cloudTexs = [1, 2, 3, 4].map(seed => canvasTex(256, 256, (ctx, w, h) => {
    const r = rng(seed * 97);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), .7) * w * .3, cx = w / 2 + Math.cos(a) * d * 1.35, cy = h * .56 + Math.sin(a) * d * .55, rad = w * (.11 + r() * .13);
      const k = Math.min(1, Math.max(0, (cy - h * .28) / (h * .5)));
      const R = lerp(255, 168, k) | 0, G = lerp(240, 172, k) | 0, B = lerp(222, 196, k) | 0;
      const g = ctx.createRadialGradient(cx, cy - rad * .25, rad * .08, cx, cy, rad);
      g.addColorStop(0, `rgba(${R},${G},${B},.92)`); g.addColorStop(.6, `rgba(${R},${G},${B},.42)`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
    }
  }));
  const clouds = []; const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
  const crng = rng(1234);
  const NC = mobile ? 95 : 175;
  const CWIN_AHEAD = 3600, CWIN_BEHIND = 700;
  function placeCloud(c, z) {
    const rx = crng() - .5, corridor = crng() < .35;
    c.sprite.position.set(corridor ? rx * 520 : rx * 3400, 250 + crng() * 190 + (crng() < .2 ? crng() * 160 : 0), z);
    const w = 260 + crng() * 520; c.w = w; c.sprite.scale.set(w, w * (.5 + crng() * .25), 1);
    c.base = .55 + crng() * .4; c.sprite.material.rotation = (crng() - .5) * .08;
  }
  for (let i = 0; i < NC; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexs[i % 4], transparent: true, depthWrite: false, fog: true, color: new THREE.Color(1, .94 + crng() * .06, .88 + crng() * .1) });
    const c = { sprite: new THREE.Sprite(mat), w: 300, base: 1 }; placeCloud(c, -CWIN_AHEAD + crng() * (CWIN_AHEAD + CWIN_BEHIND));
    cloudGroup.add(c.sprite); clouds.push(c);
  }
  // low horizon haze banks
  const hazeBanks = new THREE.Group(); scene.add(hazeBanks);
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexs[i % 4], transparent: true, depthWrite: false, fog: false, opacity: .3, color: new THREE.Color(1, .82, .66) });
    const s = new THREE.Sprite(mat); s.position.set((i - 7) * 420 + crng() * 200, 90 + crng() * 90, -3300 - crng() * 600); s.scale.set(1100 + crng() * 800, 260 + crng() * 100, 1); hazeBanks.add(s);
  }
  // god rays
  const shafts = new THREE.Group(); scene.add(shafts);
  const shaftTex = canvasTex(64, 256, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,220,160,0)'); g.addColorStop(.3, 'rgba(255,220,160,.9)'); g.addColorStop(1, 'rgba(255,220,160,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); const g2 = ctx.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h); });
  const shaftMats = [];
  {
    const down = sunDir.clone().negate(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), down);
    const n = mobile ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }); shaftMats.push(mat);
      const px = (crng() - .5) * 900, pz = -300 - crng() * 800, w = 40 + crng() * 90;
      for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 900), mat); m.quaternion.copy(q); m.rotateY(k * Math.PI / 2); m.position.set(px, 330, pz); shafts.add(m); }
    }
  }

  /* ───────────── Aircraft ───────────── */
  const WHITE = C('#f8fafc'), NAVY = C('#005b9a'), GOLD = C('#005b9a'), SILVER = C('#dfe6ed');
  const R = 2.9, NOSE_L = 8, TAIL_D = 44, GROUND_Y = 4.4;
  function profileR(yl) {
    const d = 29 - yl; if (d <= 0) return 0.001;
    if (d < NOSE_L) { const u = (NOSE_L - d) / NOSE_L; return R * Math.sqrt(Math.max(1 - u * u, 0)); }
    if (d < TAIL_D) return R;
    const u = (d - TAIL_D) / 13; return u >= 1 ? 0.12 : R * (1 - 0.96 * Math.pow(u, 1.6));
  }
  function buildFuselage() {
    const ys = [];
    for (let y = -28; y < -15; y += 0.4) ys.push(y);
    for (let y = -15; y < 21; y += 1.5) ys.push(y);
    for (let i = 0; i <= 26; i++) ys.push(29 - NOSE_L * (1 - Math.sin(i / 26 * Math.PI / 2)));
    ys.sort((a, b) => a - b);
    const pts = ys.filter((y, i) => i === 0 || y - ys[i - 1] > 1e-4).map(y => new THREE.Vector2(profileR(y), y));
    const g = new THREE.LatheGeometry(pts, 112); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // Boeing-inspired commercial livery: bright white fuselage with a clearly visible blue lower band.
      c.copy(WHITE);
      c.lerp(SILVER, sm(-1.0, -2.5, y) * .45);

      // Broad blue belly / cheat-line instead of a mostly dark aircraft.
      const blueBelly = sm(-2.55, -1.15, y) * (1 - sm(-1.15, 0.15, y));
      c.lerp(NAVY, blueBelly * 0.95);

      // Blue rear fuselage section leading into the tail.
      c.lerp(NAVY, sm(17.0, 21.5, z) * 0.92);

      // Thin blue accent stripe along the upper-middle fuselage.
      const stripeCenter = 0.55;
      const stripe = (1 - sm(0.055, 0.14, Math.abs(y - stripeCenter))) * sm(-18.0, -15.5, z);
      c.lerp(NAVY, stripe * 0.82);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      if (z > 12) pos.setY(i, y + Math.pow((z - 12) / 16, 2) * 1.8);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  function paneGeo(y0, y1, p0, p1) {
    const pts = []; for (let i = 0; i <= 8; i++) { const y = lerp(y0, y1, i / 8); pts.push(new THREE.Vector2(profileR(y) + 0.015, y)); }
    const g = new THREE.LatheGeometry(pts, 8, p0, p1 - p0); g.rotateX(-Math.PI / 2); return g;
  }
  const airfoil = (x) => 5 * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);

  function Wing(o) {
    const K = 14, N = o.N || 18, rc = 2 * K, sx = o.side, nV = (N + 1) * rc;
    const pos = new Float32Array((nV + rc + 1) * 3), col = new Float32Array((nV + rc + 1) * 3), idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < rc; j++) {
      const a = i * rc + j, b = i * rc + (j + 1) % rc, c = (i + 1) * rc + j, d = (i + 1) * rc + (j + 1) % rc;
      if (sx > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    for (let j = 0; j < rc; j++) { const a = nV + j, b = nV + (j + 1) % rc, cn = nV + rc; if (sx > 0) idx.push(cn, a, b); else idx.push(cn, b, a); }
    const cu = o.upper || WHITE, cl = o.lower || SILVER;
    for (let i = 0; i < nV + rc + 1; i++) { const j = i < nV ? i % rc : 0, c = (i < nV && j > K) ? cl : cu; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const tanS = Math.tan(o.sweep), tanD = Math.tan(o.dih);
    const api = {
      geo: g,
      chord: f => o.c0 + (o.c1 - o.c0) * f,
      zle: f => o.zLE0 + o.S * f * tanS,
      yc: (f, flex) => o.y0 + o.S * f * tanD + flex * f * f + (o.rake ? o.rake * Math.pow(Math.max(0, (f - .9) / .1), 2.2) : 0),
      update(flex) {
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i <= N; i++) {
          const f = i / N, x = sx * (o.x0 + o.S * f), ch = api.chord(f), zl = api.zle(f), y = api.yc(f, flex), th = o.th0 + (o.th1 - o.th0) * f;
          for (let j = 0; j < rc; j++) {
            const up = j <= K, k = up ? j : 2 * K - j, xc = (1 - Math.cos(Math.PI * k / K)) / 2;
            const t = th * ch * airfoil(xc), cam = 0.03 * ch * 4 * xc * (1 - xc);
            const px = x, py = y + (up ? t : -t) + cam, pz = zl + xc * ch, vi = i * rc + j;
            pos[vi * 3] = px; pos[vi * 3 + 1] = py; pos[vi * 3 + 2] = pz;
            if (i === N) { const ci = nV + j; pos[ci * 3] = px; pos[ci * 3 + 1] = py; pos[ci * 3 + 2] = pz; cx += px; cy += py; cz += pz; }
          }
        }
        const cn = nV + rc; pos[cn * 3] = cx / rc; pos[cn * 3 + 1] = cy / rc; pos[cn * 3 + 2] = cz / rc;
        g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
      }
    };
    api.update(0); return api;
  }

  const paint = (hex, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color: C(hex), roughness: .32, metalness: .15, clearcoat: .8, clearcoatRoughness: .25, envMapIntensity: 1.0 }, extra || {}));
  const bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .38, metalness: .04, clearcoat: .65, clearcoatRoughness: .22, envMapIntensity: 0.8 });
  const wingMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .36, metalness: .2, clearcoat: .7, clearcoatRoughness: .3, side: THREE.DoubleSide, envMapIntensity: 1.0 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x070d16, roughness: .05, metalness: .9, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: .35, metalness: .9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: .75, metalness: .2, side: THREE.DoubleSide });
  const tireMat = new THREE.MeshStandardMaterial({ color:  0x080808, roughness: .95 });

  const finLogo = canvasTex(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#ffffff'; ctx.font = '800 150px Sora, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '14px';
    ctx.fillText('BOEING', w / 2, h / 2 + 6);
  });

  function buildAircraft() {
    const A = { fans: [], wheels: [], flaps: [], wings: [], lights: [] };
    const model = new THREE.Group(); A.model = model;
    const add = (m, parent) => { m.castShadow = true; m.receiveShadow = true; (parent || model).add(m); return m; };

    add(new THREE.Mesh(buildFuselage(), bodyMat));

    // ALTITUDE airline wordmark — Boeing-inspired blue/white livery
    const fuselageLogo = canvasTex(900, 180, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#005b9a';
      ctx.font = '800 118px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ALTITUDE', w / 2, h / 2 + 4);
    });
    [-1, 1].forEach(s => {
      const logo = new THREE.Mesh(
        new THREE.PlaneGeometry(8.2, 1.55),
        new THREE.MeshBasicMaterial({ map: fuselageLogo, transparent: true, toneMapped: false, depthWrite: false })
      );
      logo.position.set(s * 2.91, 0.15, 1.5);
      logo.rotation.y = s * Math.PI / 2;
      model.add(logo);
    });
    [[.1, .34], [.38, .62], [.66, .93]].forEach(r => { add(new THREE.Mesh(paneGeo(23.2, 26.4, r[0], r[1]), glassMat)); add(new THREE.Mesh(paneGeo(23.2, 26.4, -r[1], -r[0]), glassMat)); });
    // wing-body fairing
    const fair = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshPhysicalMaterial({ color: C('#dfe4ea'), roughness: .35, clearcoat: .8 }));
    fair.scale.set(6.6, 1.15, 7.4); fair.position.set(0, -1.75, 0.6); add(fair);

    // windows + doors
    {
      const n = 46, wm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.4, 0.27), new THREE.MeshStandardMaterial({ color: 0x0b121b, roughness: .1, metalness: .7, emissive: 0x4a3418, emissiveIntensity: .35 }), n * 2);
      const o = new THREE.Object3D(), up = new THREE.Vector3(1, 0, 0); let k = 0; const wy = 0.55, wx = Math.sqrt(R * R - wy * wy);
      for (let s = -1; s <= 1; s += 2) for (let i = 0; i < n; i++) {
        const z = -19.4 + i * 0.76; if (Math.abs(z - -8) < .7 || Math.abs(z - -18.2) < .8 || Math.abs(z - 6) < .7 || Math.abs(z - 13) < .7) { o.scale.set(0, 0, 0); } else o.scale.set(1, 1, 1);
        o.position.set(s * wx, wy, z); o.quaternion.setFromUnitVectors(up, new THREE.Vector3(s * wx, wy, 0).normalize()); o.updateMatrix(); wm.setMatrixAt(k++, o.matrix);
      }
      model.add(wm);
      const dm = new THREE.MeshStandardMaterial({ color: C('#dde3ea'), roughness: .4, metalness: .2, polygonOffset: true, polygonOffsetFactor: -1 });
      [-18.2, -8, 6, 13].forEach((z, i) => [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, i % 3 === 0 ? 0.95 : 1.4), dm); d.position.set(s * (R - 0.01), -0.15, z); model.add(d); }));
    }

    // wings, stabilisers
    const wp = { x0: 2.0, S: 28, c0: 12, c1: 1.9, zLE0: -6, sweep: 32 * Math.PI / 180, dih: 5 * Math.PI / 180, y0: -1.1, th0: .12, th1: .085, rake: 2.5, N: 20 };
    [-1, 1].forEach(s => { const w = Wing(Object.assign({ side: s }, wp)); w.side = s; add(new THREE.Mesh(w.geo, wingMat)).frustumCulled = false; A.wings.push(w); });
    A.wp = wp;
    const sp = { x0: .4, S: 9.6, c0: 5.8, c1: 1.7, zLE0: 18.8, sweep: 34 * Math.PI / 180, dih: 4 * Math.PI / 180, y0: 1.15, th0: .09, th1: .07, N: 8 };
    [-1, 1].forEach(s => { const w = Wing(Object.assign({ side: s }, sp)); add(new THREE.Mesh(w.geo, wingMat)).frustumCulled = false; });

    // flaps (stowed inside wing, deployed for takeoff)
    const teK = ((wp.zLE0 + wp.S * Math.tan(wp.sweep) + wp.c1) - (wp.zLE0 + wp.c0)) / wp.S;
    [[.06, .27, .8], [.31, .6, .8], [.64, .9, .82]].forEach(([f0, f1, hinge]) => [-1, 1].forEach((s, wi) => {
      const fm = (f0 + f1) / 2, ch = wp.c0 + (wp.c1 - wp.c0) * fm, depth = (1 - hinge) * ch + 0.3, len = wp.S * (f1 - f0) / Math.cos(Math.atan(teK)) - 0.2;
      const hg = new THREE.Group(), df = new THREE.Group(); hg.add(df);
      const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, depth), paint('#e6ebf0', { clearcoat: .3 })); box.position.z = depth / 2 - 0.2; box.castShadow = true; df.add(box);
      hg.rotation.y = -s * Math.atan(teK); model.add(hg);
      A.flaps.push({ hg, df, fm, hinge, s, wi });
      // track fairing
      const tf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), paint('#e9eef3', { clearcoat: .3 })); tf.scale.set(.22, .22, 1.8); tf.userData = { fm, s, hinge }; model.add(tf); A.flaps.push({ fair: tf, fm, s });
    }));

    // vertical fin
    {
      const sh = new THREE.Shape(); sh.moveTo(15.2, 0); sh.lineTo(27.4, 0); sh.lineTo(28.6, 11.6); sh.lineTo(23.7, 11.6); sh.lineTo(15.2, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.44, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 2 }); g.translate(0, 0, -0.22);
      const fin = new THREE.Mesh(g, paint('#003b70', { clearcoat: 1, roughness: .24 })); fin.rotation.y = -Math.PI / 2; fin.position.y = 0.9; add(fin);
      [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.65), new THREE.MeshBasicMaterial({ map: finLogo, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false })); d.position.set(s * 0.33, 5.5, 22.6); d.rotation.y = s * Math.PI / 2; d.rotation.z = 0; model.add(d); });
    }

    // engines
    A.exhaust = [];
    [-1, 1].forEach(s => {
      const eg = new THREE.Group(), fe = (10.5 - wp.x0) / wp.S;
      eg.position.set(s * 10.5, -2.15, -0.9); model.add(eg); A.eng = A.eng || []; A.eng.push(eg);
      const outer = [[.95, -3.3], [1.1, -2.7], [1.3, -1.7], [1.45, -.6], [1.52, .6], [1.5, 1.8], [1.43, 2.7], [1.36, 3.02], [1.31, 3.06]].map(p => new THREE.Vector2(p[0], p[1]));
      let g = new THREE.LatheGeometry(outer, 56); g.rotateX(-Math.PI / 2); add(new THREE.Mesh(g, paint('#f4f7fa', { side: THREE.DoubleSide })), eg);
      const inner = [[1.31, 3.06], [1.24, 2.9], [1.2, 2.4], [1.17, 1.2], [1.05, -.5], [.9, -2.8]].map(p => new THREE.Vector2(p[0], p[1]));
      g = new THREE.LatheGeometry(inner, 48); g.rotateX(-Math.PI / 2); add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: .5, metalness: .6, side: THREE.DoubleSide })), eg);
      const gl = new THREE.TorusGeometry(1.34, .035, 8, 56); const ring = new THREE.Mesh(gl, new THREE.MeshStandardMaterial({ color: C('#005b9a'), metalness: .35, roughness: .28 })); ring.position.z = -3.05; eg.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.18, 32), new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: .8, side: THREE.DoubleSide })); disc.position.z = -1.2; eg.add(disc);
      const fan = new THREE.Group(); fan.position.z = -1.45; eg.add(fan);
      const bg = new THREE.BoxGeometry(.05, .9, .17);
      for (let i = 0; i < 22; i++) { const bh = new THREE.Group(); bh.rotation.z = i / 22 * Math.PI * 2; const b = new THREE.Mesh(bg, metalMat); b.position.y = .72; b.rotation.y = .6; bh.add(b); fan.add(bh); }
      const spin = new THREE.Mesh(new THREE.ConeGeometry(.3, .85, 24), metalMat); spin.geometry.rotateX(-Math.PI / 2); spin.position.z = -.4; fan.add(spin);
      A.fans.push(fan);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.56, 2.6, 24), new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: .4, metalness: .85 })); cone.geometry.rotateX(Math.PI / 2); cone.position.z = 3.3; eg.add(cone);
      const py = add(new THREE.Mesh(new THREE.BoxGeometry(.5, 1.5, 5.6), paint('#f0f3f6')), eg); py.position.set(0, 1.2, .95);
      A.exhaust.push(eg);
    });

    // landing gear
    function wheel(r, w) {
      const g = new THREE.Group(), t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), tireMat); t.geometry.rotateZ(Math.PI / 2); t.castShadow = true; g.add(t);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(r * .55, r * .55, w + .02, 20), metalMat); h.geometry.rotateZ(Math.PI / 2); g.add(h); A.wheels.push(g); return g;
    }
    function strut(len, rad) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * .8, len, 12), metalMat); m.position.y = -len / 2; m.castShadow = true; return m; }
    const nose = new THREE.Group(); nose.position.set(0, -2.4, -21);
    nose.add(strut(1.6, .13)); [-1, 1].forEach(s => { const w = wheel(.45, .26); w.position.set(s * .3, -1.95, 0); nose.add(w); }); model.add(nose); A.nose = nose;
    A.main = [-1, 1].map(s => {
      const m = new THREE.Group(); m.position.set(s * 5.4, -1.5, 1.6); m.add(strut(2.2, .17));
      const bog = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, 2.4), metalMat); bog.position.y = -2.25; m.add(bog);
      [-1, 0, 1].forEach(a => [-1, 1].forEach(b => { const w = wheel(.58, .4); w.position.set(b * .34, -2.25 - 0.0, a * 1.05); m.add(w); }));
      const br = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 8), metalMat); br.position.set(-s * .55, -1.1, .2); br.rotation.z = s * .4; m.add(br);
      model.add(m); return m;
    });

    // lights
    const mkLight = (c, x, y, z, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); s.scale.set(size, size, 1); s.position.set(x, y, z); model.add(s); return s; };
    A.navL = mkLight(0xff2a2a, -29.8, 4, 12.3, 1.8); A.navR = mkLight(0x2aff66, 29.8, 4, 12.3, 1.8);
    A.strobeL = mkLight(0xffffff, -29.8, 4, 13.2, 4); A.strobeR = mkLight(0xffffff, 29.8, 4, 13.2, 4);
    A.tail = mkLight(0xffffff, 0, 12.5, 28.5, 1.6); A.beacon = mkLight(0xff2020, 0, 3, 2, 2.4);
    A.spots = [-1, 1].map(s => {
      const sp = new THREE.SpotLight(0xfff0d8, 0, 600, .32, .7, 1.2); sp.position.set(s * 3.6, -1.9, -4.5); sp.target.position.set(s * 2, -3.5, -200); model.add(sp, sp.target);
      A.lights.push(mkLight(0xfff0d8, s * 3.6, -1.9, -5, 3)); return sp;
    });
    return A;
  }

  const plane = buildAircraft();
  const pivot = new THREE.Group(); pivot.add(plane.model); plane.model.position.set(0, GROUND_Y, -1.6); scene.add(pivot);
  // parked fleet (shares geometry with hero aircraft)
  [[-168, -40, -.95], [-168, -145, -.6]].forEach(([x, z, ry]) => {
    const c = plane.model.clone(true); const p = new THREE.Group(); p.add(c); c.position.set(0, GROUND_Y, 0); p.position.set(x, 0, z); p.rotation.y = ry; scene.add(p);
  });

  // exhaust particles
  const EXN = 70, exhaust = makeGlow(EXN * 2); scene.add(exhaust);
  const ex = { age: new Float32Array(EXN * 2).fill(9), vel: new Float32Array(EXN * 2 * 3), head: 0 };

  function updateFlaps(flex, defl) {
    const wp = plane.wp, w = plane.wings;
    plane.flaps.forEach(f => {
      const wing = w[f.s > 0 ? 1 : 0], fm = f.fm;
      if (f.fair) {
        f.fair.position.set(f.s * (wp.x0 + wp.S * fm), wing.yc(fm, flex) - .85, wing.zle(fm) + wing.chord(fm) * .78);
        return;
      }
      f.hg.position.set(f.s * (wp.x0 + wp.S * fm), wing.yc(fm, flex), wing.zle(fm) + wing.chord(fm) * f.hinge);
      f.df.rotation.x = defl * (f.fm > .6 ? .6 : 1);
    });
  }

  /* ───────────── Trajectory (closed-form, table sampled) ───────────── */
  const T_ROLL = 5, T_ROT = 16, T_LIFT = 17.2, TAB_N = 420 * 30;
  const traj = { z: new Float32Array(TAB_N), alt: new Float32Array(TAB_N), v: new Float32Array(TAB_N), pitch: new Float32Array(TAB_N) };
  (function () {
    let z = 0, alt = 0; const dt = 1 / 30;
    for (let i = 0; i < TAB_N; i++) {
      const T = i * dt;
      const v = T < T_ROLL ? 0 : T < T_ROT ? 7.5 * (T - T_ROLL) : Math.min(140, 82.5 + 2.2 * (T - T_ROT));
      const vy = T < T_LIFT ? 0 : 34 * sm(T_LIFT, 27, T) * (1 - .94 * sm(40, 90, T));
      z -= v * dt; alt += vy * dt;
      const rotP = 12 * Math.PI / 180 * sm(T_ROT, 18, T), path = Math.atan2(vy, Math.max(v, 1)) + 3.5 * Math.PI / 180;
      const w = sm(19, 28, T);
      traj.z[i] = z; traj.alt[i] = alt; traj.v[i] = v; traj.pitch[i] = rotP * (1 - w) + Math.max(path, 0) * w;
    }
  })();
  function sampleTraj(T) {
    const f = Math.min(Math.max(T, 0) * 30, TAB_N - 2), i = Math.floor(f), t = f - i;
    return { z: lerp(traj.z[i], traj.z[i + 1], t), alt: lerp(traj.alt[i], traj.alt[i + 1], t), v: lerp(traj.v[i], traj.v[i + 1], t), pitch: lerp(traj.pitch[i], traj.pitch[i + 1], t) };
  }

  /* ───────────── Camera director ───────────── */
  const KEYS = [
    { t: 0,    p: [6, 2.4, 430],  l: [0, 4, -70],   f: 48, ky: 0 },
    { t: 5,    p: [11, 2.0, 215], l: [0, 4.5, -20], f: 44, ky: 0 },
    { t: 8,    p: [34, 1.6, 40],  l: [0, 4, -12],   f: 40, ky: 0 },
    { t: 10.5, p: [26, 1.3, -78], l: [0, 3.5, 0],   f: 46, ky: 0 },
    { t: 13.5, p: [21, 1.1, -64], l: [0, 3.2, 2],   f: 54, ky: 0 },
    { t: 16,   p: [38, 2.2, -42], l: [0, 4.5, 4],   f: 50, ky: 0 },
    { t: 18.5, p: [74, 4.0, -6],  l: [0, 6, -2],    f: 38, ky: .15 },
    { t: 21.5, p: [82, 9, 28],    l: [0, 5, -3],    f: 36, ky: .7 },
    { t: 24,   p: [78, 16, 56],   l: [0, 3, -6],    f: 40, ky: 1 },
    { t: 28,   p: [40, 20, -86],  l: [0, 3, -2],    f: 42, ky: 1 },
    { t: 32,   p: [-70, 12, -72], l: [0, 3, -2],    f: 44, ky: 1 },
    { t: 36,   p: [-95, 22, 16],  l: [0, 4, -2],    f: 40, ky: 1 },
    { t: 40,   p: [-60, 26, 118], l: [-6, 4, -20],  f: 38, ky: 1 },
    { t: 46,   p: [-58, 16, 190], l: [-22, 6, -45], f: 40, ky: 1 }
  ];
  function crv(field, i, comp, t) {
    const n = KEYS.length, v = k => { k = Math.max(0, Math.min(n - 1, k)); const x = KEYS[k][field]; return comp === undefined ? x : x[comp]; };
    const k0 = KEYS[i], k1 = KEYS[i + 1], dt = k1.t - k0.t, u = (t - k0.t) / dt;
    const tan = (k) => { const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1); return b === a ? 0 : (v(b) - v(a)) / (KEYS[b].t - KEYS[a].t); };
    const m0 = tan(i) * dt, m1 = tan(i + 1) * dt, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v(i) + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v(i + 1) + (u3 - u2) * m1;
  }
  function sampleKeys(t) {
    t = Math.min(Math.max(t, 0), KEYS[KEYS.length - 1].t - 1e-3);
    let i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
    return { p: [crv('p', i, 0, t), crv('p', i, 1, t), crv('p', i, 2, t)], l: [crv('l', i, 0, t), crv('l', i, 1, t), crv('l', i, 2, t)], f: crv('f', i, undefined, t), ky: Math.min(1, Math.max(0, crv('ky', i, undefined, t))) };
  }
  const MODES = {
    hero: { p: [-58, 16, 190], l: [-22, 6, -45], f: 40 },
    dash: { p: [-120, 36, 340], l: [-60, 12, -80], f: 36 },
    quiz: { p: [105, 14, 250], l: [38, 5, -70], f: 38 }
  };
  const mw = { hero: 1, dash: 0, quiz: 0 }; let modeTarget = 'hero';
  API.setMode = m => { modeTarget = MODES[m] ? m : 'hero'; };

  /* ───────────── Main loop ───────────── */
  let T = 0, running = false, started = false, lastNow = 0, introCb = null, frames = 0, fpsAcc = 0, qualityChecks = 0, telemT = 0;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), Cc = new THREE.Vector3(), tmp = new THREE.Vector3();
  let idleClock = 0, shake = 0;
  API.onIntroEnd = f => { introCb = f; };
  API.start = () => { T = 0; running = true; started = true; API.introDone = false; };
  API.skip = () => { T = Math.max(T, reduced ? SKIP_T : SKIP_T); if (!API.introDone) finishIntro(); };
  function finishIntro() { API.introDone = true; if (introCb) introCb(); }
  if (reduced) { T = SKIP_T; running = true; started = true; API.introDone = true; }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastNow = now; return; }
    const dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016); lastNow = now;
    if (running) T += dt;
    if (T > 400) T -= 340;
    idleClock += dt;
    if (T >= INTRO && !API.introDone && !reduced) finishIntro();
    API.T = T;
    const s = sampleTraj(T), aspect = camera.aspect, portrait = aspect < .95;

    // aircraft state
    const tf = T;
    const onGround = s.alt < 0.2 && tf < T_LIFT;
    const gust = Math.sin(tf * 1.7) * .12 + Math.sin(tf * .63) * .18;
    const flex = -0.5 + 2.2 * sm(T_LIFT, 20.5, tf) + (tf > T_LIFT ? gust : 0);
    plane.wings.forEach(w => w.update(flex));
    updateFlaps(flex, (1 - sm(21, 26, tf)) * (tf > 4 ? 0.3 : 0.0) + (tf > 4 && tf < 21 ? 0 : 0));
    const retract = sm(19.6, 22.2, tf);
    plane.nose.rotation.x = retract * Math.PI / 2;
    plane.main[0].rotation.z = retract * Math.PI / 2 * 1; plane.main[1].rotation.z = -retract * Math.PI / 2;
    const spinRate = onGround ? s.v / .5 : Math.max(0, 20 * (1 - sm(T_LIFT, T_LIFT + 3, tf)));
    plane.wheels.forEach(w => { w.rotation.x -= spinRate * dt; });
    const throttle = tf < 3 ? .12 : tf < T_ROLL ? .12 + .6 * sm(3, T_ROLL, tf) : tf < 34 ? 1 : 1 - .3 * sm(34, 48, tf);
    plane.fans.forEach((f, i) => { f.rotation.z += dt * (10 + throttle * 50) * (i ? 1 : -1); });
    const roll = tf > 30 ? Math.sin(tf * .2) * .05 : 0;
    pivot.position.set(0, s.alt, s.z); pivot.rotation.set(s.pitch, Math.sin(tf * .13) * .01, roll);
    const f1 = Math.floor(tf * 1.3 % 1 * 10) , blink = f1 === 0 || f1 === 2;
    plane.strobeL.material.opacity = plane.strobeR.material.opacity = blink ? 1 : 0;
    plane.beacon.material.opacity = (Math.floor(tf * 1.2) % 2) ? 1 : .1;
    const tipY = plane.wings[0].yc(1, flex) + 1.6;
    plane.navL.position.y = plane.navR.position.y = plane.strobeL.position.y = plane.strobeR.position.y = tipY;
    plane.model.updateMatrixWorld(true);
    plane.model.getWorldPosition(Cc);
    const spotI = (tf > 3 ? 1 : 0) * (1 - sm(22, 28, tf)) * 5;
    plane.spots.forEach(sp => sp.intensity = spotI); plane.lights.forEach(l => l.material.opacity = Math.min(1, spotI / 4) * .8);

    // exhaust
    {
      const a = exhaust.geometry.attributes, rate = throttle * 60;
      const em = Math.floor(rate * dt + Math.random()), vBack = Math.max(8, 30 - s.v * .2);
      for (let k = 0; k < em; k++) for (let e = 0; e < 2; e++) {
        const i = ex.head++ % (EXN * 2); plane.exhaust[e].localToWorld(tmp.set(0, 0, 4.6));
        a.position.setXYZ(i, tmp.x + (Math.random() - .5) * .5, tmp.y + (Math.random() - .5) * .5, tmp.z); ex.age[i] = 0;
        ex.vel[i * 3] = (Math.random() - .5) * 2; ex.vel[i * 3 + 1] = (Math.random() - .3) * 2; ex.vel[i * 3 + 2] = vBack + Math.random() * 8 - s.v * .5;
      }
      for (let i = 0; i < EXN * 2; i++) {
        ex.age[i] += dt; const life = ex.age[i] / .9;
        if (life >= 1) { a.aAlpha.setX(i, 0); continue; }
        a.position.setXYZ(i, a.position.getX(i) + ex.vel[i * 3] * dt, a.position.getY(i) + ex.vel[i * 3 + 1] * dt, a.position.getZ(i) + ex.vel[i * 3 + 2] * dt);
        a.aSize.setX(i, 1.0 + life * 5); a.aAlpha.setX(i, (1 - life) * .22 * throttle); a.aColor.setXYZ(i, 1, .78 - life * .3, .55);
      }
      a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aColor.needsUpdate = true;
    }

    // world follows aircraft
    ground.position.set(Cc.x, 0, Cc.z);
    grassTex.offset.set(Cc.x / GS * GREP, -Cc.z / GS * GREP);
    ridges.position.set(Cc.x, 0, Cc.z); hazeBanks.position.set(Cc.x * .9, 0, Cc.z * .92);
    shafts.position.set(Cc.x, 0, Cc.z);
    const shaftA = (sm(21, 27, tf) * (1 - sm(36, 46, tf)) * .16 + .035 * sm(40, 50, tf));
    shaftMats.forEach(m => m.opacity = shaftA);
    sun.position.set(Cc.x + sunDir.x * 400, Cc.y + sunDir.y * 400, Cc.z + sunDir.z * 400); sun.target.position.copy(Cc); sun.target.updateMatrixWorld();

    // camera
    const km = sampleKeys(T);
    const idleK = sm(44, 48, T);
    // idle target from modes
    for (const k in mw) mw[k] += ((k === modeTarget ? 1 : 0) - mw[k]) * (1 - Math.exp(-dt * 1.6));
    const idle = { p: [0, 0, 0], l: [0, 0, 0], f: 0 };
    for (const k in MODES) { const w = mw[k]; for (let c = 0; c < 3; c++) { idle.p[c] += MODES[k].p[c] * w; idle.l[c] += MODES[k].l[c] * w; } idle.f += MODES[k].f * w; }
    const dr = reduced ? .25 : 1, dsc = sm(46, 54, T);
    idle.p[0] += Math.sin(idleClock * .11) * 14 * dr * dsc; idle.p[1] += Math.sin(idleClock * .08) * 3.2 * dr * dsc; idle.p[2] += Math.cos(idleClock * .07) * 10 * dr * dsc;
    const P = [0, 1, 2].map(c => lerp(km.p[c], idle.p[c], idleK)), L = [0, 1, 2].map(c => lerp(km.l[c], idle.l[c], idleK));
    let fov = lerp(km.f, idle.f, idleK); const ky = lerp(km.ky, 1, idleK);
    const sc = portrait ? 1.5 : 1;
    if (portrait) { fov = Math.min(70, fov * 1.45); L[0] *= .25; L[1] -= 10 * idleK; }
    shake = onGround && T > T_ROLL ? Math.min(1, s.v / 70) * (1 - sm(T_LIFT - 1, T_LIFT, T)) : 0;
    const sh = reduced ? 0 : shake * .05 + sm(T_LIFT, T_LIFT + 2, T) * (1 - sm(T_LIFT + 2, T_LIFT + 7, T)) * .04;
    const t7 = T * 23;
    camPos.set(Cc.x + P[0] * sc + Math.sin(t7) * sh, Math.max(1.3, P[1] * (portrait ? 1.1 : 1) + Cc.y * ky) + Math.sin(t7 * 1.3 + 1) * sh, Cc.z + P[2] * sc);
    look.set(Cc.x + L[0], Cc.y + L[1], Cc.z + L[2]);
    camera.position.copy(camPos); camera.lookAt(look);
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    sky.position.copy(camPos);

    // atmosphere with altitude
    const altN = sm(0, 700, Cc.y);
    skyUniforms.uAlt.value = altN;
    scene.fog.density = lerp(0.00026, 0.00011, altN);
    glowUniforms.uFog.value = scene.fog.density;
    renderer.toneMappingExposure = lerp(.92, 1.0, altN);

    // clouds: recycle ahead, fade when close to camera
    const cz = Cc.z;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i], sp = c.sprite;
      if (sp.position.z > cz + CWIN_BEHIND) placeCloud(c, cz - CWIN_AHEAD + crng() * 300);
      const d = sp.position.distanceTo(camPos);
      sp.material.opacity = c.base * sm(c.w * .12, c.w * .65, d);
    }

    // glow scale
    const dbs = renderer.getDrawingBufferSize(new THREE.Vector2());
    glowUniforms.uScale.value = dbs.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

    updateWorld(T);

    renderer.render(scene, camera);

    // telemetry + adaptive quality
    API.state = { T, altFt: Cc.y > 5 ? (Cc.y - GROUND_Y) * 3.281 : 0, kts: s.v * 1.944, throttle, speedN: Math.min(1, s.v / 140), altN, onGround };
    telemT += dt; if (opts.onTelemetry && telemT > .1) { telemT = 0; opts.onTelemetry(API.state); }
    fpsAcc += dt; frames++;
    if (frames > 120 && fpsAcc > 2.5 && qualityChecks < 3) {
      const fps = frames / fpsAcc; frames = 0; fpsAcc = 0;
      if (fps < 40 && pr > .8) { pr = Math.max(.75, pr * .8); renderer.setPixelRatio(pr); resize(); qualityChecks++; }
      else if (fps >= 50) qualityChecks = 3;
    }
  }
  requestAnimationFrame(t => { lastNow = t; frame(t); });
  API.ok = true;
  return true;
};
})();
