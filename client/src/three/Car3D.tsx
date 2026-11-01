import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { DRIVER_SEAT, type CarModel, type Interior, type Paint } from '@shared/catalog';
import type { Gender } from '@shared/types';
import type { SeatState } from '../components/CarView';
import { buildCar, type CarBuild, type Seat3D } from './carBuilder';

export interface Car3DProps {
  model: CarModel;
  paint: Paint;
  interior: Interior;
  plate?: string;
  seats: Record<string, SeatState>;
  cabin: boolean;
  night: boolean;
  openDoorFor?: string | null;
  hideBody?: boolean;
  onSeatClick?: (id: string) => void;
  onSeatHover?: (id: string | null) => void;
}

const SHIRT: Record<Gender, string> = { M: '#2563eb', F: '#db2777' };
const BADGE: Record<Gender, string> = { M: '#2f7cf6', F: '#ec4899' };

function paintMaterial(hex: string, finish: Paint['finish']) {
  const matte = finish === 'matte';
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: finish === 'metallic' ? 0.6 : finish === 'pearl' ? 0.45 : matte ? 0.25 : 0.12,
    roughness: matte ? 0.55 : finish === 'solid' ? 0.32 : 0.26,
    clearcoat: matte ? 0 : 1,
    clearcoatRoughness: 0.06,
    sheen: finish === 'pearl' ? 0.6 : 0,
    sheenColor: new THREE.Color('#ffffff'),
    envMapIntensity: 1.15,
  });
}

function plateTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, 512, 112);
  g.strokeStyle = '#111';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 504, 104);
  g.fillStyle = '#1d4ed8';
  g.fillRect(10, 10, 52, 92);
  g.fillStyle = '#fff';
  g.font = 'bold 22px Arial';
  g.textAlign = 'center';
  g.fillText('IND', 36, 88);
  g.fillStyle = '#111';
  g.font = 'bold 62px "Arial Narrow", Arial, sans-serif';
  g.fillText(text.toUpperCase(), 290, 78);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function Car3D(props: Car3DProps) {
  const { model, paint, interior, plate, seats, cabin, night, openDoorFor, hideBody, onSeatClick, onSeatHover } = props;
  const b = useMemo(() => buildCar(model), [model]);
  useEffect(() => () => {
    b.body.dispose();
    b.greenhouse.dispose();
    b.panels.forEach((p) => p.geometry.dispose());
  }, [b]);

  const mats = useMemo(() => {
    const body = paintMaterial(paint.hex, paint.finish);
    const roof = paint.roof ? paintMaterial(paint.roof, paint.finish === 'matte' ? 'matte' : 'pearl') : body;
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#0a0f16', metalness: 0.25, roughness: 0.03, transparent: true, opacity: 0.8,
      envMapIntensity: 1.6, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false,
    });
    const roofGlass = model.sunroof === 'glass-roof' ? glass : roof;
    const black = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.45, metalness: 0.3 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#dfe3e8', roughness: 0.12, metalness: 1 });
    const tyre = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.92 });
    const rim = new THREE.MeshStandardMaterial({ color: '#b8bdc4', roughness: 0.22, metalness: 0.95 });
    const seat = new THREE.MeshStandardMaterial({ color: interior.seat, roughness: interior.material === 'fabric' ? 0.92 : 0.5 });
    const insert = new THREE.MeshStandardMaterial({ color: interior.insert, roughness: interior.material === 'fabric' ? 0.95 : 0.55 });
    const dash = new THREE.MeshStandardMaterial({ color: interior.dash, roughness: 0.7 });
    const accent = new THREE.MeshStandardMaterial({ color: interior.accent, roughness: 0.5, metalness: 0.2 });
    const carpet = new THREE.MeshStandardMaterial({ color: interior.carpet, roughness: 1 });
    return { body, roof: roofGlass, glass, black, chrome, tyre, rim, seat, insert, dash, accent, carpet };
  }, [paint, interior, model.sunroof]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const plateTex = useMemo(() => plateTexture(plate ?? 'KA 01 AB 1234'), [plate]);
  useEffect(() => () => plateTex.dispose(), [plateTex]);

  const openSeat = openDoorFor ? b.seats.find((s) => s.id === openDoorFor) : undefined;
  const openKey = openSeat ? `${openSeat.side === 'M' ? 'L' : openSeat.side}${Math.min(openSeat.row, 2)}` : null;

  return (
    <group>
      {!hideBody && (
        <>
          <mesh geometry={b.body} material={mats.body} castShadow receiveShadow />
          {b.panels.map((p) =>
            p.door ? (
              <Door key={p.key} build={b} geometry={p.geometry} door={p.door} material={mats.body} chrome={mats.chrome}
                open={openKey === `${p.door.side}${p.door.row}`} />
            ) : (
              <mesh key={p.key} geometry={p.geometry} material={mats.body} castShadow />
            ),
          )}
          {b.cladding.map((g, i) => <mesh key={i} geometry={g} material={mats.black} />)}
          <Greenhouse build={b} mats={mats} visible={!cabin} model={model} />
          <Details build={b} model={model} mats={mats} night={night} plateTex={plateTex} />
          <Wheels build={b} mats={mats} />
          <Interior build={b} model={model} mats={mats} night={night} />
        </>
      )}
      {b.seats.map((s) => (
        <Seat key={s.id} seat={s} build={b} state={seats[s.id]} mats={mats} showMesh={!hideBody} showBadge={cabin || !!hideBody}
          onClick={onSeatClick} onHover={onSeatHover} />
      ))}
    </group>
  );
}

function Door({ build, geometry, door, material, chrome, open }: {
  build: CarBuild; geometry: THREE.BufferGeometry; door: CarBuild['doors'][number];
  material: THREE.Material; chrome: THREE.Material; open: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const target = open ? (door.side === 'R' ? 1 : -1) * 1.05 : 0;
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, target, 7, dt);
  });
  const s = door.side === 'R' ? 1 : -1;
  const len = door.x0 - door.x1;
  return (
    <group ref={ref} position={[door.x0, 0, door.z]}>
      <mesh geometry={geometry} material={material} castShadow />
      {/* handle */}
      <mesh position={[-len * 0.78, build.belt - 0.09, s * 0.03]} material={chrome}>
        <boxGeometry args={[0.13, 0.025, 0.02]} />
      </mesh>
    </group>
  );
}

function Greenhouse({ build, mats, visible, model }: { build: CarBuild; mats: Record<string, THREE.Material>; visible: boolean; model: CarModel }) {
  const ref = useRef<THREE.Group>(null);
  const [shown, setShown] = useState(visible);
  useEffect(() => { if (visible) setShown(true); }, [visible]);
  // Own copies so fading the roof never fades the body that may share its paint.
  const own = useMemo(() => {
    const glass = mats.glass.clone();
    const roof = mats.roof === mats.glass ? glass : mats.roof.clone();
    const black = mats.black.clone();
    for (const m of [glass, roof, black]) m.transparent = true;
    return { glass, roof, black };
  }, [mats]);
  useEffect(() => () => { own.glass.dispose(); own.roof.dispose(); own.black.dispose(); }, [own]);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const y = THREE.MathUtils.damp(g.position.y, visible ? 0 : 0.9, 6, dt);
    g.position.y = y;
    const k = 1 - Math.min(1, y / 0.9);
    own.glass.opacity = 0.8 * k;
    if (own.roof !== own.glass) own.roof.opacity = k;
    own.black.opacity = k;
    if (!visible && y > 0.85 && shown) setShown(false);
  });
  const p = build.g2d.profile;
  const x = (s: number) => build.L / 2 - s * build.L;
  const railY = build.roofY + 0.02;
  return (
    <group ref={ref} visible={shown}>
      <mesh geometry={build.greenhouse} material={[own.glass, own.roof]} castShadow raycast={() => null} />
      {model.roofRails && [-1, 1].map((s) => (
        <mesh key={s} position={[(x(p.ws1) + x(p.rg0)) / 2 - 0.05, railY, s * (build.W / 2 - 0.2)]} material={own.black} raycast={() => null}>
          <boxGeometry args={[(x(p.ws1) - x(p.rg0)) * 0.9, 0.03, 0.035]} />
        </mesh>
      ))}
      {build.pillars.map((pl, i) => <Strut key={i} a={pl.a} b={pl.b} t={pl.t} material={own.roof === own.glass ? own.black : own.roof} />)}
      {/* chrome window line */}
      {[-1, 1].map((s) => (
        <mesh key={`belt${s}`} position={[(build.cabinX0 + build.cabinX1) / 2 + 0.05, build.belt + 0.012, s * (build.beltHalf(0) + 0.004)]} material={own.black} raycast={() => null}>
          <boxGeometry args={[build.cabinX0 - build.cabinX1 - 0.15, 0.018, 0.012]} />
        </mesh>
      ))}
      {/* B-pillars */}
      {build.doors.filter((d) => d.row === 1).map((d) => {
        const s = d.side === 'R' ? 1 : -1;
        const half = build.innerHalf(d.x1) + 0.04;
        const h = build.roofY - build.belt;
        const lean = Math.atan2(half * build.style.tumble, h);
        return (
          <mesh key={d.side} material={own.black} position={[d.x1, build.belt + h / 2, s * (half - (half * build.style.tumble) / 2)]}
            rotation={[s * lean, 0, 0]} raycast={() => null}>
            <boxGeometry args={[0.07, h, 0.02]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A box stretched between two points (pillars). */
function Strut({ a, b, t, material }: { a: THREE.Vector3; b: THREE.Vector3; t: number; material: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = b.clone().sub(a);
    // Width runs along the car's side, thickness faces outwards.
    const y = dir.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, new THREE.Vector3(0, 0, Math.sign(a.z) || 1)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return { pos: a.clone().add(b).multiplyScalar(0.5), quat: q, len: dir.length() };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow raycast={() => null}>
      <boxGeometry args={[t, len, 0.045]} />
    </mesh>
  );
}

function HeadBeam({ position, aim }: { position: [number, number, number]; aim: [number, number, number] }) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => { if (light.current && target.current) light.current.target = target.current; }, []);
  return (
    <>
      <spotLight ref={light} position={position} angle={0.5} penumbra={0.65} intensity={40} distance={16} decay={1.6} color="#fff4d6" />
      <object3D ref={target} position={aim} />
    </>
  );
}

function Wheels({ build, mats }: { build: CarBuild; mats: Record<string, THREE.Material> }) {
  const { wheelR: r, tyreW } = build.style;
  return (
    <>
      {[build.frontAxle, build.rearAxle].flatMap((x) => [-1, 1].map((s) => (
        <group key={`${x}${s}`} position={[x, r, s * (build.halfWidth(x) - tyreW / 2 - 0.03)]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={mats.tyre} castShadow>
            <cylinderGeometry args={[r, r, tyreW, 40]} />
          </mesh>
          <mesh material={mats.tyre} position={[0, (s * tyreW) / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r * 0.86, r * 0.12, 10, 40]} />
          </mesh>
          {/* alloy face */}
          <group position={[0, s * (tyreW / 2 + 0.002), 0]}>
            <mesh material={mats.black}>
              <cylinderGeometry args={[r * 0.68, r * 0.68, 0.01, 40]} />
            </mesh>
            {Array.from({ length: 5 }, (_, i) => (
              <mesh key={i} material={mats.rim} rotation={[0, (i * Math.PI * 2) / 5, 0]} position={[0, s * 0.008, 0]}>
                <boxGeometry args={[r * 1.28, 0.02, 0.045]} />
              </mesh>
            ))}
            <mesh material={mats.rim} position={[0, s * 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r * 0.66, 0.018, 8, 40]} />
            </mesh>
            <mesh material={mats.chrome} position={[0, s * 0.016, 0]}>
              <cylinderGeometry args={[r * 0.14, r * 0.14, 0.02, 20]} />
            </mesh>
          </group>
        </group>
      )))}
    </>
  );
}

function Details({ build: b, model, mats, night, plateTex }: {
  build: CarBuild; model: CarModel; mats: Record<string, THREE.Material>; night: boolean; plateTex: THREE.Texture;
}) {
  const front = b.L / 2 + 0.035;
  const rear = -b.L / 2 - 0.035;
  const lampY = b.H * b.style.hoodFront - 0.07;
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f7fb', emissive: '#fff6dc', emissiveIntensity: night ? 3 : 0.35, roughness: 0.1, metalness: 0.4 }), [night]);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a0b12', emissive: '#ff1a28', emissiveIntensity: night ? 2.4 : 0.25, roughness: 0.2 }), [night]);
  useEffect(() => () => { head.dispose(); tail.dispose(); }, [head, tail]);
  const hwF = b.halfWidth(front - 0.08);
  const hwR = b.halfWidth(rear + 0.08);
  const bar = (where: 'front' | 'rear') => model.lightBar === where || model.lightBar === 'both';
  const tailY = (b.style.deck ? b.H * b.style.deck : b.H * b.style.tail) - 0.1;
  const mirrorX = b.cabinX0 - 0.12;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* headlamp cluster: dark housing, bright projector and DRL */}
          <RoundedBox args={[0.2, 0.1, hwF * 0.52]} radius={0.035} position={[front - 0.1, lampY + 0.01, s * hwF * 0.6]} material={mats.black} />
          <RoundedBox args={[0.2, 0.06, hwF * 0.4]} radius={0.025} position={[front - 0.085, lampY + 0.012, s * hwF * 0.6]} material={head} />
          <mesh position={[front - 0.03, lampY + 0.012, s * hwF * 0.72]} material={mats.chrome}><sphereGeometry args={[0.032, 16, 12]} /></mesh>
          <RoundedBox args={[0.16, 0.09, hwR * 0.5]} radius={0.03} position={[rear + 0.07, tailY, s * hwR * 0.66]} material={tail} />
          {/* mirrors */}
          <RoundedBox args={[0.2, 0.11, 0.17]} radius={0.04} position={[mirrorX, b.belt + 0.05, s * (b.halfWidth(mirrorX) + 0.06)]} material={mats.body} castShadow />
          {night && <HeadBeam position={[front, lampY, s * hwF * 0.62]} aim={[front + 5, 0, s * 0.9]} />}
        </group>
      ))}
      {bar('front') && <mesh position={[front - 0.02, lampY + 0.03, 0]} material={head}><boxGeometry args={[0.03, 0.015, hwF * 0.9]} /></mesh>}
      {bar('rear') && <mesh position={[rear + 0.02, tailY + 0.02, 0]} material={tail}><boxGeometry args={[0.03, 0.025, hwR * 1.3]} /></mesh>}
      {/* grille + bumper lips */}
      <RoundedBox args={[0.06, b.H * 0.1, hwF * 1.05]} radius={0.025} position={[front - 0.02, lampY - b.H * 0.075, 0]} material={mats.black} />
      <RoundedBox args={[0.12, 0.07, hwF * 1.7]} radius={0.03} position={[front - 0.11, b.style.gc + 0.07, 0]} material={mats.black} />
      <RoundedBox args={[0.1, 0.08, hwR * 1.6]} radius={0.03} position={[rear + 0.1, b.style.gc + 0.08, 0]} material={mats.black} />
      {/* plates */}
      {[front, rear].map((x, i) => (
        <mesh key={x} position={[x + (i ? -0.012 : 0.012), b.style.gc + 0.27, 0]} rotation={[0, i ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <planeGeometry args={[0.5, 0.11]} />
          <meshStandardMaterial map={plateTex} roughness={0.4} />
        </mesh>
      ))}
      {/* brand badge */}
      <mesh position={[front + 0.005, lampY - 0.02, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.chrome}>
        <circleGeometry args={[0.045, 24]} />
      </mesh>
    </group>
  );
}

function Interior({ build: b, model, mats, night }: { build: CarBuild; model: CarModel; mats: Record<string, THREE.Material>; night: boolean }) {
  const driver = b.seats.find((s) => s.id === DRIVER_SEAT)!;
  const front = b.seats.filter((s) => s.row === 1);
  const dashW = 2 * b.innerHalf(b.dashX1) - 0.04;
  const dashTop = b.belt + 0.04;
  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#05080d', emissive: '#1e3a5f', emissiveIntensity: night ? 1.6 : 0.6, roughness: 0.15 }), [night]);
  useEffect(() => () => screenMat.dispose(), [screenMat]);
  const screenW = Math.min(0.42, (model.screenInches * 0.0254) * 0.85);
  const consoleX0 = b.dashX1;
  const consoleX1 = front[0].x - front[0].d * 0.95;
  return (
    <group>
      {/* floor */}
      <mesh position={[(b.cabinX0 + b.cabinX1) / 2, b.floorY + 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.carpet} receiveShadow>
        <planeGeometry args={[b.cabinX0 - b.cabinX1 + 0.04, 2 * b.innerHalf(0) + 0.06]} />
      </mesh>
      {/* inner door trims */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(b.cabinX0 + b.cabinX1) / 2, b.belt - 0.03, s * (b.innerHalf(0) + 0.01)]} material={mats.accent}>
          <boxGeometry args={[b.cabinX0 - b.cabinX1 - 0.1, 0.04, 0.03]} />
        </mesh>
      ))}
      {/* dashboard */}
      <RoundedBox args={[b.dashX0 - b.dashX1, dashTop - b.floorY - 0.1, dashW]} radius={0.05}
        position={[(b.dashX0 + b.dashX1) / 2, (dashTop + b.floorY + 0.1) / 2, 0]} material={mats.dash} />
      <mesh position={[b.dashX1 + 0.04, dashTop - 0.1, 0]} material={mats.accent}>
        <boxGeometry args={[0.02, 0.03, dashW * 0.96]} />
      </mesh>
      {/* infotainment screen, tilted towards the cabin */}
      <mesh position={[b.dashX1 + 0.06, dashTop + (model.screen === 'floating' || model.screen === 'tesla' ? 0.08 : 0.02), model.screen === 'panoramic' ? driver.z * 0.45 : 0]}
        rotation={[0, -Math.PI / 2, -0.25]} material={screenMat}>
        <planeGeometry args={[model.screen === 'panoramic' ? Math.abs(driver.z) + screenW : screenW, model.screen === 'tesla' ? 0.2 : 0.14]} />
      </mesh>
      {/* steering wheel (right-hand drive) */}
      <group position={[driver.x + 0.18, b.belt - 0.02, driver.z]} rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[-0.45, 0, 0]}>
          <mesh material={mats.black}><torusGeometry args={[0.185, 0.022, 12, 40]} /></mesh>
          <mesh material={mats.black}><boxGeometry args={[0.32, 0.035, 0.03]} /></mesh>
          <mesh material={mats.chrome} position={[0, 0, 0.02]}><circleGeometry args={[0.05, 20]} /></mesh>
        </group>
      </group>
      {/* rear wheel housings inside the cabin */}
      {b.rearAxle < b.cabinX0 && b.rearAxle > b.cabinX1 && [-1, 1].map((s) => (
        <RoundedBox key={`wh${s}`} args={[2 * (b.style.wheelR + 0.06), 0.22, b.style.tyreW + 0.08]} radius={0.06}
          position={[b.rearAxle, b.style.wheelR + 0.16, s * (b.halfWidth(b.rearAxle) - b.style.tyreW / 2 - 0.06)]} material={mats.dash} />
      ))}
      {/* centre console */}
      {consoleX0 > consoleX1 && (
        <RoundedBox args={[consoleX0 - consoleX1, 0.22, 0.2]} radius={0.04} position={[(consoleX0 + consoleX1) / 2, b.floorY + 0.12, 0]} material={mats.dash} />
      )}
    </group>
  );
}

function Seat({ seat, build, state, mats, showMesh, showBadge, onClick, onHover }: {
  seat: Seat3D; build: CarBuild; state?: SeatState; mats: Record<string, THREE.Material>; showMesh: boolean; showBadge: boolean;
  onClick?: (id: string) => void; onHover?: (id: string | null) => void;
}) {
  const status = state?.status ?? 'empty';
  const clickable = !!onClick && status !== 'driver' && status !== 'booked';
  const glowRef = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const ring = status === 'available' ? '#22c55e' : status === 'selected' ? '#f59e0b' : status === 'mine' ? '#facc15' : null;
  useFrame(({ clock }) => {
    const m = glowRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = status === 'available' ? 0.25 + 0.2 * Math.sin(clock.elapsedTime * 3.2) ** 2 + (hover ? 0.25 : 0) : 0.55;
  });
  const { x, z, w, d, cushionY, backH } = seat;
  const cushionD = d * 0.55;
  const cx = x - cushionD / 2;
  const backX = x - cushionD - 0.03;
  const occupied = (status === 'booked' || status === 'mine' || status === 'driver') && state?.gender;
  const events = {
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (clickable) onClick!(seat.id); },
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHover(true); onHover?.(seat.id); document.body.style.cursor = clickable ? 'pointer' : 'default'; },
    onPointerOut: () => { setHover(false); onHover?.(null); document.body.style.cursor = 'default'; },
  };
  return (
    <group>
      {showMesh && (
        <group {...events}>
          <RoundedBox args={[cushionD, 0.12, w]} radius={0.04} position={[cx, cushionY, z]} material={mats.seat} castShadow />
          <RoundedBox args={[cushionD * 0.8, 0.02, w * 0.62]} radius={0.008} position={[cx, cushionY + 0.06, z]} material={mats.insert} />
          <group position={[backX, cushionY + 0.04, z]} rotation={[0, 0, 0.2]}>
            <RoundedBox args={[0.12, backH, w]} radius={0.045} position={[0, backH / 2, 0]} material={mats.seat} castShadow />
            <RoundedBox args={[0.02, backH * 0.7, w * 0.62]} radius={0.008} position={[0.06, backH * 0.48, 0]} material={mats.insert} />
            {seat.kind === 'captain' && [-1, 1].map((s) => (
              <RoundedBox key={s} args={[0.32, 0.06, 0.06]} radius={0.02} position={[0.18, 0.2, s * (w / 2 + 0.02)]} material={mats.seat} />
            ))}
            <RoundedBox args={[0.1, 0.15, seat.side === 'M' ? w * 0.4 : w * 0.5]} radius={0.04} position={[-0.01, backH + 0.11, 0]} material={mats.seat} castShadow />
          </group>
          {occupied && <Occupant seat={seat} gender={state!.gender!} />}
        </group>
      )}
      {ring && (
        <mesh ref={glowRef} position={[x - d * 0.4, build.floorY + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[d * 0.9, w + 0.06]} />
          <meshBasicMaterial color={ring} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      {showBadge && <SeatBadge seat={seat} state={state} y={cushionY + backH + 0.42} onClick={clickable ? () => onClick!(seat.id) : undefined} />}
    </group>
  );
}

function Occupant({ seat, gender }: { seat: Seat3D; gender: Gender }) {
  const { x, z, w, d, cushionY } = seat;
  const shirt = SHIRT[gender];
  const skin = '#c68b5e';
  const hair = '#1d130e';
  const hipX = x - d * 0.5;
  return (
    <group raycast={() => null}>
      {/* thighs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[hipX + 0.2, cushionY + 0.12, z + s * w * 0.14]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.065, 0.28, 6, 12]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
      ))}
      {/* torso */}
      <mesh position={[hipX - 0.04, cushionY + 0.4, z]} rotation={[0, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.15, 0.28, 8, 16]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {/* arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[hipX + 0.06, cushionY + 0.36, z + s * (w * 0.36)]} rotation={[0, 0, 0.9]} castShadow>
          <capsuleGeometry args={[0.05, 0.3, 6, 10]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
      ))}
      {/* head + hair */}
      <mesh position={[hipX - 0.08, cushionY + 0.74, z]} castShadow>
        <sphereGeometry args={[0.1, 20, 16]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[hipX - 0.1, cushionY + 0.78, z]} scale={gender === 'F' ? [1.08, 1.15, 1.1] : [1.04, 0.85, 1.04]}>
        <sphereGeometry args={[0.1, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} roughness={0.9} />
      </mesh>
      {gender === 'F' && (
        <mesh position={[hipX - 0.17, cushionY + 0.62, z]} castShadow>
          <capsuleGeometry args={[0.08, 0.18, 6, 12]} />
          <meshStandardMaterial color={hair} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function SeatBadge({ seat, state, y, onClick }: { seat: Seat3D; state?: SeatState; y: number; onClick?: () => void }) {
  const status = state?.status ?? 'empty';
  if (status === 'empty' || status === 'unavailable') return null;
  const g = state?.gender;
  const occupied = g && (status === 'booked' || status === 'mine' || status === 'driver');
  const bg = occupied ? BADGE[g!] : status === 'selected' ? '#f59e0b' : '#22c55e';
  const label = occupied ? (g === 'M' ? '♂' : '♀') : status === 'selected' ? '✓' : '+';
  return (
    <Html position={[seat.x - seat.d * 0.45, y, seat.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: onClick ? 'auto' : 'none' }}>
      <button className={`seat3d-badge seat3d-badge--${status}`} style={{ background: bg }} onClick={onClick} aria-label={`Seat ${seat.id}`}>
        <span>{label}</span>
        {status === 'driver' && <em>Driver</em>}
        {status === 'mine' && <em>You</em>}
      </button>
    </Html>
  );
}
