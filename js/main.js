/* main.js — scene, orbit propagation loop, camera, and UI wiring. */

(() => {
  const EARTH_R = 25;                       // Earth radius in scene units
  const KM = EARTH_R / ORBIT.RE;             // km -> scene units
  const TEX_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/';

  function eciToScene(x, y, z) {
    return new THREE.Vector3(x * KM, z * KM, -y * KM);
  }

  // ---------------------------------------------------------------------
  // Renderer / scene / camera
  // ---------------------------------------------------------------------
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(260, 150, 300);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('scene').appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 27;
  controls.maxDistance = 420;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.enabled = false;

  let idleTimer = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!followMode) controls.autoRotate = true; }, 25000);
  }
  controls.addEventListener('start', () => { controls.autoRotate = false; resetIdleTimer(); });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------------------------------------------------------------------
  // Lighting
  // ---------------------------------------------------------------------
  scene.add(new THREE.AmbientLight(0x1a2540, 0.55));
  const sunLight = new THREE.DirectionalLight(0xfff2df, 1.6);
  scene.add(sunLight);

  // ---------------------------------------------------------------------
  // Starfield
  // ---------------------------------------------------------------------
  function buildStars(count, radius) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.55 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const t = Math.random();
      let cr, cg, cb;
      if (t < 0.78) { cr = cg = cb = 0.78 + Math.random() * 0.22; }
      else if (t < 0.92) { cr = 0.66; cg = 0.76; cb = 1.0; }
      else { cr = 1.0; cg = 0.86; cb = 0.64; }
      colors[i * 3] = cr; colors[i * 3 + 1] = cg; colors[i * 3 + 2] = cb;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false });
    return new THREE.Points(geo, mat);
  }
  scene.add(buildStars(5500, 1700));
  scene.add(buildStars(900, 500));

  // ---------------------------------------------------------------------
  // Canvas-generated glow sprite texture (used for sun corona + sat beacon)
  // ---------------------------------------------------------------------
  function makeGlowTexture(inner, mid, outer) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)');
    g.addColorStop(0.35, mid || 'rgba(255,255,255,0.55)');
    g.addColorStop(1, outer || 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTexture();

  function makeLabelSprite(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '600 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = color || '#eaf0fa';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(6.4, 1.6, 1);
    return spr;
  }

  // ---------------------------------------------------------------------
  // Earth — custom day/night/specular shader
  // ---------------------------------------------------------------------
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  const dayTex = loader.load(TEX_BASE + 'earth_atmos_2048.jpg');
  const nightTex = loader.load(TEX_BASE + 'earth_lights_2048.png');
  const specTex = loader.load(TEX_BASE + 'earth_specular_2048.jpg');
  const cloudTex = loader.load(TEX_BASE + 'earth_clouds_1024.png');

  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayTex },
      nightMap: { value: nightTex },
      specMap: { value: specTex },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D specMap;
      uniform vec3 sunDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(sunDirection);
        float dNL = dot(N, L);
        float dayMix = smoothstep(-0.12, 0.18, dNL);

        vec3 dayColor = texture2D(dayMap, vUv).rgb;
        vec3 nightColor = texture2D(nightMap, vUv).rgb * 1.9;
        float spec = texture2D(specMap, vUv).r;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 halfV = normalize(viewDir + L);
        float specTerm = pow(max(dot(N, halfV), 0.0), 30.0) * spec * dayMix;

        vec3 color = mix(nightColor, dayColor, dayMix) + specTerm * vec3(1.0, 0.96, 0.85) * 0.85;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 64), earthMat);
  scene.add(earthMesh);

  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.012, 64, 64),
    new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1 })
  );
  scene.add(cloudMesh);

  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0x5aebdd) } },
    vertexShader: `
      varying vec3 vNormal;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main(){
        float intensity = pow(0.58 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.16, 48, 48), atmoMat));

  // ---------------------------------------------------------------------
  // Sun — layered corona (core / mid / halo) plus four thin flare spikes,
  // grouped so it reads unambiguously as a star, not a stray glow.
  // ---------------------------------------------------------------------
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);

  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff8e8 }));
  sunGroup.add(sunCore);

  const haloTexWarm = makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,214,140,0.65)', 'rgba(255,140,60,0)');
  const glowInner = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexWarm, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowInner.scale.set(46, 46, 1);
  sunGroup.add(glowInner);

  const glowMid = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexWarm, color: 0xffb157, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  glowMid.scale.set(120, 120, 1);
  sunGroup.add(glowMid);

  const glowOuter = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexWarm, color: 0xff8a4c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  glowOuter.scale.set(260, 260, 1);
  sunGroup.add(glowOuter);

  const flareTex = makeGlowTexture('rgba(255,255,255,0.95)', 'rgba(255,220,170,0.4)', 'rgba(255,220,170,0)');
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: 0xfff4dd, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    spike.material.rotation = (Math.PI / 4) * i;
    spike.scale.set(i % 2 === 0 ? 300 : 40, i % 2 === 0 ? 4 : 4, 1);
    sunGroup.add(spike);
  }

  let sunAngle = 0.6;
  const sunDirVec = new THREE.Vector3();

  // ---------------------------------------------------------------------
  // Moon — real lunar diffuse texture, stylized (compressed) distance.
  // ---------------------------------------------------------------------
  const moonTex = loader.load(TEX_BASE + 'moon_1024.jpg');
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 32, 32),
    new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 })
  );
  scene.add(moon);
  const moonLabel = makeLabelSprite('MOON', '#c9d2e6');
  moonLabel.position.y = 5.4;
  moon.add(moonLabel);
  let moonAngle = 1.2;

  // ---------------------------------------------------------------------
  // Mars and Saturn — small, distinct, compressed-distance background
  // bodies. Not to scale; decorative context, not a solar-system sim.
  // ---------------------------------------------------------------------
  function makeBlotchTexture(base, blotch) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = blotch;
      const r = 6 + Math.random() * 22;
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 28, 28),
    new THREE.MeshStandardMaterial({ map: makeBlotchTexture('#b5522f', '#7a341c'), roughness: 1, metalness: 0 })
  );
  scene.add(mars);
  const marsLabel = makeLabelSprite('MARS', '#e8b39a');
  marsLabel.position.y = 4;
  mars.add(marsLabel);
  let marsAngle = 3.1;

  const saturnGroup = new THREE.Group();
  const saturn = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 28, 28),
    new THREE.MeshStandardMaterial({ map: makeBlotchTexture('#d9be86', '#c2a468'), roughness: 1, metalness: 0 })
  );
  saturnGroup.add(saturn);
  const ringTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 4;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(210,190,150,0)');
    g.addColorStop(0.25, 'rgba(210,190,150,0.75)');
    g.addColorStop(0.55, 'rgba(180,160,120,0.35)');
    g.addColorStop(0.8, 'rgba(210,190,150,0.7)');
    g.addColorStop(1, 'rgba(210,190,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 4);
    return new THREE.CanvasTexture(c);
  })();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 7.4, 64),
    new THREE.MeshBasicMaterial({ map: ringTex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = Math.PI / 2 - 0.46;
  saturnGroup.add(ring);
  const saturnLabel = makeLabelSprite('SATURN', '#e6dcb8');
  saturnLabel.position.y = 5.6;
  saturnGroup.add(saturnLabel);
  scene.add(saturnGroup);
  let saturnAngle = 5.0;

  // ---------------------------------------------------------------------
  // Satellite model
  // ---------------------------------------------------------------------
  function makePanelTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#132238';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(90,235,221,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 64; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
  }

  const satGroup = new THREE.Group();
  const satVisual = new THREE.Group();
  satGroup.add(satVisual);
  scene.add(satGroup);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8f97ab, metalness: 0.7, roughness: 0.35, emissive: 0x0b2a2a, emissiveIntensity: 0.35 });
  satVisual.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), bodyMat));
  satVisual.add(new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.64), new THREE.MeshBasicMaterial({ color: 0x5aebdd })));

  const panelMat = new THREE.MeshStandardMaterial({ map: makePanelTexture(), color: 0x9fb4d9, metalness: 0.2, roughness: 0.55, emissive: 0x0b1f3a, emissiveIntensity: 0.2, side: THREE.DoubleSide });
  const panelGeo = new THREE.BoxGeometry(1.9, 0.04, 0.7);
  const panelL = new THREE.Mesh(panelGeo, panelMat); panelL.position.x = -1.85; satVisual.add(panelL);
  const panelR = new THREE.Mesh(panelGeo, panelMat); panelR.position.x = 1.85; satVisual.add(panelR);

  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }));
  ant.position.set(0, 0.45, -0.2);
  satVisual.add(ant);

  const satGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5aebdd, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
  satGlow.scale.set(2.8, 2.8, 1);
  satVisual.add(satGlow);

  // Parented to satGroup (not the distance-scaled satVisual) so the label
  // stays a consistent, readable size regardless of zoom.
  const satLabel = makeLabelSprite('STARCLOUD-1', '#5aebdd');
  satLabel.position.y = 2.1;
  satLabel.scale.set(5.2, 1.3, 1);
  satGroup.add(satLabel);

  const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  satGroup.add(hitSphere);

  // Trail
  const MAX_TRAIL = 140;
  const trailPositions = new Float32Array(MAX_TRAIL * 3);
  let trailCount = 0;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x5aebdd, transparent: true, opacity: 0.4 }));
  scene.add(trailLine);

  function pushTrail(pos) {
    if (trailCount < MAX_TRAIL) {
      trailPositions.set([pos.x, pos.y, pos.z], trailCount * 3);
      trailCount++;
    } else {
      trailPositions.copyWithin(0, 3);
      trailPositions.set([pos.x, pos.y, pos.z], (MAX_TRAIL - 1) * 3);
    }
    trailGeo.setDrawRange(0, trailCount);
    trailGeo.attributes.position.needsUpdate = true;
  }

  // Ground track marker
  const groundMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.85, 28),
    new THREE.MeshBasicMaterial({ color: 0xffb157, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  scene.add(groundMarker);
  const groundLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0xffb157, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.5 })
  );
  scene.add(groundLine);

  // Orbit ellipse line (rebuilt periodically to reflect slow precession)
  let orbitLine = null;
  function rebuildOrbitLine() {
    const pts = ORBIT.ellipsePoints(currentTLE, simMillis, 180);
    const positions = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i += 3) {
      const v = eciToScene(pts[i], pts[i + 1], pts[i + 2]);
      positions[i] = v.x; positions[i + 1] = v.y; positions[i + 2] = v.z;
    }
    if (!orbitLine) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      orbitLine = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x5aebdd, transparent: true, opacity: 0.3 }));
      scene.add(orbitLine);
    } else {
      orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      orbitLine.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------------
  // Orbital state
  // ---------------------------------------------------------------------
  let currentTLE = ORBIT.parseTLE(SATELLITE.tle.line1, SATELLITE.tle.line2);
  let tleStatusMessage = 'Trajectory from TLE epoch ' + SATELLITE.tle.epochLabel + '.';
  let tleLive = false;
  let tleFetchDebug = '';
  let simMillis = Date.now();
  let speedMultiplier = 120;
  let followMode = false;

  rebuildOrbitLine();

  function formatEpoch(ms) {
    const d = new Date(ms);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function updateTleBadge() {
    const dot = document.getElementById('liveDot');
    const sub = document.getElementById('brandSub');
    if (!dot || !sub) return;
    const epoch = formatEpoch(currentTLE.epochMs);
    if (tleLive) {
      dot.classList.add('live');
      dot.style.background = '';
      dot.style.boxShadow = '';
      sub.textContent = 'NORAD ' + SATELLITE.noradId + ' \u00B7 LIVE \u00B7 TLE ' + epoch;
    } else {
      dot.classList.remove('live');
      dot.style.background = '#ffb157';
      dot.style.boxShadow = '0 0 10px #ffb157';
      sub.textContent = 'NORAD ' + SATELLITE.noradId + ' \u00B7 CACHED \u00B7 TLE ' + epoch;
    }
  }
  updateTleBadge();

  async function fetchText(url, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!res.ok) throw new Error('bad status ' + res.status);
      return await res.text();
    } catch (err) {
      clearTimeout(t);
      throw err;
    }
  }

  async function loadLiveTLE(attempt) {
    attempt = attempt || 0;
    const direct = SATELLITE.liveTleUrl;
    const proxied = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(direct);
    const attempts = [['direct', direct], ['proxy', proxied]];

    const results = await Promise.allSettled(
      attempts.map(([, url]) => fetchText(url, 10000))
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== 'fulfilled') continue;
      const lines = r.value.trim().split('\n').map(l => l.trim());
      const l1 = lines.find(l => l.startsWith('1 ' + SATELLITE.noradId));
      const l2 = lines.find(l => l.startsWith('2 ' + SATELLITE.noradId));
      if (l1 && l2) {
        currentTLE = ORBIT.parseTLE(l1, l2);
        tleLive = true;
        tleStatusMessage = 'Live orbital elements retrieved from CelesTrak.';
        tleFetchDebug = '';
        rebuildOrbitLine();
        updateTleBadge();
        if (attempt > 0) showToast('Live orbital elements now connected.', 4500);
        return;
      }
    }

    tleLive = false;
    tleStatusMessage = FALLBACK_NOTE;
    tleFetchDebug = results.map((r, i) => {
      const label = attempts[i][0];
      if (r.status === 'fulfilled') return label + ': fetched OK but no matching TLE lines';
      const err = r.reason;
      return label + ': ' + (err.name || 'Error') + ' - ' + (err.message || 'unknown');
    }).join('  |  ');
    updateTleBadge();

    // Quietly try again in the background a couple of times — a slow or
    // dropped connection on the first attempt doesn't have to be final.
    if (attempt < 2) setTimeout(() => loadLiveTLE(attempt + 1), 20000);
  }
  loadLiveTLE();

  // ---------------------------------------------------------------------
  // Drawer content
  // ---------------------------------------------------------------------
  function kvRows(rows) { return rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join(''); }

  function populateDrawer() {
    document.getElementById('drawerLede').textContent =
      'Live position of the first data-center-class GPU flown in orbit, propagated from ' + SATELLITE.tle.source + '.';

    document.getElementById('kvSpacecraft').innerHTML = kvRows([
      ['Operator', SATELLITE.company.name],
      ['Bus', SATELLITE.bus],
      ['Mass', SATELLITE.massKg + ' kg — ' + SATELLITE.sizeNote],
      ['Payload', SATELLITE.payload],
      ['NORAD ID', SATELLITE.noradId],
      ["Int'l designator", SATELLITE.intlDesignator],
      ['Launch', SATELLITE.launch.dateLabel],
      ['Vehicle', SATELLITE.launch.vehicle],
      ['Site', SATELLITE.launch.site],
      ['Design life', SATELLITE.missionLifetimeMonths + ' months']
    ]);

    document.getElementById('milestones').innerHTML = SATELLITE.milestones.map(m =>
      `<div class="milestone"><div class="milestone-date mono">${m.date}</div><div class="milestone-text">${m.text}</div></div>`
    ).join('');

    document.getElementById('companyProse').textContent =
      SATELLITE.company.thesis + ' Founded ' + SATELLITE.company.founded + ' by ' + SATELLITE.company.founders + '. Headquartered in ' + SATELLITE.company.hq + '.';
    document.getElementById('nextProse').textContent = SATELLITE.whatsNext;
    document.getElementById('srcNote').innerHTML =
      'Orbital elements: ' + SATELLITE.tle.source + '. Position is computed client-side from a two-body plus J2 propagation of the current TLE, refreshed live from CelesTrak where reachable — a visualization, not operational tracking data.';
  }
  populateDrawer();

  function updateOrbitKV(state) {
    const rows = [
      ['Altitude', state.altitude.toFixed(0) + ' km'],
      ['Inclination', (currentTLE.inc * 180 / Math.PI).toFixed(2) + '°'],
      ['Eccentricity', currentTLE.ecc.toFixed(5) + ' (near-circular)'],
      ['Period', state.periodMin.toFixed(1) + ' min'],
      ['Speed', state.v.toFixed(2) + ' km/s (~' + Math.round(state.v * 3600) + ' km/h)'],
      ['TLE epoch', tleLive ? formatEpoch(currentTLE.epochMs) + ' (live)' : SATELLITE.tle.epochLabel + ' (cached)']
    ];
    if (!tleLive && tleFetchDebug) rows.push(['Live fetch failed', tleFetchDebug]);
    document.getElementById('kvOrbit').innerHTML = kvRows(rows);
  }

  // ---------------------------------------------------------------------
  // Telemetry HUD
  // ---------------------------------------------------------------------
  const el = {
    alt: document.getElementById('statAlt'),
    speed: document.getElementById('statSpeed'),
    lat: document.getElementById('statLat'),
    lon: document.getElementById('statLon'),
    period: document.getElementById('statPeriod'),
    ringFg: document.getElementById('ringFg'),
    ringLabel: document.getElementById('ringLabel'),
    drawer: document.getElementById('drawer')
  };
  const RING_CIRC = 2 * Math.PI * 44;

  function updateTelemetry(state) {
    el.alt.innerHTML = state.altitude.toFixed(0) + '<span class="unit">km</span>';
    el.speed.innerHTML = state.v.toFixed(2) + '<span class="unit">km/s</span>';
    const geo = ORBIT.eciToGeodetic(state.x, state.y, state.z, simMillis);
    el.lat.innerHTML = Math.abs(geo.lat).toFixed(1) + '°<span class="unit">' + (geo.lat >= 0 ? 'N' : 'S') + '</span>';
    el.lon.innerHTML = Math.abs(geo.lon).toFixed(1) + '°<span class="unit">' + (geo.lon >= 0 ? 'E' : 'W') + '</span>';
    el.period.innerHTML = state.periodMin.toFixed(1) + '<span class="unit">min</span>';

    const frac = state.meanAnomaly / (2 * Math.PI);
    el.ringFg.setAttribute('stroke-dashoffset', (RING_CIRC * (1 - frac)).toFixed(1));
    const elapsedSec = frac * state.periodMin * 60;
    const mm = Math.floor(elapsedSec / 60), ss = Math.floor(elapsedSec % 60);
    el.ringLabel.textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');

    if (el.drawer.classList.contains('open')) updateOrbitKV(state);
  }

  // ---------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------
  let toastTimer = null;
  function showToast(msg, dur) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), dur || 4500);
  }

  function setFollowMode(on) {
    followMode = on;
    document.getElementById('followBtn').classList.toggle('active', on);
    document.getElementById('followBadge').classList.toggle('show', on);
    if (on) controls.autoRotate = false;
  }
  document.getElementById('followBtn').addEventListener('click', () => setFollowMode(!followMode));

  document.getElementById('audioBtn').addEventListener('click', async () => {
    if (!AUDIO.isStarted()) { try { await AUDIO.init(); } catch (e) { return; } }
    const btn = document.getElementById('audioBtn');
    const on = !btn.classList.contains('active');
    btn.classList.toggle('active', on);
    AUDIO.setEnabled(on);
  });

  document.getElementById('infoBtn').addEventListener('click', () => el.drawer.classList.toggle('open'));
  document.getElementById('drawerClose').addEventListener('click', () => el.drawer.classList.remove('open'));

  document.querySelectorAll('.speed-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      speedMultiplier = parseFloat(btn.dataset.speed);
      if (speedMultiplier === 1) simMillis = Date.now();
    });
  });

  // click-to-follow on the satellite itself
  const raycaster = new THREE.Raycaster();
  let downPos = null, downTime = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; downTime = performance.now(); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    const dt = performance.now() - downTime;
    downPos = null;
    if (moved > 6 || dt > 500) return;
    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.intersectObject(hitSphere).length) setFollowMode(!followMode);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') setFollowMode(!followMode);
    if (e.key === 'i' || e.key === 'I') el.drawer.classList.toggle('open');
  });

  // ---------------------------------------------------------------------
  // Intro sequence
  // ---------------------------------------------------------------------
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function revealHUD() {
    document.getElementById('hud').classList.remove('hidden');
    requestAnimationFrame(() => {
      document.getElementById('hudTop').classList.add('show');
      setTimeout(() => document.getElementById('hudBottom').classList.add('show'), 150);
      setTimeout(() => document.getElementById('ringWrap').classList.add('show'), 260);
      setTimeout(() => showToast(tleStatusMessage, 5500), 500);
    });
    resetIdleTimer();
  }

  let introStarted = false;
  document.getElementById('enterBtn').addEventListener('click', async () => {
    if (introStarted) return;
    introStarted = true;

    AUDIO.init().then(() => {
      AUDIO.setEnabled(true);
      document.getElementById('audioBtn').classList.add('active');
    }).catch(() => {});

    document.getElementById('flash').classList.add('burst');
    document.getElementById('intro').classList.add('hidden');

    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(0, 46, 96);
    const startFov = camera.fov, endFov = 50;
    const t0 = performance.now();
    const dur = 4200;
    controls.enabled = false;

    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOutCubic(t);
      camera.position.lerpVectors(startPos, endPos, e);
      camera.fov = startFov + (endFov - startFov) * e;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        controls.enabled = true;
        controls.target.set(0, 0, 0);
        revealHUD();
      }
    }
    requestAnimationFrame(step);
  });

  // ---------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------
  const clock = new THREE.Clock();
  let frame = 0;
  let crashed = false;

  function animate() {
    requestAnimationFrame(animate);
    if (crashed) return;
    try {
    const dt = Math.min(clock.getDelta(), 0.1);
    simMillis += dt * 1000 * speedMultiplier;
    frame++;

    const state = ORBIT.propagate(currentTLE, simMillis);
    const satPos = eciToScene(state.x, state.y, state.z);
    satGroup.position.copy(satPos);
    satVisual.rotation.y += dt * 0.15;

    if (frame % 4 === 0) pushTrail(satPos);

    const dist = camera.position.distanceTo(satPos);
    const s = THREE.MathUtils.clamp(dist * 0.028, 0.9, 5.5);
    satVisual.scale.setScalar(s);

    const sub = satPos.clone().normalize().multiplyScalar(EARTH_R);
    groundMarker.position.copy(sub);
    groundMarker.lookAt(0, 0, 0);
    groundLine.geometry.setFromPoints([sub, satPos]);
    groundLine.computeLineDistances();

    earthMesh.rotation.y = ORBIT.gmstRad(simMillis);
    cloudMesh.rotation.y += dt * 0.006;

    sunAngle += dt * 0.006;
    sunDirVec.set(Math.cos(sunAngle), 0.2, Math.sin(sunAngle)).normalize();
    sunLight.position.copy(sunDirVec.clone().multiplyScalar(400));
    sunGroup.position.copy(sunDirVec.clone().multiplyScalar(900));
    earthMat.uniforms.sunDirection.value.copy(sunDirVec);

    moonAngle += dt * 0.018;
    moon.position.set(Math.cos(moonAngle) * 72, Math.sin(moonAngle * 0.37) * 7, Math.sin(moonAngle) * 72);

    marsAngle += dt * 0.008;
    mars.position.set(Math.cos(marsAngle) * 105, Math.sin(marsAngle * 0.22) * 10, Math.sin(marsAngle) * 105);

    saturnAngle += dt * 0.005;
    saturnGroup.position.set(Math.cos(saturnAngle) * 145, Math.sin(saturnAngle * 0.18) * 6, Math.sin(saturnAngle) * 145);
    saturn.rotation.y += dt * 0.04;

    if (frame % 300 === 0) rebuildOrbitLine();

    if (followMode) controls.target.copy(satPos);
    controls.update();

    if (frame % 6 === 0) updateTelemetry(state);

    renderer.render(scene, camera);
    } catch (err) {
      crashed = true;
      showToast('RENDER ERROR: ' + err.message, 999999);
      document.getElementById('hud').classList.remove('hidden');
    }
  }
  animate();
})();
