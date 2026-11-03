/**
 * 3D showroom. Venue, lighting presets, offline image-based lighting and the
 * studio gallery are adapted from jiaxiantao/3d-car-viewing (MIT); the white
 * round exhibition gallery model is by ChristyHsu on Sketchfab (CC-BY-4.0).
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, ContactShadows, MeshReflectorMaterial, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CarModel } from '@shared/catalog';
import { Car3D, badgeAnchor, type Car3DProps } from './Car3D';
import type { SeatState } from '../components/CarView';
import { buildCar } from './carBuilder';

export type CameraPreset = 'front' | 'side' | 'rear' | 'top';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** Lighting values from the 3d-car-viewing studio presets. */
const LIGHT = {
  day: { background: '#dbe7f5', env: 1.1, ambient: 0.9, dir: 2.6, dirColor: '#fff8ec', hemi: [0.55, '#bfe2ff', '#94a3b8'] as const, fill: 0.38, rim: 0.32, fog: ['#d5e2f0', 34, 78] as const, floor: '#e7ebf1' },
  night: { background: '#02050d', env: 0.3, ambient: 0.2, dir: 0.55, dirColor: '#a8b6d4', hemi: [0.18, '#1e293b', '#020617'] as const, fill: 0.55, rim: 0.62, fog: ['#020413', 26, 70] as const, floor: '#1a2335' },
};

function OfflineEnvironment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    return () => { scene.environment = null; rt.dispose(); room.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  useLayoutEffect(() => { scene.environmentIntensity = intensity; }, [intensity, scene]);
  return null;
}

let galleryPromise: Promise<THREE.Object3D> | null = null;
function loadGallery() {
  galleryPromise ??= new GLTFLoader().loadAsync(asset('models/scene/white_round_exhibition_gallery.glb')).then((gltf) => {
    const root = gltf.scene;
    root.scale.setScalar(0.55);
    root.updateMatrixWorld(true);
    // Find the wide thin floor slab, drop the room so it meets y = 0, and hide it (a reflector replaces it).
    const box = new THREE.Box3(), size = new THREE.Vector3(), c = new THREE.Vector3();
    let floor: THREE.Mesh | null = null;
    let floorTop = Infinity;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.receiveShadow = true;
      box.setFromObject(m).getSize(size);
      box.getCenter(c);
      if (size.y < 0.25 && size.x > 8 && size.z > 8 && Math.hypot(c.x, c.z) < 2 && box.max.y < floorTop) {
        floorTop = box.max.y;
        floor = m;
      }
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const std = mat as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial) continue;
        const e = std.emissive;
        if (e.r + e.g + e.b > 2.5) { std.emissiveIntensity = 0.42; std.color.set('#f7f8fa'); }
        else { std.color.set('#d5dbe4'); std.roughness = Math.max(std.roughness, 0.68); }
        std.side = THREE.DoubleSide;
      }
    });
    if (Number.isFinite(floorTop)) root.position.y -= floorTop;
    // Hide the dome/ceiling so top-down views always see into the room.
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && new THREE.Box3().setFromObject(m).min.y > 3.2) m.visible = false;
    });
    if (floor) (floor as THREE.Mesh).visible = false;
    return root;
  });
  return galleryPromise;
}

function Studio({ night }: { night: boolean }) {
  const [room, setRoom] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    loadGallery().then((r) => live && setRoom(r)).catch(() => {});
    return () => { live = false; };
  }, []);
  const L = night ? LIGHT.night : LIGHT.day;
  return (
    <>
      {room && <primitive object={room} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <circleGeometry args={[11.5, 64]} />
        <MeshReflectorMaterial
          blur={[280, 90]} resolution={512} mixBlur={0.65} mixStrength={night ? 1.6 : 1.15} roughness={night ? 0.3 : 0.38}
          depthScale={1.05} minDepthThreshold={0.25} maxDepthThreshold={1.35} color={L.floor} metalness={night ? 0.6 : 0.22} mirror={night ? 0.4 : 0.48}
        />
      </mesh>
      <ContactShadows position={[0, 0.02, 0]} opacity={night ? 0.7 : 0.45} blur={2.4} scale={12} far={4} />
    </>
  );
}

/** Animated camera moves between presets; free orbit afterwards. */
function CameraRig({ preset, size, controls }: { preset: CameraPreset; size: { L: number; H: number }; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, size: view } = useThree();
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  const aspect = view.width / Math.max(1, view.height);
  const portrait = aspect < 0.9;
  useEffect(() => {
    // Pull back on narrow screens so the whole car fits.
    // Portrait phones get a wider lens rather than a camera that climbs out of the room.
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = portrait ? 54 : 34;
    cam.updateProjectionMatrix();
    const d = Math.max(4.6, size.L * 1.15) * (portrait ? 1.05 : Math.max(1, 1.45 / aspect) ** 0.6);
    const look = new THREE.Vector3(0, size.H * 0.42, 0);
    const pos = {
      front: new THREE.Vector3(d * 0.78, size.H * 1.05, d * 0.72),
      side: new THREE.Vector3(0.2, size.H * 0.85, d * 1.05),
      rear: new THREE.Vector3(-d * 0.8, size.H * 1.1, d * 0.68),
      // Portrait phones: look down from behind so the nose points up, like the 2D seat map.
      top: portrait ? new THREE.Vector3(-size.L * 0.3, 5.2, 0.001) : new THREE.Vector3(0, d * 1.02, d * 0.42),
    }[preset];
    goal.current = { pos, look: preset === 'top' ? new THREE.Vector3(portrait ? 0.1 : 0, 0.45, portrait ? 0 : 0.15) : look };
  }, [preset, size.L, size.H, aspect, portrait, camera]);
  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    camera.position.lerp(g.pos, 1 - Math.exp(-dt * 3.2));
    c.target.lerp(g.look, 1 - Math.exp(-dt * 3.2));
    c.update();
    if (camera.position.distanceTo(g.pos) < 0.02) goal.current = null;
  });
  // Any user drag cancels the move.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => { goal.current = null; };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);
  return null;
}

/** A real 3D model dropped in at public/models/cars/<id>.glb replaces the built body. */
function useDropInModel(model: CarModel) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    setObj(null);
    const url = asset(`models/cars/${model.id}.glb`);
    fetch(url)
      .then(async (r) => {
        const buf = await r.arrayBuffer();
        // Dev servers answer unknown paths with index.html — only accept real glTF binaries.
        if (!r.ok || new TextDecoder().decode(buf.slice(0, 4)) !== 'glTF') return;
        const gltf = await new GLTFLoader().parseAsync(buf, '');
        if (!live) return;
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        if (size.z > size.x) root.rotation.y = Math.PI / 2; // align length with X
        root.updateMatrixWorld(true);
        const b2 = new THREE.Box3().setFromObject(root);
        const s2 = b2.getSize(new THREE.Vector3());
        const k = model.lengthMm / 1000 / s2.x;
        const wrap = new THREE.Group();
        wrap.add(root);
        wrap.scale.setScalar(k);
        const c = b2.getCenter(new THREE.Vector3());
        root.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
        root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        setObj(wrap);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [model]);
  return obj;
}

export interface Scene3DProps extends Omit<Car3DProps, 'cabin' | 'night' | 'hideBody'> {
  cabin: boolean;
  night: boolean;
  preset: CameraPreset;
  autoRotate?: boolean;
}

const BADGE_BG = { M: '#2f7cf6', F: '#ec4899' } as const;

/**
 * Seat badges are plain page elements on a layer above the canvas, moved every
 * frame to follow their seat. (drei's <Html> portals crash React when the
 * canvas is remounted, so we don't use them.)
 */
function BadgeProjector({ anchors, els }: { anchors: Map<string, THREE.Vector3>; els: React.RefObject<Map<string, HTMLElement>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const [id, el] of els.current ?? []) {
      const a = anchors.get(id);
      if (!a) continue;
      v.copy(a).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.opacity = visible ? '1' : '0';
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
    }
  });
  return null;
}

function SeatBadges({ seats, ids, onSeatClick, els }: {
  seats: Record<string, SeatState>; ids: string[]; onSeatClick?: (id: string) => void; els: React.RefObject<Map<string, HTMLElement>>;
}) {
  return (
    <div className="scene3d__badges">
      {ids.map((id) => {
        const st = seats[id];
        const status = st?.status ?? 'empty';
        if (status === 'empty' || status === 'unavailable') return null;
        const g = st?.gender;
        const occupied = g && (status === 'booked' || status === 'mine' || status === 'driver');
        const clickable = !!onSeatClick && status !== 'driver' && status !== 'booked';
        return (
          <button
            key={id}
            ref={(el) => { if (el) els.current!.set(id, el); else els.current!.delete(id); }}
            className={`seat3d-badge seat3d-badge--${status}`}
            style={{ background: occupied ? BADGE_BG[g!] : status === 'selected' ? '#f59e0b' : '#22c55e', pointerEvents: clickable ? 'auto' : 'none', opacity: 0 }}
            onClick={clickable ? () => onSeatClick!(id) : undefined}
            aria-label={`Seat ${id}`}
          >
            <span>{occupied ? (g === 'M' ? '♂' : '♀') : status === 'selected' ? '✓' : '+'}</span>
            {status === 'driver' && <em>Driver</em>}
            {status === 'mine' && <em>You</em>}
          </button>
        );
      })}
    </div>
  );
}

export default function Scene3D(props: Scene3DProps) {
  const { model, preset, night, autoRotate } = props;
  const L = night ? LIGHT.night : LIGHT.day;
  const { size, anchors } = useMemo(() => {
    const b = buildCar(model);
    return { size: { L: b.L, H: b.H }, anchors: new Map(b.seats.map((st) => [st.id, new THREE.Vector3(...badgeAnchor(st))])) };
  }, [model]);
  const badgeEls = useRef(new Map<string, HTMLElement>());
  const controls = useRef<OrbitControlsImpl | null>(null);
  const dropIn = useDropInModel(model);
  const showBadges = props.cabin || !!dropIn;
  return (
    <div className="scene3d">
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [5, 2, 5], fov: 34, near: 0.1, far: 120 }} gl={{ antialias: true }}>
      <AdaptiveDpr pixelated={false} />
      <color attach="background" args={[L.background]} />
      <fog attach="fog" args={L.fog} />
      <OfflineEnvironment intensity={L.env} />
      <hemisphereLight args={[L.hemi[1], L.hemi[2], L.hemi[0]]} />
      <ambientLight intensity={L.ambient} />
      <directionalLight position={[5, 8, 3]} intensity={L.dir} color={L.dirColor} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />
      <directionalLight position={[-3, 4, -2]} intensity={L.rim} color="#94a3b8" />
      <pointLight position={[-4, 2, -3]} intensity={L.fill} color="#93c5fd" />
      <Suspense fallback={null}>
        <Studio night={night} />
      </Suspense>
      <Car3D {...props} hideBody={!!dropIn} />
      {dropIn && <primitive object={dropIn} />}
      <CameraRig preset={preset} size={size} controls={controls} />
      <BadgeProjector anchors={anchors} els={badgeEls} />
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.2} maxDistance={14}
        maxPolarAngle={1.52} autoRotate={autoRotate} autoRotateSpeed={0.6} />
    </Canvas>
    {showBadges && <SeatBadges seats={props.seats} ids={[...anchors.keys()]} onSeatClick={props.onSeatClick} els={badgeEls} />}
    </div>
  );
}
