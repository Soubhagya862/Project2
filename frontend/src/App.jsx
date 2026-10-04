import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Line, PerspectiveCamera } from "@react-three/drei";
import { io } from "socket.io-client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const HOME = { x: 0, y: 30, z: 0 };
const INITIAL_TARGET = { x: 1400, y: 120, z: -1100 };
const CRUISE_SPEED = 120;
const SENSOR_NOISE = 2.5;
const WORLD = { minX: -1500, maxX: 3000, minY: 0, maxY: 500, minZ: -1800, maxZ: 1200 };

const OBSTACLES = [
  { id: "O-01", x: 350, y: 75, z: -220, sx: 180, sy: 150, sz: 180 },
  { id: "O-02", x: 760, y: 120, z: -470, sx: 220, sy: 240, sz: 180 },
  { id: "O-03", x: 1050, y: 95, z: -760, sx: 180, sy: 190, sz: 220 },
  { id: "O-04", x: 1240, y: 70, z: -350, sx: 160, sy: 140, sz: 160 },
  { id: "O-05", x: 1550, y: 150, z: -850, sx: 220, sy: 300, sz: 220 },
  { id: "O-06", x: 1950, y: 100, z: -1050, sx: 260, sy: 200, sz: 220 },
];

const sensorDistanceToObstacle = (position, heading, obstacle, maxRange = 300) => {
  const a = heading * Math.PI / 180;
  const forward = { x:-Math.sin(a), y:0, z:-Math.cos(a) };
  const dx = obstacle.x-position.x, dz = obstacle.z-position.z;
  const horizontal = Math.hypot(dx,dz);
  if (horizontal < 0.001) return 0;
  const dot = (dx*forward.x + dz*forward.z) / horizontal;
  if (dot < Math.cos(0.62)) return Infinity;
  return Math.max(0, horizontal - Math.max(obstacle.sx, obstacle.sz)/2) <= maxRange
    ? Math.max(0, horizontal - Math.max(obstacle.sx, obstacle.sz)/2)
    : Infinity;
};

function scanEnvironment(position, heading, maxRange = 300) {
  const detected = OBSTACLES
    .map(o => ({ ...o, distance:sensorDistanceToObstacle(position, heading, o, maxRange) }))
    .filter(o => Number.isFinite(o.distance))
    .sort((a,b)=>a.distance-b.distance);
  return detected;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const pointInside = (p, o, margin = 45) =>
  Math.abs(p.x - o.x) <= o.sx / 2 + margin &&
  Math.abs(p.y - o.y) <= o.sy / 2 + margin &&
  Math.abs(p.z - o.z) <= o.sz / 2 + margin;

function segmentBlocked(a, b, obstacles = OBSTACLES) {
  const length = dist3(a, b);
  const steps = Math.max(2, Math.ceil(length / 35));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
    if (obstacles.some((o) => pointInside(p, o))) return true;
  }
  return false;
}

function createRoute(start, target, obstacles = OBSTACLES) {
  const direct = [start, target];
  if (!segmentBlocked(start, target, obstacles)) return direct;

  const candidates = [];
  for (const o of obstacles) {
    const pad = 75;
    const x = o.sx / 2 + pad;
    const y = o.sy / 2 + pad;
    const z = o.sz / 2 + pad;
    candidates.push(
      { x: o.x - x, y: Math.max(80, o.y + y), z: o.z - z },
      { x: o.x + x, y: Math.max(80, o.y + y), z: o.z - z },
      { x: o.x - x, y: Math.max(80, o.y + y), z: o.z + z },
      { x: o.x + x, y: Math.max(80, o.y + y), z: o.z + z }
    );
  }

  const route = [start];
  let current = start;
  const remaining = [...candidates, target];

  for (let guard = 0; guard < 18 && remaining.length; guard++) {
    const visible = remaining.filter((p) => !segmentBlocked(current, p, obstacles));
    if (!visible.length) {
      const highest = [...remaining].sort((a, b) => b.y - a.y)[0];
      route.push(highest);
      current = highest;
      remaining.splice(remaining.indexOf(highest), 1);
      continue;
    }
    visible.sort((a, b) => dist3(current, a) + dist3(a, target) - (dist3(current, b) + dist3(b, target)));
    const next = visible[0];
    route.push(next);
    current = next;
    remaining.splice(remaining.indexOf(next), 1);
    if (next === target) break;
  }

  if (route[route.length - 1] !== target) route.push(target);

  const smoothed = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const last = smoothed[smoothed.length - 1];
    if (i === route.length - 1 || segmentBlocked(last, route[i + 1], obstacles)) smoothed.push(route[i]);
  }
  return smoothed;
}

function noisy(v, amount = SENSOR_NOISE) {
  return v + (Math.random() - 0.5) * amount;
}

function Drone({ position, heading, active }) {
  const group = useRef();
  const rotors = useRef([]);
  const laserLights = useRef([]);

  useFrame((_, dt) => {
    if (!group.current) return;
    const target = new THREE.Vector3(position.x, position.y, position.z);
    group.current.position.lerp(target, 1 - Math.exp(-dt * 8));

    const targetYaw = heading * Math.PI / 180;
    let delta = targetYaw - group.current.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    group.current.rotation.y += delta * Math.min(1, dt * 9);

    const t = performance.now() * 0.001;
    group.current.position.y += (active ? Math.sin(t * 2.1) * 0.45 : 0) * dt;
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      active ? Math.sin(t * 1.25) * 0.035 : 0,
      Math.min(1, dt * 3.5)
    );

    rotors.current.forEach(r => {
      if (r) r.rotation.y += dt * (active ? 105 : 10);
    });
    laserLights.current.forEach((l, i) => {
      if (l) l.material.emissiveIntensity = active
        ? 3 + Math.sin(t * 9 + i) * 1.2 : 1;
    });
  });

  // Long-body heavy-lift layout: noticeably longer than tall.
  const motors = [[-10,-8],[10,-8],[-10,8],[10,8]];

  return (
    <group ref={group} position={[position.x,position.y,position.z]} scale={3.4}>
      <mesh castShadow>
        <capsuleGeometry args={[2.5, 9.5, 10, 36]}/>
        <meshStandardMaterial color="#111f28" metalness={0.96} roughness={0.14}/>
      </mesh>
      <mesh position={[0,1.2,0]} scale={[1.35,.55,2.5]} castShadow>
        <boxGeometry args={[4.2,2.2,6.2]}/>
        <meshStandardMaterial color="#294a58" metalness={.92} roughness={.18}/>
      </mesh>

      {/* Long aerodynamic wings / arms */}
      {motors.map(([x,z],i)=>(
        <group key={i} position={[x*.48,0,z*.48]}>
          <mesh rotation={[0,Math.atan2(x,z),0]} castShadow>
            <boxGeometry args={[1.25,.9,12.5]}/>
            <meshStandardMaterial color="#203b47" metalness={.94} roughness={.16}/>
          </mesh>
          <mesh position={[0,.52,z>0?2.2:-2.2]}>
            <boxGeometry args={[1.4,.14,6.5]}/>
            <meshStandardMaterial color="#4fe5f7" emissive="#087d91" emissiveIntensity={1.1}/>
          </mesh>
          <mesh position={[0,.45,z>0?5.0:-5.0]} castShadow>
            <cylinderGeometry args={[1.45,1.65,1.2,30]}/>
            <meshStandardMaterial color="#091319" metalness={1} roughness={.1}/>
          </mesh>
          <mesh position={[0,1.08,z>0?5.0:-5.0]}>
            <torusGeometry args={[1.15,.12,10,30]}/>
            <meshStandardMaterial color="#63edff" emissive="#00b8d4" emissiveIntensity={active?3:.8}/>
          </mesh>
          <group ref={el=>rotors.current[i]=el} position={[0,1.35,z>0?5.0:-5.0]}>
            <mesh><boxGeometry args={[8.5,.08,.28]}/><meshStandardMaterial color="#c5f8ff" transparent opacity={active?.25:.12}/></mesh>
            <mesh rotation={[0,Math.PI/2,0]}><boxGeometry args={[8.5,.08,.28]}/><meshStandardMaterial color="#c5f8ff" transparent opacity={active?.25:.12}/></mesh>
          </group>

          {/* Non-contact laser-like sensor emitters for visual sensing */}
          <mesh ref={el=>laserLights.current[i]=el} position={[0,.15,z>0?6.0:-6.0]}>
            <sphereGeometry args={[.3,16,12]}/>
            <meshStandardMaterial color="#ff4fd8" emissive="#ff198c" emissiveIntensity={2}/>
          </mesh>
          <Line
            points={[[0,.15,z>0?6.2:-6.2],[0,.15,z>0?28:-28]]}
            color="#ff4fd8" lineWidth={1}
            transparent opacity={active?.38:.08}
          />
        </group>
      ))}

      {/* Front sensor cluster */}
      <mesh position={[0,.15,-4.7]}>
        <sphereGeometry args={[1.45,32,24]}/>
        <meshStandardMaterial color="#48efff" emissive="#00b9d6" emissiveIntensity={4} metalness={.3} roughness={.08}/>
      </mesh>
      <mesh position={[0,.85,-4.15]} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[1.45,.13,12,32]}/>
        <meshStandardMaterial color="#7af4ff" emissive="#0bc6df" emissiveIntensity={2}/>
      </mesh>

      {/* Rear stabilizers */}
      <mesh position={[-2.3,.9,3.2]} rotation={[0,0,-.2]}>
        <boxGeometry args={[.7,3.8,1.5]}/>
        <meshStandardMaterial color="#2b5060" metalness={.9} roughness={.18}/>
      </mesh>
      <mesh position={[2.3,.9,3.2]} rotation={[0,0,.2]}>
        <boxGeometry args={[.7,3.8,1.5]}/>
        <meshStandardMaterial color="#2b5060" metalness={.9} roughness={.18}/>
      </mesh>

      {/* Landing gear */}
      {[-2.2,2.2].map(x=>(
        <group key={x} position={[x,-2.25,.9]}>
          <mesh rotation={[0,0,x<0?-.12:.12]}>
            <cylinderGeometry args={[.18,.22,3.1,12]}/>
            <meshStandardMaterial color="#15262e" metalness={.9}/>
          </mesh>
          <mesh position={[0,-1.45,0]}>
            <boxGeometry args={[3.2,.2,.55]}/>
            <meshStandardMaterial color="#0c171d" metalness={.96}/>
          </mesh>
        </group>
      ))}

      {/* Underside sensor pod */}
      <mesh position={[0,-2.1,-.8]}>
        <cylinderGeometry args={[.85,1,.5,26]}/>
        <meshStandardMaterial color="#09181f" metalness={.96}/>
      </mesh>
      <mesh position={[0,-2.38,-.8]}>
        <sphereGeometry args={[.42,20,16]}/>
        <meshStandardMaterial color="#65f4ff" emissive="#00c8e8" emissiveIntensity={3}/>
      </mesh>
    </group>
  );
}
function Marker({ point, type }) {
  const color = type === "target" ? "#4dff9a" : "#ffd34d";
  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh><cylinderGeometry args={[14, 14, 2, 32]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} /></mesh>
      <mesh position={[0, 22, 0]}><sphereGeometry args={[3.5, 20, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} /></mesh>
      <Line points={[[0, 2, 0], [0, 40, 0]]} color={color} lineWidth={1.5} />
    </group>
  );
}

function Obstacle({ obstacle, detected }) {
  return (
    <group position={[obstacle.x, obstacle.y, obstacle.z]}>
      <mesh castShadow>
        <boxGeometry args={[obstacle.sx, obstacle.sy, obstacle.sz]} />
        <meshStandardMaterial color={detected ? "#ff405d" : "#7a5143"} emissive={detected ? "#8b1025" : "#000000"} emissiveIntensity={detected ? 0.8 : 0} />
      </mesh>
      {detected && <Line points={[[-obstacle.sx/2, -obstacle.sy/2, -obstacle.sz/2], [obstacle.sx/2, obstacle.sy/2, obstacle.sz/2]]} color="#ff5574" lineWidth={2} />}
    </group>
  );
}

function RouteLine({ route, color = "#58e7ff" }) {
  if (route.length < 2) return null;
  return <Line points={route.map((p) => [p.x, p.y, p.z])} color={color} lineWidth={2.5} dashed dashSize={12} gapSize={6} />;
}

function SensorRays({ position, heading, range }) {
  const a = heading * Math.PI / 180;
  const rays = [-0.45, -0.22, 0, 0.22, 0.45];
  return (
    <>
      {rays.map((r, i) => {
        const ang = a + r;
        return <Line key={i} points={[[position.x, position.y, position.z], [position.x + Math.sin(ang) * range, position.y, position.z - Math.cos(ang) * range]]} color="#19dfff" lineWidth={0.7} transparent opacity={0.3} />;
      })}
    </>
  );
}

function Scene({ position, heading, target, route, detectedObstacle, sensorRange, missionState, speed, discoveredObstacles }) {
  const camera = useRef();
  const flight = ["AUTONOMOUS", "RETURNING", "EMERGENCY AUTOPILOT"].includes(missionState);
  const flightView = flight && speed > 1;

  useFrame((_, dt) => {
    if (!camera.current) return;

    const a = heading * Math.PI / 180;
    const forward = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));

    if (flightView) {
      // Stable third-person flight view: the complete drone stays visible,
      // but it is deliberately kept far enough from the camera.
      const distanceBehind = 75;
      const heightAbove = 32;
      const cameraPosition = new THREE.Vector3(
        position.x - forward.x * distanceBehind,
        position.y + heightAbove,
        position.z - forward.z * distanceBehind
      );

      camera.current.position.lerp(
        cameraPosition,
        Math.min(1, dt * 5)
      );

      // Look slightly ahead of the drone so its direction and environment
      // remain visible without making the drone fill the screen.
      const lookPoint = new THREE.Vector3(
        position.x + forward.x * 155,
        position.y + 10,
        position.z + forward.z * 155
      );
      camera.current.lookAt(lookPoint);

      camera.current.fov = THREE.MathUtils.lerp(
        camera.current.fov,
        58,
        Math.min(1, dt * 5)
      );
      camera.current.updateProjectionMatrix();
    } else {
      const desired = new THREE.Vector3(
        position.x + 620,
        position.y + 520,
        position.z + 700
      );
      camera.current.position.lerp(desired, Math.min(1, dt * 2.4));
      camera.current.lookAt(position.x, position.y, position.z);
      camera.current.fov = THREE.MathUtils.lerp(
        camera.current.fov,
        48,
        Math.min(1, dt * 5)
      );
      camera.current.updateProjectionMatrix();
    }
  });
  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault position={[620, 550, 700]} fov={48} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[300, 700, 250]} intensity={2.6} castShadow />
      <Grid args={[4500, 4500]} cellSize={50} sectionSize={250} fadeDistance={3200} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[4500, 4500]} /><meshStandardMaterial color="#17291f" roughness={1} /></mesh>
      <Marker point={HOME} type="home" />
      <Marker point={target} type="target" />
      {OBSTACLES.map((o) => <Obstacle key={o.id} obstacle={o} detected={detectedObstacle === o.id || discoveredObstacles.includes(o.id)} />)}
      <RouteLine route={route} />
      <SensorRays position={position} heading={heading} range={sensorRange} />
      <Drone position={position} heading={heading} active={missionState === "AUTONOMOUS" || missionState === "RETURNING" || missionState === "EMERGENCY AUTOPILOT"} />
    </>
  );
}

function MiniMap({ position, target, route }) {
  const minX = WORLD.minX, maxX = WORLD.maxX, minZ = WORLD.minZ, maxZ = WORLD.maxZ;
  const px = (x) => ((x - minX) / (maxX - minX)) * 100;
  const pz = (z) => ((z - minZ) / (maxZ - minZ)) * 100;
  return (
    <div className="mini-map">
      <div className="map-grid" />
      {OBSTACLES.map((o) => <span key={o.id} className="map-obstacle" style={{ left: px(o.x) + "%", top: pz(o.z) + "%", width: (o.sx/(maxX-minX))*100 + "%", height: (o.sz/(maxZ-minZ))*100 + "%" }} />)}
      {route.map((p, i) => <span key={i} className="map-route" style={{ left: px(p.x) + "%", top: pz(p.z) + "%" }} />)}
      <span className="map-home" style={{ left: px(HOME.x) + "%", top: pz(HOME.z) + "%" }} />
      <span className="map-target" style={{ left: px(target.x) + "%", top: pz(target.z) + "%" }} />
      <span className="map-drone" style={{ left: px(position.x) + "%", top: pz(position.z) + "%" }} />
    </div>
  );
}

function Metric({ label, value, className = "" }) {
  return <div className={"metric " + className}><span>{label}</span><b>{value}</b></div>;
}

function Engine({ position, heading, missionState, route, target, setPosition, setHeading, setSpeed, setBattery, setMissionState, setDetectedObstacle, setSensorRange, setRoute, setReplans, pathMode, setDiscoveredObstacles, setScanCount }) {
  const state = useRef({ ...position });
  const velocity = useRef({ x: 0, y: 0, z: 0 });
  const lastReplanAt = useRef(0);
  useFrame((_, dt) => {
    if (!["AUTONOMOUS", "RETURNING", "EMERGENCY AUTOPILOT"].includes(missionState) || route.length < 2) {
      setSpeed(0);
      return;
    }
    const targetIndex = missionState === "RETURNING" ? 0 : route.length - 1;
    let nearestIndex = 0;
    let best = Infinity;
    route.forEach((p, i) => { const d = dist3(state.current, p); if (d < best) { best = d; nearestIndex = i; } });
    let nextIndex = Math.min(nearestIndex + 1, targetIndex);
    if (missionState === "RETURNING") nextIndex = Math.max(0, nearestIndex - 1);
    const waypoint = route[nextIndex] || (missionState === "RETURNING" ? HOME : route[route.length - 1]);
    const d = dist3(state.current, waypoint);
    if (d < 12) {
      if ((missionState === "AUTONOMOUS" || missionState === "EMERGENCY AUTOPILOT") && nextIndex >= targetIndex) {
        setPosition({ ...waypoint }); state.current = { ...waypoint }; setSpeed(0); setMissionState("LANDED"); return;
      }
      if (missionState === "RETURNING" && nextIndex <= 0) {
        setPosition({ ...HOME }); state.current = { ...HOME }; setSpeed(0); setMissionState("LANDED"); return;
      }
    }
    const step = Math.min(d, CRUISE_SPEED * dt);
    const nx = state.current.x + (waypoint.x - state.current.x) / Math.max(d, 0.001) * step;
    const ny = state.current.y + (waypoint.y - state.current.y) / Math.max(d, 0.001) * step;
    const nz = state.current.z + (waypoint.z - state.current.z) / Math.max(d, 0.001) * step;
    velocity.current = { x: (nx-state.current.x)/Math.max(dt,0.001), y:(ny-state.current.y)/Math.max(dt,0.001), z:(nz-state.current.z)/Math.max(dt,0.001) };
    state.current = { x:nx, y:ny, z:nz };
    setPosition(state.current);
    setSpeed(Math.hypot(velocity.current.x, velocity.current.y, velocity.current.z));
    const hd = Math.atan2(-velocity.current.x, -velocity.current.z) * 180 / Math.PI;
    setHeading((hd + 360) % 360);
    setBattery((b) => Math.max(0, b - dt * 0.025));
    // Simulated onboard vision/LiDAR scan. The drone only "discovers"
    // obstacles inside its sensor cone and remembers their IDs.
    const scan = scanEnvironment(state.current, heading, 300);
    setScanCount((n) => n + (scan.length ? 1 : 0));
    if (scan.length) {
      setDiscoveredObstacles((old) => [...new Set([...old, ...scan.map(o => o.id)])]);
    }

    const nearestObstacle = scan[0] || null;
    setDetectedObstacle(nearestObstacle && nearestObstacle.distance < 300 ? nearestObstacle.id : null);
    setSensorRange(nearestObstacle ? Math.min(300, nearestObstacle.distance) : 300);

    // Autonomous mode can replan when a remembered/visually detected obstacle
    // makes the next route segment unsafe.
    if (pathMode === "DRONE" && missionState !== "RETURNING" && nearestObstacle && nearestObstacle.distance < 180 && performance.now() - lastReplanAt.current > 1500) {
      const nextWaypoint = route[nextIndex];
      if (nextWaypoint && segmentBlocked(state.current, nextWaypoint, OBSTACLES)) {
        const replanned = createRoute({ ...state.current }, { ...target }, OBSTACLES);
        if (replanned.length > 1) {
          lastReplanAt.current = performance.now();
          setRoute(replanned);
          setReplans((n) => n + 1);
        }
      }
    }
  });
  return null;
}

export default function App() {
  const [gpsDenied, setGpsDenied] = useState(true);
  const [position, setPosition] = useState({ ...HOME });
  const [estimatedPosition, setEstimatedPosition] = useState({ ...HOME });
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [battery, setBattery] = useState(100);
  const [missionState, setMissionState] = useState("READY");
  const [target, setTarget] = useState({ ...INITIAL_TARGET });
  const [route, setRoute] = useState([]);
  const [sensorError, setSensorError] = useState(0);
  const [sensorRange, setSensorRange] = useState(300);
  const [detectedObstacle, setDetectedObstacle] = useState(null);
  const [replans, setReplans] = useState(0);
  const [missionId, setMissionId] = useState(null);
  const [showTargetMap, setShowTargetMap] = useState(false);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);
  const [targetSelectionPhase, setTargetSelectionPhase] = useState("TARGET");
  const [pathMode, setPathMode] = useState("DRONE"); // DRONE = automatic vision/memory, MANUAL = operator waypoints
  const [pathAnalyzing, setPathAnalyzing] = useState(false);
  const [discoveredObstacles, setDiscoveredObstacles] = useState([]);
  const [scanCount, setScanCount] = useState(0);
  const socketRef = useRef(null);
  const estimatorRef = useRef({ ...HOME, bias:{x:0,y:0,z:0} });

  const distance = useMemo(() => dist3(position, target), [position, target]);
  const totalDistance = useMemo(() => Math.max(1, dist3(HOME, target)), [target]);
  const progress = useMemo(() => clamp(((totalDistance-distance)/totalDistance)*100,0,100), [distance,totalDistance]);
  const routeDistance = useMemo(() => route.reduce((sum,p,i)=>i?sum+dist3(route[i-1],p):0,0), [route]);

  useEffect(() => {
    socketRef.current = io(API, { autoConnect: true, transports:["websocket"] });
    socketRef.current.emit("register-client", { role:"simulator" });
    return () => socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const e = estimatorRef.current;
      const alpha = 0.18;
      e.x += (position.x - e.x) * alpha + (Math.random()-0.5) * 0.9;
      e.y += (position.y - e.y) * alpha + (Math.random()-0.5) * 0.55;
      e.z += (position.z - e.z) * alpha + (Math.random()-0.5) * 0.9;
      setEstimatedPosition({ x:noisy(e.x,0.7), y:noisy(e.y,0.45), z:noisy(e.z,0.7) });
      const err = dist3(e, position);
      setSensorError(err);
      socketRef.current?.emit("telemetry", {
        missionId, timestamp:Date.now(), gpsStatus:gpsDenied?"DENIED":"CONNECTED",
        position:position, estimatedPosition:e, speed, heading, battery,
        targetDistance:distance, missionProgress:progress, sensorError:err,
        detectedObstacle, phase:missionState
      });
    }, 250);
    return () => clearInterval(timer);
  }, [position, speed, heading, battery, distance, progress, missionId, gpsDenied, detectedObstacle, missionState]);

  useEffect(() => {
    if (gpsDenied && missionState === "MANUAL") setMissionState("EMERGENCY AUTOPILOT");
  }, [gpsDenied, missionState]);

  const buildRoute = (newTarget = target) => {
    const next = createRoute({ ...position }, { ...newTarget });
    setRoute(next);
    setReplans((n) => n + 1);
    return next;
  };

  const startMission = async () => {
    const nextRoute = route.length > 1 ? route : createRoute({ ...position }, { ...target });
    setRoute(nextRoute);
    setMissionState(gpsDenied ? "EMERGENCY AUTOPILOT" : "AUTONOMOUS");
    try {
      const res = await fetch(API + "/api/missions", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ name:"GPS-Denied Autonomous Test", start:position, target, route:nextRoute, gpsStatus:gpsDenied?"DENIED":"CONNECTED", status:gpsDenied?"EMERGENCY AUTOPILOT":"AUTONOMOUS", phase:"NAVIGATING" })
      });
      if (res.ok) { const data=await res.json(); setMissionId(data._id); }
    } catch {}
  };

  const emergencyReturn = () => {
    setRoute((old) => old.length > 1 ? old : [position, HOME]);
    setMissionState("RETURNING");
  };

  const toggleGps = () => {
    setGpsDenied((old) => {
      const next = !old;
      if (next && !["READY","LANDED"].includes(missionState)) setMissionState("EMERGENCY AUTOPILOT");
      return next;
    });
  };

  const selectTarget = () => {
    setPendingTarget({ ...target });
    setPathPoints([]);
    setPathMode("DRONE");
    setTargetSelectionPhase("TARGET");
    setShowTargetMap(true);
  };

  const confirmTarget = () => {
    if (!pendingTarget) return;
    const nextTarget = {
      x:clamp(pendingTarget.x,WORLD.minX,WORLD.maxX),
      y:clamp(pendingTarget.y,30,WORLD.maxY),
      z:clamp(pendingTarget.z,WORLD.minZ,WORLD.maxZ)
    };
    setTarget(nextTarget);
    setPathPoints([]);
    setTargetSelectionPhase("PATH");
  };

  const chooseMapTarget = (event) => {
    if (targetSelectionPhase !== "TARGET") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = clamp((event.clientX-rect.left)/rect.width,0,1);
    const nz = clamp((event.clientY-rect.top)/rect.height,0,1);
    setPendingTarget({
      x:WORLD.minX+nx*(WORLD.maxX-WORLD.minX),
      y:120,
      z:WORLD.minZ+nz*(WORLD.maxZ-WORLD.minZ)
    });
  };

  const generateDronePath = () => {
    if (!pendingTarget) return;
    setPathAnalyzing(true);
    // The deterministic planner represents the drone's remembered map plus
    // simulated vision/depth scan. It creates the actual waypoints; the
    // operator does not choose them.
    window.setTimeout(() => {
      const scanned = scanEnvironment(position, heading, 300);
      setDiscoveredObstacles(scanned.map(o => o.id));
      setScanCount((n) => n + 1);
      const memory = OBSTACLES.filter(o => scanned.some(s => s.id === o.id));
      const planned = createRoute({ ...position }, { ...pendingTarget }, memory.length ? memory : OBSTACLES);
      setPathPoints(planned.slice(1, -1));
      setPathAnalyzing(false); setDiscoveredObstacles([]); setScanCount(0);
    }, 900);
  };

  const chooseManualPathPoint = (event) => {
    if (targetSelectionPhase !== "PATH" || pathMode !== "MANUAL") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = clamp((event.clientX-rect.left)/rect.width,0,1);
    const nz = clamp((event.clientY-rect.top)/rect.height,0,1);
    const point = {
      x:WORLD.minX+nx*(WORLD.maxX-WORLD.minX),
      y:120,
      z:WORLD.minZ+nz*(WORLD.maxZ-WORLD.minZ)
    };
    const last = pathPoints.length ? pathPoints[pathPoints.length-1] : position;
    if (segmentBlocked(last, point)) return;
    setPathPoints((old) => [...old, point]);
  };

  const removeLastPathPoint = () => setPathPoints((old) => old.slice(0,-1));
  const clearPathPoints = () => setPathPoints([]);

  const confirmPath = () => {
    if (!pendingTarget || !pathPoints.length || pathAnalyzing) return;
    const last = pathPoints[pathPoints.length-1];
    if (segmentBlocked(last, pendingTarget)) return;
    const nextRoute = [{ ...position }, ...pathPoints.map((p) => ({ ...p })), { ...pendingTarget }];
    setTarget({ ...pendingTarget });
    setRoute(nextRoute);
    setMissionState("READY");
    setShowTargetMap(false);
    setPendingTarget(null);
    setPathPoints([]);
    setTargetSelectionPhase("TARGET");
  };
  const reset = () => {
    setPosition({ ...HOME }); setEstimatedPosition({ ...HOME }); estimatorRef.current={...HOME,bias:{x:0,y:0,z:0}};
    setHeading(0); setSpeed(0); setBattery(100); setMissionState("READY"); setRoute([]); setSensorError(0); setDetectedObstacle(null); setReplans(0); setMissionId(null); setShowTargetMap(false); setPendingTarget(null); setPathPoints([]); setTargetSelectionPhase("TARGET"); setPathAnalyzing(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div><h1>NAVIGATE-X <span>◈</span></h1><p>GPS-DENIED AUTONOMOUS NAVIGATION • SENSOR ESTIMATION • LIVE MONITORING</p></div>
        <div className={gpsDenied?"gps-badge denied":"gps-badge connected"}>GPS {gpsDenied?"DENIED":"CONNECTED"}</div>
      </header>

      <main className="dashboard">
        <aside className="left-panel">
          <div className="panel-title">MISSION CONTROL</div>
          <div className="mission-card"><span>MISSION</span><strong>GPS-DENIED TEST</strong><small>No GPS coordinates are used by the navigation display when GPS is denied.</small></div>
          <button className="primary-button" onClick={selectTarget}>SELECT TARGET</button>
          <button className="primary-button" onClick={startMission}>START AUTONOMOUS</button>
          <button className="primary-button danger-button" onClick={emergencyReturn}>EMERGENCY RETURN</button>
          <button className="mode" onClick={reset}>RESET MISSION</button>
          <div className="control-card">
            <div className="section-label">NAVIGATION MODE</div>
            <button className={missionState==="AUTONOMOUS"?"mode active":"mode"}>AUTONOMOUS</button>
            <button className={missionState==="EMERGENCY AUTOPILOT"?"mode emergency active":"mode emergency"}>EMERGENCY AUTOPILOT</button>
            <button className={missionState==="RETURNING"?"mode emergency active":"mode emergency"}>RETURN HOME</button>
          </div>
          <div className="control-card">
            <div className="section-label">GPS SIMULATION</div>
            <button className="gps-toggle" onClick={toggleGps}>{gpsDenied?"GPS IS OFF":"GPS IS ON"}</button>
            <small>{gpsDenied?"Sensor-estimated position is active.":"GPS reference is available for comparison."}</small>
          </div>
          <div className="mission-card"><span>SYSTEM MESSAGE</span><strong>{missionState}</strong><small>{missionState==="AUTONOMOUS"?"Following the generated collision-free route.":missionState==="EMERGENCY AUTOPILOT"?"GPS loss detected: autonomous recovery/navigation is active.":missionState==="RETURNING"?"Returning to home using the route logic.":missionState==="LANDED"?"Mission point reached.":"Waiting for mission start."}</small></div>
        </aside>

        <section className="monitor">
          <div className="monitor-head"><div><b>LIVE 3D MONITOR</b><small>Operator view • estimated position • sensor field of view</small></div><div className="monitor-state">● SIMULATION ONLINE</div></div>
          <div className="canvas-wrap">
            <Canvas shadows dpr={[1,1.5]}>
              <color attach="background" args={["#07131c"]}/><fog attach="fog" args={["#07131c",700,3000]}/>
              <Scene position={position} heading={heading} target={target} route={route} detectedObstacle={detectedObstacle} sensorRange={sensorRange} missionState={missionState} speed={speed} discoveredObstacles={discoveredObstacles}/>
              <Engine position={position} heading={heading} missionState={missionState} route={route} target={target} setPosition={setPosition} setHeading={setHeading} setSpeed={setSpeed} setBattery={setBattery} setMissionState={setMissionState} setDetectedObstacle={setDetectedObstacle} setSensorRange={setSensorRange} setRoute={setRoute} setReplans={setReplans} pathMode={pathMode} setDiscoveredObstacles={setDiscoveredObstacles} setScanCount={setScanCount}/>
            </Canvas>
            <div className={speed > 1 ? "view-mode fpv-active" : "view-mode"}>{speed > 1 ? "● DRONE FLIGHT VIEW • FULL DRONE" : "● OPERATOR VIEW • STATIONARY"}</div>
            <div className="monitor-hud"><span>ALT <b>{estimatedPosition.y.toFixed(1)}m</b></span><span>HDG <b>{heading.toFixed(0)}°</b></span><span>GPS <b>{gpsDenied?"DENIED":"CONNECTED"}</b></span></div>
            <div className="route-status"><span>MISSION {missionState}</span><b>{progress.toFixed(1)}% • {distance.toFixed(1)}m TARGET • {route.length} WAYPOINTS</b></div>
          </div>
        </section>

        <aside className="right-panel">
          <div className="panel-title">LIVE TELEMETRY</div>
          <div className="status-card"><span>DRONE STATUS</span><strong>{missionState}</strong><small>Mission ID: {missionId ? missionId.slice(-8) : "LOCAL-ONLY"}</small></div>
          <div className="battery-card"><div><span>BATTERY</span><b>{battery.toFixed(1)}%</b></div><div className="battery-track"><i style={{width:battery+"%"}}/></div><small>Simulated energy consumption</small></div>
          <div className="metrics">
            <Metric label="EST X" value={estimatedPosition.x.toFixed(1)+" m"}/><Metric label="EST Y" value={estimatedPosition.y.toFixed(1)+" m"}/>
            <Metric label="EST Z" value={estimatedPosition.z.toFixed(1)+" m"}/><Metric label="ALTITUDE" value={estimatedPosition.y.toFixed(1)+" m"}/>
            <Metric label="SPEED" value={speed.toFixed(1)+" m/s"}/><Metric label="TARGET DIST." value={distance.toFixed(1)+" m"}/>
            <Metric label="HEADING" value={heading.toFixed(0)+"°"}/><Metric label="MISSION" value={progress.toFixed(1)+"%"}/>
            <Metric label="ROUTE LEN." value={routeDistance.toFixed(0)+" m"}/><Metric label="REPLANS" value={replans}/><Metric label="SCANNED" value={discoveredObstacles.length+" / "+OBSTACLES.length}/>
          </div>
          <div className="sensor-card"><div className="section-label">ONBOARD SENSOR STATUS</div><p><span>IMU / DEAD RECKONING</span><b>● ACTIVE</b></p><p><span>CAMERA</span><b>● ACTIVE</b></p><p><span>DEPTH / LiDAR</span><b>● ACTIVE</b></p><p><span>ALTIMETER</span><b>● ACTIVE</b></p><p><span>POSITION ESTIMATOR</span><b>● ACTIVE</b></p><p><span>GPS</span><b className={gpsDenied?"bad":""}>● {gpsDenied?"DENIED":"CONNECTED"}</b></p></div>
          <div className="accuracy-card"><span>POSITION ESTIMATION ERROR</span><strong>{sensorError.toFixed(2)} m</strong><small>Estimated position is deliberately imperfect; ground truth remains internal to the simulator.</small></div>
          <div className="sensor-card"><div className="section-label">OBSTACLE / SENSOR</div><p><span>DETECTION</span><b>{detectedObstacle||"CLEAR"}</b></p><p><span>SENSOR RANGE</span><b>{sensorRange.toFixed(0)} m</b></p><p><span>MEMORY MAP</span><b>{discoveredObstacles.length} OBJECTS</b></p><p><span>ROUTE PLANNER</span><b>{pathMode==="DRONE"?"VISION + MEMORY":"OPERATOR WAYPOINTS"}</b></p></div>
        </aside>
      </main>

      {showTargetMap && (
        <div className="target-map-overlay">
          <div className="target-map-modal">
            <div className="target-map-head">
              <div>
                <b>{targetSelectionPhase === "TARGET" ? "STEP 1 • SELECT TARGET" : "STEP 2 • PATH PLANNING"}</b>
                <small>{targetSelectionPhase === "TARGET" ? "SELECT THE DESTINATION — NO XYZ COORDINATES" : "CHOOSE WHO CREATES THE ROUTE"}</small>
              </div>
              <button className="map-close" onClick={() => {
                setShowTargetMap(false); setPendingTarget(null); setPathPoints([]);
                setTargetSelectionPhase("TARGET"); setPathAnalyzing(false);
              }}>×</button>
            </div>

            {targetSelectionPhase === "TARGET" ? (
              <>
                <div className="target-map" onClick={chooseMapTarget}>
                  <div className="map-grid large" />
                  {OBSTACLES.map((o)=><span key={o.id} className="map-obstacle" style={{
                    left:((o.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",
                    top:((o.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%",
                    width:(o.sx/(WORLD.maxX-WORLD.minX))*100+"%",
                    height:(o.sz/(WORLD.maxZ-WORLD.minZ))*100+"%"
                  }} />)}
                  <span className="map-home" style={{left:((HOME.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",top:((HOME.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%"}} />
                  {pendingTarget && <span className="map-target pending" style={{left:((pendingTarget.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",top:((pendingTarget.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%"}} />}
                  <div className="map-label top">3 KM SIMULATION AREA</div>
                  <div className="map-label bottom">CLICK ANYWHERE TO PLACE TARGET</div>
                </div>
                <div className="target-map-actions">
                  <span>{pendingTarget ? "TARGET SELECTED" : "NO TARGET SELECTED"}</span>
                  <button className="mode" onClick={() => {setShowTargetMap(false);setPendingTarget(null);}}>CANCEL</button>
                  <button className="primary-button" disabled={!pendingTarget} onClick={confirmTarget}>CONFIRM TARGET</button>
                </div>
              </>
            ) : (
              <>
                <div className="path-mode-selector">
                  <button className={pathMode==="DRONE" ? "path-mode active" : "path-mode"} onClick={() => {setPathMode("DRONE");setPathPoints([]);}}>
                    <b>🤖 MADE BY DRONE</b><small>Drone vision + remembered map automatically analyzes obstacles and creates the safest route.</small>
                  </button>
                  <button className={pathMode==="MANUAL" ? "path-mode active" : "path-mode"} onClick={() => {setPathMode("MANUAL");setPathPoints([]);}}>
                    <b>👤 CREATE PATH BY YOU</b><small>You choose each waypoint on the map. The drone follows your selected points.</small>
                  </button>
                </div>

                <div className="target-map path-map" onClick={pathMode === "MANUAL" ? chooseManualPathPoint : undefined}>
                  <div className="map-grid large" />
                  {OBSTACLES.map((o)=><span key={o.id} className="map-obstacle" style={{
                    left:((o.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",
                    top:((o.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%",
                    width:(o.sx/(WORLD.maxX-WORLD.minX))*100+"%",
                    height:(o.sz/(WORLD.maxZ-WORLD.minZ))*100+"%"
                  }} />)}
                  <span className="map-home" style={{left:((HOME.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",top:((HOME.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%"}} />
                  <span className="map-target pending" style={{left:((pendingTarget.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",top:((pendingTarget.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%"}} />
                  {pathPoints.map((p,i)=><span key={i} className="map-waypoint" style={{
                    left:((p.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",
                    top:((p.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%"
                  }}><b>{i+1}</b></span>)}
                  {pathPoints.length > 0 && pathPoints.map((p,i) => {
                    const a = i === 0 ? position : pathPoints[i-1];
                    return <span key={"line-"+i} className="map-path-segment" style={{
                      left:((a.x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*100+"%",
                      top:((a.z-WORLD.minZ)/(WORLD.maxZ-WORLD.minZ))*100+"%",
                      width:(Math.hypot(
                        ((p.x-a.x)/(WORLD.maxX-WORLD.minX))*100,
                        ((p.z-a.z)/(WORLD.maxZ-WORLD.minZ))*100
                      ))+"%",
                      transform:"rotate("+Math.atan2(
                        ((p.z-a.z)/(WORLD.maxZ-WORLD.minZ)),
                        ((p.x-a.x)/(WORLD.maxX-WORLD.minX))
                      )*180/Math.PI+"deg)"
                    }} />;
                  })}
                  <div className="map-label top">{pathMode==="DRONE" ? (pathAnalyzing ? "DRONE VISION ANALYZING..." : "AUTOMATIC SENSOR + MEMORY ROUTE") : "OPERATOR WAYPOINT MODE"}</div>
                  <div className="map-label bottom">{pathMode==="DRONE" ? "DRONE WILL CREATE ALL ROUTE POINTS" : "CLICK TO ADD WAYPOINTS"}</div>
                </div>

                <div className="target-map-actions">
                  <span>{pathMode==="DRONE" ? (pathAnalyzing ? "SCANNING OBSTACLES • ANALYZING ROUTE..." : (pathPoints.length ? pathPoints.length+" DRONE-GENERATED WAYPOINTS" : "READY TO ANALYZE")) : pathPoints.length+" OPERATOR WAYPOINTS"}</span>
                  {pathMode==="MANUAL" && <button className="mode" onClick={removeLastPathPoint} disabled={!pathPoints.length}>UNDO</button>}
                  {pathMode==="MANUAL" && <button className="mode" onClick={clearPathPoints} disabled={!pathPoints.length}>CLEAR</button>}
                  {pathMode==="DRONE" && <button className="mode" onClick={generateDronePath} disabled={pathAnalyzing}>ANALYZE & CREATE PATH</button>}
                  <button className="primary-button" disabled={!pathPoints.length || pathAnalyzing} onClick={confirmPath}>CONFIRM PATH</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <section className="bottom-monitor">
        <div><div className="panel-title">MISSION MONITOR • FULL AREA</div><MiniMap position={position} target={target} route={route}/></div>
        <div className="mission-stats">
          <Metric label="HOME" value={`X 0 / Y 30 / Z 0`}/><Metric label="TARGET" value={`X ${target.x.toFixed(0)} / Y ${target.y.toFixed(0)} / Z ${target.z.toFixed(0)}`}/>
          <Metric label="PLANNED ROUTE" value={route.length? "READY":"NOT GENERATED"}/><Metric label="GPS MODE" value={gpsDenied?"GPS-DENIED":"GPS REFERENCE"}/>
        </div>
      </section>
    </div>
  );
}
