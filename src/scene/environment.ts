import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep, clamp01 } from './choreography';

export interface EnvironmentRig {
  group: THREE.Group;
  anchors: Map<string, THREE.Object3D>;
  update: (progress: number, time: number, camera: THREE.Camera, orbit: boolean, reducedMotion: boolean, pixelRatio: number) => void;
  dispose: () => void;
}

function randomSource(seed = 1717): () => number {
  let state = seed;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

/** Extrude a mitered, typographic stroke without downloading a font or a model. */
function strokeGeometry(points: readonly (readonly [number, number])[], width: number): THREE.ExtrudeGeometry {
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  points.forEach((point, i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector2(after[0] - before[0], after[1] - before[1]).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x).multiplyScalar(width / 2);
    left.push(new THREE.Vector2(point[0], point[1]).add(normal));
    right.push(new THREE.Vector2(point[0], point[1]).sub(normal));
  });
  const polygon = [...left, ...right.reverse()];
  const shape = new THREE.Shape(polygon);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.022, bevelThickness: 0.022, steps: 1 });
  geometry.translate(0, 0, -0.07);
  return geometry;
}

function glyphAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The code glyph canvas could not be initialized.');
  context.fillStyle = '#e8f3df';
  context.font = '500 36px "JetBrains Mono", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  ['0x7F', 'AI', '</>', '{ }', '01', 'π', 'λ', '0xA4', '∇', '∞', '++', '0xFF', '[ ]', '::', '10', '0xE8'].forEach((glyph, i) => {
    context.fillText(glyph, (i % 8) * 128 + 64, Math.floor(i / 8) * 128 + 64, 115);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function kernelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The kernel typography canvas could not be initialized.');
  context.fillStyle = '#101817';
  context.fillRect(0, 0, 1024, 512);
  context.strokeStyle = '#34402d';
  context.lineWidth = 2;
  context.strokeRect(26, 26, 972, 460);
  context.fillStyle = '#d3ff65';
  context.fillRect(52, 55, 13, 13);
  context.font = '400 20px "JetBrains Mono", monospace';
  context.fillText('PERSONAL KERNEL // v2026', 82, 73);
  context.font = '650 172px "Space Grotesk Variable", sans-serif';
  context.fillStyle = '#f1f0e7';
  context.fillText('pplo.', 45, 278);
  context.font = '500 28px "JetBrains Mono", monospace';
  context.fillText('YOUSSEF ELSAID', 55, 351);
  context.fillStyle = '#9cae8f';
  context.font = '400 17px "JetBrains Mono", monospace';
  context.fillText('SOFTWARE ENGINEER & AI ARCHITECT', 55, 395);
  context.font = '400 15px "JetBrains Mono", monospace';
  context.fillText('31.2001° N  /  29.9187° E', 55, 452);
  for (let i = 0; i < 34; i += 1) {
    context.fillStyle = i % 3 === 0 ? '#d3ff65' : '#5e6a50';
    context.fillRect(722 + i * 6.3, 437, i % 3 === 0 ? 3 : 1.5, 25);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createEnvironment(): EnvironmentRig {
  const group = new THREE.Group();
  group.name = 'the codic void / procedural atmosphere';
  const anchors = new Map<string, THREE.Object3D>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances: THREE.InstancedMesh[] = [];
  const random = randomSource();
  const geo = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const mat = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };

  const constellation = new THREE.Group();
  constellation.name = '01 / code becoming matter';
  group.add(constellation);
  const nickel = mat(new THREE.MeshStandardMaterial({ color: '#88958c', metalness: 0.92, roughness: 0.24 }));
  const dark = mat(new THREE.MeshStandardMaterial({ color: '#172420', metalness: 0.8, roughness: 0.28 }));
  const lime = mat(new THREE.MeshStandardMaterial({ color: '#d3ff65', emissive: '#a4e344', emissiveIntensity: 0.5, metalness: 0.55, roughness: 0.25 }));
  const edgeMaterial = mat(new THREE.LineBasicMaterial({ color: '#b2d77a', transparent: true, opacity: 0.62 }));
  const quietEdges = mat(new THREE.LineBasicMaterial({ color: '#677e6d', transparent: true, opacity: 0.48 }));

  const nucleus = new THREE.Group();
  nucleus.name = 'PPLO / the first instruction';
  nucleus.rotation.set(0.1, 0.25, -0.14);
  constellation.add(nucleus);
  const coreGeometry = geo(new THREE.IcosahedronGeometry(1.03, 0));
  nucleus.add(new THREE.LineSegments(geo(new THREE.EdgesGeometry(coreGeometry)), edgeMaterial));
  const cubeGeometry = geo(new THREE.BoxGeometry(1.28, 1.28, 1.28));
  const kernel = new THREE.Mesh(cubeGeometry, dark);
  kernel.rotation.set(0.04, -0.14, 0.07);
  nucleus.add(kernel);
  const labelMap = kernelTexture();
  textures.add(labelMap);
  const face = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.20, 0.60)), mat(new THREE.MeshStandardMaterial({ map: labelMap, roughness: 0.43, metalness: 0.35, emissiveMap: labelMap, emissive: '#ffffff', emissiveIntensity: 0.20 })));
  face.position.set(0, 0.04, 0.651);
  kernel.add(face);
  const cornerGeometry = geo(new THREE.BoxGeometry(0.13, 0.13, 0.13));
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const corner = new THREE.Mesh(cornerGeometry, lime);
    corner.position.set(x * 0.66, y * 0.66, z * 0.66);
    kernel.add(corner);
  }

  const rings: THREE.Group[] = [];
  for (let index = 0; index < 3; index += 1) {
    const orbit = new THREE.Group();
    orbit.rotation.set(0.4 + index * 0.62, index * 0.7, 0.1 + index * 0.6);
    const ringGeometry = geo(new THREE.TorusGeometry(1.78 + index * 0.29, index === 1 ? 0.019 : 0.010, 5, 128));
    orbit.add(new THREE.Mesh(ringGeometry, index === 1 ? nickel : lime));
    const arc = new THREE.Mesh(geo(new THREE.TorusGeometry(1.78 + index * 0.29, 0.025, 5, 30, Math.PI * 0.16)), lime);
    orbit.add(arc);
    const satellites = new THREE.Group();
    satellites.rotation.z = index * 2.1;
    const marker = new THREE.Mesh(geo(new THREE.BoxGeometry(0.13, 0.10, 0.10)), nickel);
    marker.position.x = 1.78 + index * 0.29;
    satellites.add(marker);
    orbit.add(satellites);
    constellation.add(orbit);
    rings.push(orbit);
  }

  const bracePoints: readonly (readonly [number, number])[] = [[0.30, 0.80], [0.08, 0.80], [-0.06, 0.63], [-0.06, 0.20], [-0.23, 0], [-0.06, -0.20], [-0.06, -0.63], [0.08, -0.80], [0.30, -0.80]];
  const brace = new THREE.Mesh(geo(strokeGeometry(bracePoints, 0.12)), nickel);
  brace.position.set(-2.70, 0.45, 0.7);
  brace.rotation.set(-0.2, 0.4, -0.18);
  constellation.add(brace);
  const closingBrace = new THREE.Mesh(brace.geometry, lime);
  closingBrace.position.set(2.85, -0.45, -0.6);
  closingBrace.rotation.set(0.1, -0.4, 0.10);
  closingBrace.scale.x = -1;
  constellation.add(closingBrace);
  const angle = new THREE.Mesh(geo(strokeGeometry([[0.4, 0.5], [-0.15, 0], [0.4, -0.5]], 0.12)), dark);
  angle.position.set(0.85, 2.6, -0.5);
  angle.rotation.set(0.3, -0.1, -0.45);
  constellation.add(angle);

  const satellites: { mesh: THREE.Group; home: THREE.Vector3; seed: number }[] = [];
  for (let i = 0; i < 8; i += 1) {
    const satellite = new THREE.Group();
    const geometry = geo(i % 2 === 0 ? new THREE.IcosahedronGeometry(0.22 + random() * 0.17, 0) : new THREE.BoxGeometry(0.30, 0.30, 0.30));
    const body = new THREE.Mesh(geometry, dark);
    const edges = new THREE.LineSegments(geo(new THREE.EdgesGeometry(geometry)), i % 3 === 0 ? edgeMaterial : quietEdges);
    satellite.add(body, edges);
    const a = (i / 8) * Math.PI * 2;
    const home = new THREE.Vector3(Math.cos(a) * (2.5 + random()), (random() - 0.5) * 4.0, Math.sin(a) * (2.3 + random()));
    satellite.position.copy(home);
    constellation.add(satellite);
    satellites.push({ mesh: satellite, home, seed: random() * 6 });
  }
  for (const [name, parent, position] of [
    ['construct-core', nucleus, [0, 0.82, 0]],
    ['construct-orbit', rings[0], [1.8, 0, 0]],
    ['construct-bracket', brace, [0, 0, 0]],
  ] as const) {
    const anchor = new THREE.Object3D();
    anchor.position.set(position[0], position[1], position[2]);
    parent.add(anchor);
    anchors.set(name, anchor);
  }

  // A depth-aware schematic floor. Derivatives keep hairlines stable while the camera moves.
  const gridMaterial = mat(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      varying vec3 vWorld;
      float grid(vec2 p){ vec2 d=abs(fract(p-0.5)-0.5)/max(fwidth(p),vec2(0.0001)); return 1.0-min(min(d.x,d.y),1.0); }
      void main(){
        float fine=grid(vWorld.xz*0.5); float major=grid(vWorld.xz*0.1);
        float fade=exp(-length(vWorld.xz)*0.055);
        float alpha=(fine*0.045+major*0.038)*fade;
        gl_FragColor=vec4(vec3(0.52,0.64,0.53),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const grid = new THREE.Mesh(geo(new THREE.PlaneGeometry(160, 160)), gridMaterial);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -1.65;
  group.add(grid);
  const surveyRing = new THREE.LineLoop(geo(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * 6.3, -1.62, Math.sin(i / 128 * Math.PI * 2) * 6.3)))), mat(new THREE.LineBasicMaterial({ color: '#6e8068', transparent: true, opacity: 0.14 })));
  group.add(surveyRing);

  const particleCount = 480;
  const positions = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    positions.set([(random() - 0.5) * 42, (random() - 0.35) * 19, (random() - 0.5) * 38], i * 3);
    seeds[i] = random();
  }
  const dustGeometry = geo(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const dustMaterial = mat(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uPixelRatio; attribute float aSeed; varying float vSeed;
      void main(){ vSeed=aSeed; vec3 p=position; p.y+=mod(uTime*(0.025+aSeed*0.04)+aSeed*6.0,6.0)-3.0; p.x+=sin(uTime*0.1+aSeed*20.0)*0.18;
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=clamp((24.0+aSeed*10.0)/-mv.z,0.8,3.2)*uPixelRatio; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      varying float vSeed;
      void main(){ vec2 p=gl_PointCoord-0.5; float r=length(p); float petal=0.28+0.12*cos(atan(p.y,p.x)*5.0); float shape=vSeed>0.86 ? 1.0-smoothstep(petal-0.08,petal,r) : exp(-r*r*20.0);
        vec3 c=mix(vec3(0.59,0.67,0.56),vec3(0.75,0.91,0.42),step(0.78,vSeed)); gl_FragColor=vec4(c,shape*(0.10+vSeed*0.20)); }`,
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  group.add(dust);

  const glyphTexture = glyphAtlas();
  textures.add(glyphTexture);
  const glyphGeometry = geo(new THREE.PlaneGeometry(0.46, 0.46));
  const glyphIndices = new Float32Array(36);
  const glyphSeeds = new Float32Array(36);
  const glyphMaterial = mat(new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: glyphTexture }, uTime: { value: 0 }, uOpacity: { value: 0.35 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime; attribute float aGlyph; attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main(){ vUv=(uv+vec2(mod(aGlyph,8.0),1.0-floor(aGlyph/8.0)))/vec2(8.0,2.0); vSeed=aSeed;
        vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0); center.y+=sin(uTime*0.15+aSeed*8.0)*0.22; center.xy+=position.xy; gl_Position=projectionMatrix*center; }`,
    fragmentShader: `uniform sampler2D uAtlas; uniform float uOpacity; varying vec2 vUv; varying float vSeed; void main(){vec4 glyph=texture2D(uAtlas,vUv); gl_FragColor=vec4(mix(vec3(0.7,0.78,0.64),vec3(0.57,0.88,0.42),vSeed),glyph.a*uOpacity);}`,
  }));
  const glyphs = new THREE.InstancedMesh(glyphGeometry, glyphMaterial, 36);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 36; i += 1) {
    glyphIndices[i] = Math.floor(random() * 16);
    glyphSeeds[i] = random();
    matrix.makeTranslation((random() - 0.5) * 19, random() * 10 - 2, (random() - 0.5) * 17);
    glyphs.setMatrixAt(i, matrix);
  }
  glyphGeometry.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(glyphIndices, 1));
  glyphGeometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(glyphSeeds, 1));
  glyphs.instanceMatrix.needsUpdate = true;
  glyphs.frustumCulled = false;
  instances.push(glyphs);
  group.add(glyphs);

  const sporeGeometry = geo(new THREE.BufferGeometry());
  const sporePositions = new Float32Array(90 * 3);
  const sporeSeeds = new Float32Array(90);
  const storageOrigins = [[-2.3, 2.8], [0.5, 2.8], [3, 2.1]];
  for (let i = 0; i < 90; i += 1) {
    const origin = storageOrigins[i % storageOrigins.length];
    sporePositions.set([origin[0] + (random() - 0.5) * 1.25, 0.20, origin[1] + (random() - 0.5) * 0.45], i * 3);
    sporeSeeds[i] = random();
  }
  sporeGeometry.setAttribute('position', new THREE.BufferAttribute(sporePositions, 3));
  sporeGeometry.setAttribute('aSeed', new THREE.BufferAttribute(sporeSeeds, 1));
  const sporeMaterial = mat(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uPixelRatio; attribute float aSeed; varying float vLife; varying float vSeed;
      void main(){ float life=fract(aSeed+uTime*(0.08+aSeed*0.04)); vLife=life; vSeed=aSeed; vec3 p=position;
        p.y+=life*2.2; p.x+=sin(life*6.0+aSeed*18.0)*0.10; p.z+=cos(life*8.0+aSeed*9.0)*0.08;
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=clamp(30.0/-mv.z,1.2,3.2)*uPixelRatio; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      uniform float uReveal; varying float vLife; varying float vSeed;
      void main(){vec2 p=gl_PointCoord-0.5;float petal=0.30+0.12*cos(atan(p.y,p.x)*5.0);float mask=1.0-smoothstep(petal-0.09,petal,length(p));
        vec3 tint=mix(vec3(0.25,0.9,0.92),vec3(0.82,1.0,0.40),vSeed);gl_FragColor=vec4(tint,mask*(1.0-vLife)*0.55*uReveal);}`,
  }));
  const spores = new THREE.Points(sporeGeometry, sporeMaterial);
  spores.name = 'NVMe / rising digital blossoms';
  spores.frustumCulled = false;
  group.add(spores);

  // Soft procedural haze is intentionally low contrast; the hardware keeps its silhouette.
  const hazeMaterial = mat(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vUv-0.5;float n=noise(vUv*4.0+uTime*0.015)*0.65+noise(vUv*9.0-uTime*0.01)*0.35;float falloff=exp(-dot(p*vec2(1.1,1.6),p*vec2(1.1,1.6))*7.5);gl_FragColor=vec4(0.31,0.43,0.30,falloff*n*0.11);}`,
  }));
  const haze = new THREE.Mesh(geo(new THREE.PlaneGeometry(24, 20)), hazeMaterial);
  haze.position.set(0, 1.5, -6.5);
  group.add(haze);

  const shockGeometry = geo(new THREE.PlaneGeometry(6, 6));
  const shockDefinitions = [
    { at: 0.397, end: 0.454, x: -1, z: -1, color: '#cdbb6e' },
    { at: 0.554, end: 0.614, x: -0.7, z: 1.45, color: '#69d6db' },
    ...[1.65, 2.15, 2.65, 3.15].map((x, i) => ({ at: 0.667 + i * 0.035, end: 0.701 + i * 0.035, x, z: -0.9, color: '#d3ff65' })),
  ];
  const shocks = shockDefinitions.map((definition) => {
    const material = mat(new THREE.ShaderMaterial({
      uniforms: { uPhase: { value: 0 }, uColor: { value: new THREE.Color(definition.color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform float uPhase;uniform vec3 uColor;varying vec2 vUv;void main(){float d=length(vUv-0.5);float radius=0.04+uPhase*0.45;float ring=exp(-pow((d-radius)*95.0,2.0));gl_FragColor=vec4(uColor,ring*sin(uPhase*3.14159265)*0.50);}`,
    }));
    const mesh = new THREE.Mesh(shockGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(definition.x, 0.09, definition.z);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, material, definition };
  });

  // Four batches of survey tick marks are merged into a single geometry.
  const ticks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 72; i += 1) {
    const a = i / 72 * Math.PI * 2;
    const length = i % 6 === 0 ? 0.17 : 0.07;
    const tick = new THREE.BoxGeometry(length, 0.008, 0.008);
    tick.rotateY(-a);
    tick.translate(Math.cos(a) * 6.3, -1.60, Math.sin(a) * 6.3);
    ticks.push(tick);
  }
  const tickGeometry = mergeGeometries(ticks);
  ticks.forEach((geometry) => geometry.dispose());
  if (tickGeometry) group.add(new THREE.Mesh(geo(tickGeometry), mat(new THREE.MeshBasicMaterial({ color: '#607259', transparent: true, opacity: 0.22 }))));

  let disposed = false;
  return {
    group,
    anchors,
    update(progress, time, camera, orbit, reducedMotion, pixelRatio) {
      if (disposed) return;
      const clock = reducedMotion ? 0 : time;
      const intro = orbit ? 0 : 1 - smoothstep(0.085, 0.17, progress);
      constellation.visible = intro > 0.001;
      constellation.position.set(0, 0.35 + intro * 2.5, 0);
      constellation.scale.setScalar(Math.max(0.001, 0.15 + intro * 0.85));
      nucleus.rotation.y = 0.25 + clock * 0.10;
      nucleus.rotation.x = 0.1 + Math.sin(clock * 0.22) * 0.06;
      rings.forEach((ring, index) => { ring.rotation.y = index * 0.7 + clock * (0.08 + index * 0.025); ring.rotation.z = 0.1 + index * 0.6 + clock * 0.035 * (index % 2 === 0 ? 1 : -1); });
      satellites.forEach(({ mesh, home, seed }) => {
        mesh.position.copy(home);
        mesh.position.y += Math.sin(clock * 0.35 + seed) * 0.13;
        mesh.rotation.set(clock * 0.12 + seed, clock * 0.16, seed * 0.1);
      });
      glyphMaterial.uniforms.uTime.value = clock;
      glyphMaterial.uniforms.uOpacity.value = 0.09 + intro * 0.30 + smoothstep(0.8, 0.92, progress) * 0.09;
      dustMaterial.uniforms.uTime.value = clock;
      dustMaterial.uniforms.uPixelRatio.value = pixelRatio;
      spores.visible = orbit || progress > 0.805;
      sporeMaterial.uniforms.uTime.value = clock;
      sporeMaterial.uniforms.uReveal.value = orbit ? 1 : smoothstep(0.805, 0.90, progress);
      sporeMaterial.uniforms.uPixelRatio.value = pixelRatio;
      hazeMaterial.uniforms.uTime.value = clock;
      haze.quaternion.copy(camera.quaternion);
      for (const shock of shocks) {
        const phase = clamp01((progress - shock.definition.at) / (shock.definition.end - shock.definition.at));
        shock.mesh.visible = !orbit && !reducedMotion && phase > 0 && phase < 1;
        shock.material.uniforms.uPhase.value = phase;
      }
      group.updateMatrixWorld(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      instances.forEach((instance) => instance.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => { texture.dispose(); const canvas = texture.image as HTMLCanvasElement; canvas.width = canvas.height = 1; });
      anchors.clear();
    },
  };
}
