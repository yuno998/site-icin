export default {
  async fetch(request) {
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Bakım Molası</title>
<style>
  html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
  canvas { display:block; width:100%; height:100%; }
  #hint {
    position:fixed; left:50%; bottom:14%; transform:translateX(-50%);
    color:#fff; font:600 15px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    text-shadow:0 1px 6px rgba(0,0,0,0.7); padding:10px 18px; border-radius:20px;
    background:rgba(0,0,0,0.25); pointer-events:none; white-space:nowrap;
    transition:opacity 0.6s ease; animation:pulse 2s ease-in-out infinite; z-index:5;
  }
  #hint.hidden { opacity:0; animation:none; }
  @keyframes pulse { 0%,100% { opacity:0.95; } 50% { opacity:0.45; } }
  #vig {
    position:fixed; inset:0; pointer-events:none; z-index:3;
    background:radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.32) 100%);
  }
  #foot {
    position:fixed; left:0; right:0; bottom:10px; text-align:center;
    color:#fff; font:11px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    opacity:0.3; pointer-events:none; z-index:5;
  }
</style>
</head>
<body>
<audio id="bgm" loop preload="auto" src="https://mp3tourl.com/audio/1792712233215-a17ca72f-e637-4f60-80e5-f24374ebe5ce.mp3"></audio>
<div id="hint">Müziği başlatmak için dokun</div>
<div id="vig"></div>
<div id="foot">Site bakım molasında — biraz beklemeye ne dersin?</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function () {
  "use strict";

  // ---------- Yardımcılar ----------
  var NL = String.fromCharCode(10);
  function C(h) { return new THREE.Color(h).convertSRGBToLinear(); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function mat(c) { return new THREE.MeshLambertMaterial({ color: C(c) }); }
  // Rüzgar: ortak zaman ve şiddet uniform'ları
  var windTime = { value: 0 }, windAmp = { value: 0.5 };
  function windify(m, key, chunk) {
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = windTime;
      sh.uniforms.uWind = windAmp;
      sh.vertexShader = "uniform float uTime;" + NL + "uniform float uWind;" + NL +
        sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>" + NL + chunk);
    };
    m.customProgramCacheKey = function () { return key; };
  }
  var grassChunk = [
    "float hk = clamp(position.y, 0.0, 1.0);",
    "vec2 ip = vec2(0.0);",
    "#ifdef USE_INSTANCING",
    "ip = instanceMatrix[3].xz;",
    "#endif",
    "float ph = ip.x * 0.35 + ip.y * 0.27;",
    "float sw = sin(uTime * 1.8 + ph) + 0.5 * sin(uTime * 3.1 + ph * 1.9);",
    "transformed.x += sw * uWind * hk * hk * 0.35;",
    "transformed.z += cos(uTime * 1.5 + ph) * uWind * hk * hk * 0.2;"
  ].join(NL);
  var leafChunk = [
    "vec3 ip3 = vec3(0.0);",
    "#ifdef USE_INSTANCING",
    "ip3 = instanceMatrix[3].xyz;",
    "#endif",
    "float ph = ip3.x * 0.7 + ip3.y * 0.9 + ip3.z * 0.5;",
    "transformed += vec3(sin(uTime * 2.2 + ph), 0.5 * sin(uTime * 2.7 + ph * 1.3), cos(uTime * 1.9 + ph)) * uWind * 0.07;"
  ].join(NL);
  var pixCache = {};
  function pixMat(c) {
    if (pixCache[c]) return pixCache[c];
    var cv = document.createElement("canvas");
    cv.width = cv.height = 8;
    var cx = cv.getContext("2d");
    var base = new THREE.Color(c);
    for (var py = 0; py < 8; py++) {
      for (var px = 0; px < 8; px++) {
        var k = 0.9 + Math.random() * 0.2;
        var rr = Math.min(255, Math.round(base.r * 255 * k));
        var gg = Math.min(255, Math.round(base.g * 255 * k));
        var bb = Math.min(255, Math.round(base.b * 255 * k));
        cx.fillStyle = "rgb(" + rr + "," + gg + "," + bb + ")";
        cx.fillRect(px, py, 1, 1);
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.encoding = THREE.sRGBEncoding;
    var m = new THREE.MeshLambertMaterial({ map: tex });
    pixCache[c] = m;
    return m;
  }
  function makeRainTex() {
    var cv = document.createElement("canvas");
    cv.width = 16; cv.height = 64;
    var cx = cv.getContext("2d");
    var gr = cx.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.7, "rgba(255,255,255,0.9)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = gr;
    cx.fillRect(7, 0, 2, 64);
    return new THREE.CanvasTexture(cv);
  }
  function box(w, h, d, c, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pixMat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  // ---------- Renderer ----------
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = C(0x87ceeb);
  scene.fog = new THREE.Fog(C(0xb5dcf0), 25, 170);

  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(1.1, 1.25, 3.5);
  camera.lookAt(-3.5, 5, -22);

  // ---------- Gökyüzü kubbesi (gradyan) ----------
  var skyUniforms = {
    topColor: { value: C(0x4aa8f0) },
    bottomColor: { value: C(0xb5dcf0) }
  };
  var skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: [
      "varying vec3 vDir;",
      "void main() {",
      "  vDir = normalize(position);",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join(NL),
    fragmentShader: [
      "uniform vec3 topColor;",
      "uniform vec3 bottomColor;",
      "varying vec3 vDir;",
      "void main() {",
      "  float h = clamp(vDir.y, 0.0, 1.0);",
      "  float t = pow(h, 0.55);",
      "  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);",
      "  #include <tonemapping_fragment>",
      "  #include <encodings_fragment>",
      "}"
    ].join(NL)
  });
  var skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  skyDome.renderOrder = -10;
  scene.add(skyDome);

  // ---------- Işıklar ----------
  var ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(0, 30, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -8;
  dirLight.shadow.camera.right = 8;
  dirLight.shadow.camera.top = 8;
  dirLight.shadow.camera.bottom = -8;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 120;
  dirLight.shadow.bias = -0.0006;
  scene.add(dirLight);
  scene.add(dirLight.target);

  var lightning = new THREE.PointLight(0xaaccff, 0, 400, 1);
  lightning.position.set(0, 40, -60);
  scene.add(lightning);

  // ---------- Zemin ----------
  function heightAt(x, z) {
    var y = -z;
    var r = Math.sqrt(x * x + z * z);
    var f = clamp01((r - 6) / 20);
    f = f * f * (3 - 2 * f);
    return f * (Math.sin(x * 0.07) * Math.cos(y * 0.06) * 2.0 +
                Math.sin(x * 0.19 + y * 0.13) * 0.35 +
                Math.cos(y * 0.23) * 0.25);
  }

  (function buildGround() {
    var geo = new THREE.PlaneGeometry(600, 600, 160, 160);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var cA = C(0x3f7f35), cB = C(0x5aa645), tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      var wz = -y;
      pos.setZ(i, heightAt(x, wz));
      var n = (Math.sin(x * 0.31) * Math.sin(y * 0.27) + 1) * 0.5;
      n = clamp01(n * 0.7 + Math.random() * 0.3);
      tmp.copy(cA).lerp(cB, n);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    scene.add(m);
  })();

  // ---------- Çimen (instanced, rüzgarla sallanır) ----------
  (function buildGrass() {
    var TUFTS = 3400, BLADES = 5, COUNT = TUFTS * BLADES;
    var g = new THREE.ConeGeometry(0.055, 1, 4, 1, true);
    g.translate(0, 0.5, 0);
    var gm = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    windify(gm, "grass", grassChunk);
    var im = new THREE.InstancedMesh(g, gm, COUNT);
    im.frustumCulled = false;
    var palette = [0x2f7a2c, 0x3d8f35, 0x4aa03c, 0x58b248, 0x6bbf52, 0x2a6a28, 0x78c85a].map(C);
    var dummy = new THREE.Object3D();
    var idx = 0;
    for (var t = 0; t < TUFTS; t++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = 0.4 + Math.pow(Math.random(), 1.35) * 75;
      var near = rad < 4.5;
      var cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
      for (var b = 0; b < BLADES; b++) {
        var x = cx + rand(-0.25, 0.25), z = cz + rand(-0.25, 0.25);
        dummy.position.set(x, heightAt(x, z) - 0.02, z);
        dummy.rotation.set(rand(-0.25, 0.25), rand(0, 6.28), rand(-0.25, 0.25));
        var h = near ? rand(0.22, 0.5) : rand(0.35, 1.0);
        dummy.scale.set(rand(0.8, 1.4), h, rand(0.8, 1.4));
        dummy.updateMatrix();
        im.setMatrixAt(idx, dummy.matrix);
        im.setColorAt(idx, palette[Math.floor(Math.random() * palette.length)]);
        idx++;
      }
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
  })();

  // ---------- Çiçekler ----------
  (function buildFlowers() {
    var N = 220;
    var stems = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), new THREE.MeshLambertMaterial({ color: C(0x3d8a35) }), N);
    var heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    stems.frustumCulled = false;
    heads.frustumCulled = false;
    var pal = [0xe94b4b, 0xf5d142, 0xffffff, 0xf08cc0, 0x6a8cf0, 0xff9a3c].map(C);
    var d = new THREE.Object3D();
    for (var i = 0; i < N; i++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = 3 + Math.pow(Math.random(), 0.8) * 45;
      var x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      var y = heightAt(x, z), hh = rand(0.3, 0.5);
      d.position.set(x, y + hh / 2, z);
      d.rotation.set(0, rand(0, 6.28), 0);
      d.scale.set(1, hh / 0.4, 1);
      d.updateMatrix();
      stems.setMatrixAt(i, d.matrix);
      d.position.set(x, y + hh + 0.05, z);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      heads.setMatrixAt(i, d.matrix);
      heads.setColorAt(i, pal[Math.floor(Math.random() * pal.length)]);
    }
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    scene.add(stems);
    scene.add(heads);
  })();

  // ---------- Ağaçlar (yaprak blokları, rüzgarla sallanır) ----------
  var trees = [];
  var leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  windify(leafMat, "leaf", leafChunk);
  (function buildTrees() {
    var trunkMat = pixMat(0x6b4423);
    var coreMats = [mat(0x1f5a28), mat(0x1a4d22), mat(0x265e2a)];
    var pal = [0x2f7a2c, 0x3b8f33, 0x4aa03c, 0x58b248, 0x2a6a28, 0x6bbf52].map(C);
    var d = new THREE.Object3D();
    for (var i = 0; i < 20; i++) {
      var x = rand(-95, 95), z = rand(-115, -24);
      if (Math.abs(x) < 5 && z > -20) x += 12;
      var g = new THREE.Group();
      var th = rand(4, 6.5);
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, th, 7), trunkMat);
      trunk.position.y = th / 2;
      g.add(trunk);
      var n = 2 + Math.floor(Math.random() * 2);
      var spheres = [];
      for (var k = 0; k < n; k++) {
        var r = rand(2.2, 3.4);
        var sp = { x: rand(-0.8, 0.8), y: th + k * 1.5 + 0.5, z: rand(-0.8, 0.8), r: r };
        spheres.push(sp);
        var core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 14, 10), coreMats[Math.floor(Math.random() * coreMats.length)]);
        core.position.set(sp.x, sp.y, sp.z);
        g.add(core);
      }
      var LEAVES = 120 * n;
      var im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), leafMat, LEAVES);
      im.frustumCulled = false;
      for (var j = 0; j < LEAVES; j++) {
        var s2 = spheres[j % n];
        var u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
        var sq = Math.sqrt(1 - u * u), rr = s2.r * rand(0.85, 1.05);
        d.position.set(s2.x + sq * Math.cos(a) * rr, s2.y + u * rr * 0.9, s2.z + sq * Math.sin(a) * rr);
        d.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
        d.scale.setScalar(rand(0.7, 1.3));
        d.updateMatrix();
        im.setMatrixAt(j, d.matrix);
        im.setColorAt(j, pal[Math.floor(Math.random() * pal.length)]);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      g.add(im);
      g.position.set(x, heightAt(x, z), z);
      g.userData.ph = rand(0, 6.28);
      trees.push(g);
      scene.add(g);
    }
  })();

  // ---------- Bulutlar ----------
  var cloudShades = [1.0, 0.9, 0.78];
  var cloudMats = cloudShades.map(function () {
    return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, fog: false });
  });
  var clouds = [];
  (function buildClouds() {
    var N = 10;
    for (var i = 0; i < N; i++) {
      var g = new THREE.Group();
      var parts = 6 + Math.floor(Math.random() * 4);
      for (var k = 0; k < parts; k++) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(rand(6, 14), rand(2, 3.5), rand(5, 9)), cloudMats[k % 3]);
        m.position.set(k * 5 - parts * 2.5 + rand(-2, 2), rand(-0.8, 1.2), rand(-3, 3));
        g.add(m);
      }
      g.position.set(rand(-200, 200), rand(38, 62), rand(-190, -35));
      g.userData.speed = rand(0.8, 2.0);
      scene.add(g);
      clouds.push(g);
    }
  })();

  // ---------- Güneş, Ay, Yıldızlar ----------
  function makeGlow(c0, c1) {
    var cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    var cx = cv.getContext("2d");
    var gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, c0);
    gr.addColorStop(0.35, c1);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }

  var sunMat = new THREE.MeshBasicMaterial({ color: 0xffee66, transparent: true, fog: false, toneMapped: false });
  var sun = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), sunMat);
  scene.add(sun);
  var sunHaloMat = new THREE.SpriteMaterial({
    map: makeGlow("rgba(255,240,150,0.95)", "rgba(255,200,80,0.35)"),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false
  });
  var sunHalo = new THREE.Sprite(sunHaloMat);
  sunHalo.scale.set(75, 75, 1);
  scene.add(sunHalo);

  var moonMat = new THREE.MeshBasicMaterial({ color: 0xf4f0cc, transparent: true, fog: false, toneMapped: false });
  var moon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 14), moonMat);
  scene.add(moon);
  var moonHaloMat = new THREE.SpriteMaterial({
    map: makeGlow("rgba(220,230,255,0.6)", "rgba(160,180,255,0.18)"),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false
  });
  var moonHalo = new THREE.Sprite(moonHaloMat);
  moonHalo.scale.set(32, 32, 1);
  scene.add(moonHalo);

  var starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0,
    depthWrite: false, fog: false, toneMapped: false
  });
  (function buildStars() {
    var N = 700, arr = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.98 + 0.02, Math.random() - 0.5).normalize().multiplyScalar(420);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    var p = new THREE.Points(g, starMat);
    p.frustumCulled = false;
    p.renderOrder = -5;
    scene.add(p);
  })();

  // ---------- Steve ----------
  var steve = new THREE.Group();
  scene.add(steve);
  var upper = new THREE.Group();
  steve.add(upper);
  var headPivot = new THREE.Group();

  (function buildSteve() {
    var SKIN = 0xc4a46d, HAIR = 0x3b2414, SHIRT = 0x2f6fd0, PANTS = 0x1f2f7a, SHOE = 0x4a4a4a;
    var s, i;

    // pelvis
    box(0.5, 0.25, 0.27, PANTS, 0, 0.14, 0, steve);

    // bacaklar (oturur, dizler bükük)
    for (i = 0; i < 2; i++) {
      s = i === 0 ? -1 : 1;
      var thigh = new THREE.Group();
      thigh.position.set(s * 0.13, 0.14, -0.05);
      thigh.rotation.x = 0.7;
      steve.add(thigh);
      box(0.25, 0.25, 0.75, PANTS, 0, 0, -0.375, thigh);
      var knee = new THREE.Group();
      knee.position.set(0, 0, -0.75);
      knee.rotation.x = -0.785 - 0.7;
      thigh.add(knee);
      box(0.25, 0.25, 0.75, PANTS, 0, 0, -0.375, knee);
      box(0.27, 0.2, 0.3, SHOE, 0, -0.03, -0.82, knee);
    }

    // gövde
    box(0.5, 0.65, 0.27, SHIRT, 0, 0.59, 0, upper);
    box(0.52, 0.08, 0.29, 0x2a1a0e, 0, 0.30, 0, upper);          // kemer
    box(0.1, 0.08, 0.02, 0xd9b84a, 0, 0.30, -0.15, upper);       // toka
    box(0.3, 0.05, 0.3, 0x5a8fe0, 0, 0.92, 0, upper);            // yaka
    box(0.2, 0.12, 0.2, SKIN, 0, 0.96, 0, upper);                // boyun

    // kollar (dizlerde)
    for (i = 0; i < 2; i++) {
      s = i === 0 ? -1 : 1;
      var arm = new THREE.Group();
      arm.position.set(s * 0.375, 0.85, 0);
      arm.rotation.x = -0.37;
      upper.add(arm);
      box(0.25, 0.25, 0.3, SHIRT, 0, 0, -0.15, arm);
      box(0.25, 0.25, 0.32, SKIN, 0, 0, -0.46, arm);
    }

    // baş (gökyüzüne bakar, yüz -Z)
    headPivot.position.set(0, 1.0, 0);
    headPivot.rotation.x = 0.65;
    upper.add(headPivot);
    box(0.5, 0.5, 0.5, SKIN, 0, 0.25, 0, headPivot);

    // saç: üst, arka, yanlar, alın
    box(0.54, 0.1, 0.54, HAIR, 0, 0.52, 0, headPivot);
    box(0.54, 0.44, 0.06, HAIR, 0, 0.29, 0.26, headPivot);
    box(0.05, 0.36, 0.5, HAIR, -0.265, 0.33, 0, headPivot);
    box(0.05, 0.36, 0.5, HAIR, 0.265, 0.33, 0, headPivot);
    box(0.5, 0.08, 0.05, HAIR, 0, 0.46, -0.26, headPivot);

    // yüz
    for (i = 0; i < 2; i++) {
      s = i === 0 ? -1 : 1;
      box(0.12, 0.07, 0.02, 0xffffff, s * 0.12, 0.27, -0.255, headPivot);   // göz beyazı
      box(0.06, 0.07, 0.025, 0x3a3a9a, s * 0.09, 0.27, -0.264, headPivot);  // pupil
      box(0.13, 0.03, 0.02, HAIR, s * 0.12, 0.34, -0.256, headPivot);       // kaş
    }
    box(0.08, 0.08, 0.04, 0xa8845a, 0, 0.17, -0.268, headPivot);             // burun
    box(0.5, 0.15, 0.02, 0x8a6c3e, 0, 0.065, -0.254, headPivot);             // sakal izi
    box(0.14, 0.03, 0.02, 0x5a2e22, 0, 0.1, -0.265, headPivot);              // ağız
  })();

  // ---------- Köpek ----------
  var dog = new THREE.Group();
  dog.position.set(1.05, 0, -0.35);
  dog.rotation.y = 0.15;
  scene.add(dog);
  var dogBody = new THREE.Group();
  var dogHead = new THREE.Group();
  var dogTail = new THREE.Group();

  (function buildDog() {
    var FUR = 0xb07a3c, LIGHT = 0xe8d3a8, DARK = 0x3a2414;
    var s, i;

    dogBody.position.set(0, 0.45, 0.1);
    dogBody.rotation.x = 0.5;
    dog.add(dogBody);
    box(0.4, 0.4, 0.8, FUR, 0, 0, 0, dogBody);
    box(0.3, 0.3, 0.1, LIGHT, 0, -0.05, -0.38, dogBody);

    for (i = 0; i < 2; i++) {
      s = i === 0 ? -1 : 1;
      box(0.12, 0.52, 0.12, FUR, s * 0.12, 0.26, -0.3, dog);        // ön bacak
      box(0.14, 0.08, 0.2, LIGHT, s * 0.12, 0.04, -0.34, dog);      // ön pati
      box(0.14, 0.3, 0.46, FUR, s * 0.22, 0.17, 0.35, dog);         // kalça
      box(0.14, 0.08, 0.24, LIGHT, s * 0.22, 0.04, 0.52, dog);      // arka pati
    }

    dogHead.position.set(0, 0.95, -0.3);
    dogHead.rotation.x = 0.7;
    dog.add(dogHead);
    box(0.36, 0.36, 0.36, FUR, 0, 0, 0, dogHead);
    box(0.2, 0.14, 0.22, LIGHT, 0, -0.07, -0.27, dogHead);         // burun kısmı
    box(0.08, 0.06, 0.04, 0x111111, 0, -0.01, -0.39, dogHead);     // burun
    for (i = 0; i < 2; i++) {
      s = i === 0 ? -1 : 1;
      box(0.1, 0.22, 0.07, DARK, s * 0.2, 0.18, 0.02, dogHead);    // kulak
      box(0.07, 0.07, 0.02, 0xffffff, s * 0.1, 0.06, -0.182, dogHead);
      box(0.045, 0.06, 0.025, 0x111111, s * 0.1, 0.06, -0.19, dogHead);
    }

    dogTail.position.set(0, 0.28, 0.52);
    dogTail.rotation.x = -0.5;
    dog.add(dogTail);
    box(0.08, 0.08, 0.4, FUR, 0, 0, 0.2, dogTail);
    box(0.09, 0.09, 0.1, LIGHT, 0, 0, 0.42, dogTail);
  })();

  // ---------- Yağmur ----------
  var RN = 3000;
  var rainPos = new Float32Array(RN * 3);
  var rainVel = new Float32Array(RN);
  for (var ri = 0; ri < RN; ri++) {
    rainPos[ri * 3] = (Math.random() - 0.5) * 70;
    rainPos[ri * 3 + 1] = Math.random() * 38;
    rainPos[ri * 3 + 2] = -55 + Math.random() * 65;
    rainVel[ri] = 28 + Math.random() * 14;
  }
  var rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  var rainMat = new THREE.PointsMaterial({
    color: 0xbfd6ff, size: 0.9, map: makeRainTex(), alphaTest: 0.01, transparent: true, opacity: 0, depthWrite: false
  });
  var rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // ---------- Ateşböcekleri (geceleri) ----------
  var FN = 70;
  var ffBase = new Float32Array(FN * 3), ffPos = new Float32Array(FN * 3), ffPh = new Float32Array(FN);
  for (var fi = 0; fi < FN; fi++) {
    ffBase[fi * 3] = rand(-16, 16);
    ffBase[fi * 3 + 1] = rand(0.4, 2.2);
    ffBase[fi * 3 + 2] = rand(-16, 2);
    ffPh[fi] = rand(0, 6.28);
  }
  ffPos.set(ffBase);
  var ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3));
  var ffMat = new THREE.PointsMaterial({
    color: 0xd8ff80, size: 0.45, map: makeGlow("rgba(255,255,210,1)", "rgba(190,255,90,0.5)"),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false
  });
  var fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);

  // ---------- Rüzgarda uçuşan yapraklar ----------
  var LN = 40;
  var lvPos = new Float32Array(LN * 3), lvVel = new Float32Array(LN);
  for (var li = 0; li < LN; li++) {
    lvPos[li * 3] = rand(-40, 40);
    lvPos[li * 3 + 1] = rand(0.5, 14);
    lvPos[li * 3 + 2] = rand(-45, 4);
    lvVel[li] = rand(0.4, 1.0);
  }
  var lvGeo = new THREE.BufferGeometry();
  lvGeo.setAttribute("position", new THREE.BufferAttribute(lvPos, 3));
  var lvMat = new THREE.PointsMaterial({ color: C(0x8fc94a), size: 0.22, sizeAttenuation: true, transparent: true, depthWrite: false });
  var leavesPts = new THREE.Points(lvGeo, lvMat);
  leavesPts.frustumCulled = false;
  scene.add(leavesPts);

  // ---------- Gün döngüsü verisi (9 faz) ----------
  function kf(sky, fog, amb, ambI, dir, dirI, stars, cloud, bright) {
    return { sky: C(sky), fog: C(fog), amb: C(amb), ambI: ambI, dir: C(dir), dirI: dirI, stars: stars, cloud: C(cloud), bright: bright };
  }
  var KF = [
    kf(0x050816, 0x070b1c, 0x2a3a6a, 0.45, 0x6688cc, 0.30, 1.0, 0x1a2035, 0.10), // derin gece
    kf(0x2b2f5e, 0x3a3f70, 0x5a5f9a, 0.50, 0x8a86c0, 0.35, 0.6, 0x4a4a78, 0.25), // şafak
    kf(0xf2a07a, 0xf0b08c, 0xffc09a, 0.62, 0xffb070, 0.90, 0.0, 0xffc3a0, 0.60), // gün doğumu
    kf(0x8fcdf5, 0xb5dcf0, 0xdde8ff, 0.72, 0xfff2d8, 1.30, 0.0, 0xffffff, 0.90), // sabah
    kf(0x4aa8f0, 0xa8d4f4, 0xffffff, 0.80, 0xffffff, 1.60, 0.0, 0xffffff, 1.00), // öğlen
    kf(0x6bb5ec, 0xb8d8ee, 0xfff4e0, 0.75, 0xffe6b8, 1.40, 0.0, 0xfff6e8, 0.95), // öğleden sonra
    kf(0xe8664a, 0xe58a5e, 0xff9a6a, 0.58, 0xff8040, 0.90, 0.0, 0xff9a70, 0.55), // gün batımı
    kf(0x3a2a5a, 0x4a3866, 0x6a5a9a, 0.45, 0x8a70b0, 0.30, 0.5, 0x4a3a66, 0.25), // alacakaranlık
    kf(0x0a0e24, 0x0c1230, 0x2a3a6a, 0.45, 0x6688cc, 0.30, 1.0, 0x1a2238, 0.12)  // gece
  ];
  var START_OFFSET = 18; // Sabah aşamasında başla
  var CYCLE = 60;

  var cSky = new THREE.Color(), cFog = new THREE.Color(), cAmb = new THREE.Color(), cDir = new THREE.Color(), cCloud = new THREE.Color();
  var grayTop = new THREE.Color(), grayFog = new THREE.Color(), grayAmb = C(0x8a909a), white = new THREE.Color(1, 1, 1);

  // ---------- Hava durumu (gerçek saate bağlı; yeniden yüklemede sıfırlanmaz) ----------
  var weather = "clear";
  var wLevel = 0, stormLevel = 0;
  var flashSeq = [], nextFlash = 0, flashLevel = 0;
  var WX_BLOCK = 3600;
  var wxBlock = -1, wxSegs = [];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function buildWx(block) {
    var rng = mulberry32((block * 2654435761) >>> 0);
    wxSegs = [];
    var tp = 0;
    while (tp < WX_BLOCK) {
      tp += 15 + rng() * 20;                       // 15-35 sn bekleme
      var r = rng();
      var type = r < 0.4 ? "rain" : (r < 0.6 ? "storm" : "clear");
      if (type !== "clear") {
        wxSegs.push({ s: tp, e: Math.min(tp + 50, WX_BLOCK), type: type });
        tp += 50;
      }
    }
    wxBlock = block;
  }
  function weatherNow() {
    var ws = Date.now() / 1000;
    var block = Math.floor(ws / WX_BLOCK);
    if (block !== wxBlock) buildWx(block);
    var off = ws - block * WX_BLOCK;
    for (var i = 0; i < wxSegs.length; i++) {
      if (off >= wxSegs[i].s && off < wxSegs[i].e) return wxSegs[i].type;
    }
    return "clear";
  }

  function updateWeather(now) {
    var w = weatherNow();
    if (w !== weather) {
      weather = w;
      flashSeq.length = 0;
      if (w === "storm") nextFlash = now + rand(2, 6);
    }
    if (weather === "storm") {
      if (now >= nextFlash && flashSeq.length === 0) {
        var cnt = 2 + Math.floor(Math.random() * 2);
        for (var i = 0; i < cnt; i++) flashSeq.push(now + i * 0.22 + Math.random() * 0.08);
        nextFlash = now + rand(2, 6) + cnt * 0.25;
        thunder(rand(0.5, 2.2));
      }
    }
    while (flashSeq.length && now >= flashSeq[0]) {
      flashSeq.shift();
      flashLevel = 1;
      lightning.position.set(rand(-40, 40), rand(30, 45), rand(-80, -30));
    }
  }

  // ---------- Ses efektleri (WebAudio, dışarıdan dosya yok) ----------
  var actx = null, noiseBuf = null, rainGain = null, windGain = null, masterGain = null, windLP = null;
  var audioEvs = ["click", "touchstart", "touchend", "pointerdown", "keydown"];

  function initAudio() {
    if (actx) { if (actx.state === "suspended") actx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      actx = new AC();
      var len = actx.sampleRate * 3;
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      var d = noiseBuf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = w * 0.6 + last * 3.0;
      }
      var comp = actx.createDynamicsCompressor();
      masterGain = actx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(comp);
      comp.connect(actx.destination);

      // yağmur: yüksek frekanslı gürültü
      var rs = actx.createBufferSource();
      rs.buffer = noiseBuf; rs.loop = true;
      var hp = actx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 350;
      var lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      rainGain = actx.createGain(); rainGain.gain.value = 0;
      rs.connect(hp); hp.connect(lp); lp.connect(rainGain); rainGain.connect(masterGain);
      rs.start(0, 0.4);

      // rüzgar / uğultu: alçak frekanslı gürültü
      var ws = actx.createBufferSource();
      ws.buffer = noiseBuf; ws.loop = true; ws.playbackRate.value = 0.6;
      var wl = actx.createBiquadFilter(); wl.type = "lowpass"; wl.frequency.value = 450; windLP = wl;
      windGain = actx.createGain(); windGain.gain.value = 0;
      ws.connect(wl); wl.connect(windGain); windGain.connect(masterGain);
      ws.start(0, 1.3);
    } catch (e) { actx = null; }
  }

  function unlockAudio() {
    initAudio();
    if (actx && actx.state === "running") {
      audioEvs.forEach(function (e) { window.removeEventListener(e, unlockAudio); });
    }
  }
  audioEvs.forEach(function (e) { window.addEventListener(e, unlockAudio, { passive: true }); });

  function thunder(delay) {
    if (!actx || actx.state !== "running" || !noiseBuf) return;
    var t0 = actx.currentTime + delay;
    var src = actx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var lp = actx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.exponentialRampToValueAtTime(70, t0 + 3.5);
    var g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1.2, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.2);
    src.connect(lp); lp.connect(g); g.connect(masterGain);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + 4.4);
  }

  function updateAudio(t, ws) {
    if (!actx || !rainGain) return;
    rainGain.gain.value = 0.05 * wLevel * (1 + 0.5 * stormLevel);
    windGain.gain.value = 0.02 + 0.035 * ws + 0.06 * stormLevel;
    if (windLP) windLP.frequency.value = 300 + 300 * ws;
  }

  // ---------- Animasyon döngüsü ----------
  var clock = new THREE.Clock();
  var dayP = 0;

  function placeBody(mesh, halo, a) {
    var x = -Math.cos(a) * 90, y = Math.sin(a) * 55, z = -125;
    mesh.position.set(x, y, z);
    halo.position.set(x, y, z);
    mesh.visible = halo.visible = y > -8;
  }

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.1);
    var t = clock.elapsedTime;

    updateWeather(t);
    var wTarget = weather === "clear" ? 0 : 1;
    var sTarget = weather === "storm" ? 1 : 0;
    var k = 1 - Math.exp(-dt * 0.7);
    wLevel += (wTarget - wLevel) * k;
    stormLevel += (sTarget - stormLevel) * k;
    flashLevel *= Math.exp(-dt * 14);
    if (flashLevel < 0.003) flashLevel = 0;
    var windS = Math.max(0.1, 0.35 + 0.2 * Math.sin(t * 0.31) + 0.15 * Math.sin(t * 0.83 + 1) + 0.25 * wLevel + 0.9 * stormLevel);

    // faz interpolasyonu
    var p = ((Date.now() / 1000) % CYCLE) / CYCLE;
    dayP = p;
    var pos = p * 9, i0 = Math.floor(pos) % 9, f = pos - Math.floor(pos);
    f = f * f * (3 - 2 * f);
    var A = KF[i0], B = KF[(i0 + 1) % 9];
    cSky.copy(A.sky).lerp(B.sky, f);
    cFog.copy(A.fog).lerp(B.fog, f);
    cAmb.copy(A.amb).lerp(B.amb, f);
    cDir.copy(A.dir).lerp(B.dir, f);
    cCloud.copy(A.cloud).lerp(B.cloud, f);
    var ambI = A.ambI + (B.ambI - A.ambI) * f;
    var dirI = A.dirI + (B.dirI - A.dirI) * f;
    var starsV = A.stars + (B.stars - A.stars) * f;
    var bright = A.bright + (B.bright - A.bright) * f;

    // hava etkisi: gri/koyu gökyüzü
    var dark = (1 - 0.45 * stormLevel) * (0.18 + 0.82 * bright);
    grayTop.copy(C(0x6d737c)).multiplyScalar(dark);
    grayFog.copy(C(0x8a9099)).multiplyScalar(dark);
    cSky.lerp(grayTop, wLevel);
    cFog.lerp(grayFog, wLevel);
    cAmb.lerp(grayAmb, wLevel * 0.6);
    ambI *= (1 - 0.3 * wLevel);
    dirI *= (1 - 0.75 * wLevel);
    if (flashLevel > 0) {
      cSky.lerp(white, flashLevel * 0.5);
      cFog.lerp(white, flashLevel * 0.35);
    }

    skyUniforms.topColor.value.copy(cSky);
    skyUniforms.bottomColor.value.copy(cFog);
    scene.background.copy(cSky);
    scene.fog.color.copy(cFog);
    scene.fog.far = 170 - 60 * wLevel;
    ambient.color.copy(cAmb);
    ambient.intensity = ambI;
    dirLight.color.copy(cDir);
    dirLight.intensity = dirI;
    lightning.intensity = flashLevel * 12;

    // güneş / ay
    var sS = 1.7 / 9, sE = 6.3 / 9;
    var sunUp = p >= sS && p <= sE;
    var pm = p < sS ? p + 1 : p;
    var moonUp = pm >= sE && pm <= 1 + sS;
    var lightA = 0;
    if (sunUp) {
      lightA = Math.PI * (p - sS) / (sE - sS);
      placeBody(sun, sunHalo, lightA);
      moon.visible = moonHalo.visible = false;
    } else {
      sun.visible = sunHalo.visible = false;
      if (moonUp) {
        lightA = Math.PI * (pm - sE) / ((1 + sS) - sE);
        placeBody(moon, moonHalo, lightA);
      } else {
        moon.visible = moonHalo.visible = false;
      }
    }
    var clearV = 1 - wLevel;
    if (clearV < 0.02) { sun.visible = sunHalo.visible = moon.visible = moonHalo.visible = false; }
    sunMat.opacity = clearV;
    sunHaloMat.opacity = clearV * 0.9;
    moonMat.opacity = clearV;
    moonHaloMat.opacity = clearV * 0.8;

    // ışık yönü (okunabilirlik için hafif arkadan)
    dirLight.position.set(-Math.cos(lightA) * 30, Math.max(Math.sin(lightA) * 30, 6) + 6, 12);

    // yıldızlar
    starMat.opacity = starsV * clearV * (0.88 + 0.12 * Math.sin(t * 2.3));

    // bulutlar
    for (var cmi = 0; cmi < cloudMats.length; cmi++) {
      cloudMats[cmi].color.copy(cCloud).multiplyScalar(cloudShades[cmi]);
      cloudMats[cmi].opacity = clearV;
    }
    
    var cv = clearV > 0.02;
    for (var ci = 0; ci < clouds.length; ci++) {
      var c = clouds[ci];
      c.visible = cv;
      c.position.x += c.userData.speed * (0.6 + 0.6 * windS) * dt;
      if (c.position.x > 230) c.position.x = -230;
    }

    // yağmur
    var rainA = wLevel;
    rain.visible = rainA > 0.02;
    if (rain.visible) {
      rainMat.opacity = 0.65 * rainA;
      var wind = 1.5 + 3 * windS;
      var arr = rainGeo.attributes.position.array;
      for (var r = 0; r < RN; r++) {
        var j = r * 3;
        arr[j + 1] -= rainVel[r] * dt;
        arr[j] += wind * dt;
        if (arr[j + 1] < 0) {
          arr[j + 1] = 38;
          arr[j] = (Math.random() - 0.5) * 70;
          arr[j + 2] = -55 + Math.random() * 65;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // ses + ateşböcekleri
    updateAudio(t, windS);
    windTime.value = t;
    windAmp.value = windS;
    for (var tri = 0; tri < trees.length; tri++) {
      var tr = trees[tri], tph = tr.userData.ph;
      tr.rotation.z = Math.sin(t * 0.9 + tph) * 0.014 * windS;
      tr.rotation.x = Math.cos(t * 0.7 + tph) * 0.008 * windS;
    }
    var lp3 = lvGeo.attributes.position.array;
    for (var lk = 0; lk < LN; lk++) {
      var lq = lk * 3;
      lp3[lq] += (0.8 + windS * 2.2) * dt + Math.sin(t * 1.3 + lk) * 0.01;
      lp3[lq + 1] -= lvVel[lk] * dt;
      lp3[lq + 2] += Math.cos(t * 0.9 + lk) * 0.01;
      if (lp3[lq + 1] < 0.05 || lp3[lq] > 45) {
        lp3[lq] = rand(-40, 40);
        lp3[lq + 1] = rand(9, 15);
        lp3[lq + 2] = rand(-45, 4);
      }
    }
    lvGeo.attributes.position.needsUpdate = true;
    var ffA = Math.max(0, starsV - 0.25) * clearV;
    fireflies.visible = ffA > 0.02;
    if (fireflies.visible) {
      ffMat.opacity = ffA * (0.75 + 0.25 * Math.sin(t * 3));
      var fp = ffGeo.attributes.position.array;
      for (var fk = 0; fk < FN; fk++) {
        var q = fk * 3;
        fp[q] = ffBase[q] + Math.sin(t * 0.6 + ffPh[fk]) * 0.8;
        fp[q + 1] = ffBase[q + 1] + Math.sin(t * 0.9 + ffPh[fk] * 1.7) * 0.35;
        fp[q + 2] = ffBase[q + 2] + Math.cos(t * 0.5 + ffPh[fk]) * 0.8;
      }
      ffGeo.attributes.position.needsUpdate = true;
    }

    // Steve nefes + hafif kafa hareketi
    upper.position.y = Math.sin(t * 1.8) * 0.012;
    headPivot.rotation.x = 0.65 + Math.sin(t * 0.7) * 0.02;

    // Köpek: nefes + kuyruk sallama
    dogBody.position.y = 0.45 + Math.sin(t * 2.4 + 1) * 0.008;
    dogHead.position.y = 0.95 + Math.sin(t * 2.4 + 1) * 0.012;
    dogHead.rotation.x = 0.7 + Math.sin(t * 0.9) * 0.03;
    dogTail.rotation.y = Math.sin(t * 11) * 0.55;

    // kamera: çok hafif sallanma
    camera.position.set(1.1 + Math.sin(t * 0.35) * 0.04, 1.25 + Math.sin(t * 0.5) * 0.025, 3.5);
    camera.lookAt(-3.5 + Math.sin(t * 0.2) * 0.6, 5 + Math.sin(t * 0.27) * 0.4, -22);

    renderer.render(scene, camera);
  }
  updateWeather(0);
  wLevel = weather === "clear" ? 0 : 1;
  stormLevel = weather === "storm" ? 1 : 0;
  animate();

  // ---------- Resize ----------
  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 75 : 62;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  onResize();

  // ---------- Müzik ----------
  var bgm = document.getElementById("bgm");
  var hint = document.getElementById("hint");
  var started = false;
  if (bgm) bgm.volume = 0.15;
  var evs = ["click", "touchstart", "touchend", "pointerdown", "keydown"];

  function onStarted() {
    started = true;
    hint.classList.add("hidden");
    evs.forEach(function (e) { window.removeEventListener(e, tryPlay); });
  }
  function tryPlay() {
    if (started || !bgm) return;
    var pr = bgm.play();
    if (pr && pr.then) {
      pr.then(onStarted).catch(function () {});
    } else {
      onStarted();
    }
  }
  evs.forEach(function (e) { window.addEventListener(e, tryPlay, { passive: true }); });
  tryPlay();

  // Sekme arka plana gittiğinde müzik ve efektler durur; geri dönünce devam eder.
  function silence() {
    try { if (bgm) bgm.pause(); } catch (e) {}
    if (actx && actx.state === "running") actx.suspend();
  }
  function unsilence() {
    if (started && bgm) {
      var pr = bgm.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
    if (actx && actx.state === "suspended") actx.resume();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) silence(); else unsilence();
  });
  window.addEventListener("pagehide", silence);
})();
</script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};
