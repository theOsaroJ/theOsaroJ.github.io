import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a0c0e, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0c0e, 0.045);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0.2, 1.4, 8.2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 4.5;
controls.maxDistance = 14;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.target.set(0, 0.2, 0);

const root = new THREE.Group();
scene.add(root);

/** Build a porous-framework lattice (MOF-inspired) */
function buildLattice() {
  const group = new THREE.Group();
  const nodes = [];
  const nx = 5;
  const ny = 4;
  const nz = 5;
  const spacing = 1.15;
  const ox = (-(nx - 1) * spacing) / 2;
  const oy = (-(ny - 1) * spacing) / 2 + 0.15;
  const oz = (-(nz - 1) * spacing) / 2;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        // Carve a porous cavity — MOF-like openness
        const cx = ix - (nx - 1) / 2;
        const cy = iy - (ny - 1) / 2;
        const cz = iz - (nz - 1) / 2;
        const r = Math.sqrt(cx * cx + cy * cy * 0.7 + cz * cz);
        if (r < 1.15 && iy > 0 && iy < ny - 1) continue;

        const jitter = 0.08;
        const p = new THREE.Vector3(
          ox + ix * spacing + (Math.random() - 0.5) * jitter,
          oy + iy * spacing + (Math.random() - 0.5) * jitter,
          oz + iz * spacing + (Math.random() - 0.5) * jitter
        );
        nodes.push({ p, ix, iy, iz, key: `${ix},${iy},${iz}` });
      }
    }
  }

  const keySet = new Set(nodes.map((n) => n.key));
  const positions = [];
  const colors = [];
  const copper = new THREE.Color(0xd4894a);
  const steel = new THREE.Color(0x8fb4c0);
  const bone = new THREE.Color(0xcfc8bb);

  for (const n of nodes) {
    const t = (n.iy / (ny - 1)) * 0.65 + Math.random() * 0.35;
    const c = bone.clone().lerp(copper, t * 0.55).lerp(steel, (1 - t) * 0.25);
    positions.push(n.p.x, n.p.y, n.p.z);
    colors.push(c.r, c.g, c.b);
  }

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  nodeGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const nodesMat = new THREE.PointsMaterial({
    size: 0.085,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(nodeGeo, nodesMat);
  group.add(points);

  // Bonds along lattice neighbors
  const bondPos = [];
  const bondCol = [];
  const dirs = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const nodeMap = new Map(nodes.map((n) => [n.key, n]));

  for (const n of nodes) {
    for (const [dx, dy, dz] of dirs) {
      const k = `${n.ix + dx},${n.iy + dy},${n.iz + dz}`;
      if (!keySet.has(k)) continue;
      const m = nodeMap.get(k);
      bondPos.push(n.p.x, n.p.y, n.p.z, m.p.x, m.p.y, m.p.z);
      const c1 = steel.clone().multiplyScalar(0.55);
      const c2 = copper.clone().multiplyScalar(0.35);
      bondCol.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
    }
  }

  const bondGeo = new THREE.BufferGeometry();
  bondGeo.setAttribute("position", new THREE.Float32BufferAttribute(bondPos, 3));
  bondGeo.setAttribute("color", new THREE.Float32BufferAttribute(bondCol, 3));
  const bonds = new THREE.LineSegments(
    bondGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
    })
  );
  group.add(bonds);

  // Floating “probe” particles — active-learning / adsorbate metaphor
  const probeCount = 48;
  const probePos = new Float32Array(probeCount * 3);
  const probeVel = [];
  for (let i = 0; i < probeCount; i++) {
    probePos[i * 3] = (Math.random() - 0.5) * 3.2;
    probePos[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
    probePos[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
    probeVel.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01
      )
    );
  }
  const probeGeo = new THREE.BufferGeometry();
  probeGeo.setAttribute("position", new THREE.BufferAttribute(probePos, 3));
  const probes = new THREE.Points(
    probeGeo,
    new THREE.PointsMaterial({
      color: 0x8fb4c0,
      size: 0.055,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  group.add(probes);

  // Soft orbital ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.008, 16, 180),
    new THREE.MeshBasicMaterial({
      color: 0xd4894a,
      transparent: true,
      opacity: 0.22,
    })
  );
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  const ring2 = ring.clone();
  ring2.rotation.x = Math.PI / 1.7;
  ring2.rotation.z = 0.6;
  ring2.material = ring.material.clone();
  ring2.material.color.set(0x8fb4c0);
  ring2.material.opacity = 0.14;
  group.add(ring2);

  return { group, probes, probeVel, probePos, ring, ring2, points };
}

const lattice = buildLattice();
root.add(lattice.group);

// Ambient glow plane behind content for depth
const glow = new THREE.Mesh(
  new THREE.SphereGeometry(12, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0x1a1510,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.9,
  })
);
scene.add(glow);

const clock = new THREE.Clock();
let pulse = 0;

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", onResize);

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  pulse += 0.016;

  root.rotation.y = Math.sin(t * 0.08) * 0.08;
  lattice.ring.rotation.z = t * 0.12;
  lattice.ring2.rotation.y = -t * 0.08;

  // Drift probes inside the cavity
  const pos = lattice.probePos;
  for (let i = 0; i < lattice.probeVel.length; i++) {
    const v = lattice.probeVel[i];
    pos[i * 3] += v.x;
    pos[i * 3 + 1] += v.y;
    pos[i * 3 + 2] += v.z;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(pos[i * 3 + a]) > 1.8) v.setComponent(a, -v.getComponent(a));
    }
    // Soft attraction toward origin (adsorption metaphor)
    v.x += -pos[i * 3] * 0.00015;
    v.y += -pos[i * 3 + 1] * 0.00015;
    v.z += -pos[i * 3 + 2] * 0.00015;
  }
  lattice.probes.geometry.attributes.position.needsUpdate = true;

  // Subtle size pulse on framework nodes
  lattice.points.material.size = 0.08 + Math.sin(pulse * 1.4) * 0.012;

  controls.update();
  renderer.render(scene, camera);
}

animate();
