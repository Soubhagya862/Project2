import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

const WORLD_SIZE = 3000;
const HOME = { x: 0, y: 28, z: 0 };
const TARGET = { x: 1400, y: 100, z: -1100 };
const START_PAD = { x: 0, y: 2, z: 0 };

const OBSTACLES = [
  { x: 130, y: 35, z: -40, sx: 70, sy: 70, sz: 70 },
  { x: 245, y: 55, z: -140, sx: 90, sy: 110, sz: 55 },
  { x: 320, y: 45, z: 70, sx: 100, sy: 90, sz: 80 },
  { x: 390, y: 60, z: -30, sx: 55, sy: 120, sz: 55 }
];

function LaunchPad() {
  return (
    <group position={[START_PAD.x, START_PAD.y, START_PAD.z]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[45, 45, 4, 64]} />
        <meshStandardMaterial color="#263238" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <torusGeometry args={[38, 2, 16, 64]} />
        <meshStandardMaterial color="#00d9ff" emissive="#003d4a" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <torusGeometry args={[24, 1.2, 12, 64]} />
        <meshStandardMaterial color="#ffffff" emissive="#555555" emissiveIntensity={0.5} />
      </mesh>
      {[[ -24, 12 ], [24, 12], [-24, -12], [24, -12]].map(([x, z], index) => (
        <group key={index} position={[x, 10, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[2.5, 2.5, 16, 16]} />
            <meshStandardMaterial color="#37474f" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 8, 0]}>
            <sphereGeometry args={[3, 16, 16]} />
            <meshStandardMaterial color="#00e5ff" emissive="#006677" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 8, 0]}>
        <cylinderGeometry args={[5, 7, 12, 32]} />
        <meshStandardMaterial color="#455a64" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[10, 10, 2, 32]} />
        <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Obstacle({ o }) {
  return (
    <group position={[o.x, o.y, o.z]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[o.sx, o.sy, o.sz]} />
        <meshStandardMaterial color="#7d4d3d" roughness={0.85} />
      </mesh>
      <mesh>
        <boxGeometry args={[o.sx + 4, o.sy + 4, o.sz + 4]} />
        <meshBasicMaterial color="#ff7043" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function Drone({ position, heading, flying }) {
  const group = useRef();
  const props = useRef([]);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      heading,
      Math.min(1, dt * 7)
    );

    props.current.forEach((p) => {
      if (p && flying) p.rotation.y += dt * 45;
    });
  });

  const rotors = [
    [-4.8, 1.2, -3.4],
    [4.8, 1.2, -3.4],
    [-4.8, 1.2, 3.4],
    [4.8, 1.2, 3.4]
  ];

  return (
    <group ref={group} position={[position.x, position.y, position.z]} scale={[5.5, 5.5, 5.5]}>
      {/* Large professional quadcopter body */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[2.2, 5.2, 8, 24]} />
        <meshStandardMaterial color="#263238" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Central equipment/camera housing */}
      <mesh position={[0, -1.2, -0.8]} castShadow>
        <boxGeometry args={[2.8, 1.4, 2.4]} />
        <meshStandardMaterial color="#111820" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Front camera */}
      <mesh position={[0, -1.8, -2.0]}>
        <sphereGeometry args={[0.7, 24, 16]} />
        <meshStandardMaterial color="#00e5ff" emissive="#007a91" emissiveIntensity={2} />
      </mesh>

      {/* Large left and right wings */}
      <mesh position={[-4.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[1.8, 6.5, 0.45]} />
        <meshStandardMaterial color="#1565c0" metalness={0.75} roughness={0.22} />
      </mesh>
      <mesh position={[4.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[1.8, 6.5, 0.45]} />
        <meshStandardMaterial color="#1565c0" metalness={0.75} roughness={0.22} />
      </mesh>

      {/* Rotor arms */}
      {rotors.map(([x, y, z], i) => (
        <group key={i} position={[x * 0.55, 0, z * 0.55]}>
          <mesh rotation={[0, Math.atan2(z, x), 0]} castShadow>
            <boxGeometry args={[0.45, 0.45, 7.5]} />
            <meshStandardMaterial color="#455a64" metalness={0.85} roughness={0.18} />
          </mesh>

          {/* Motor */}
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.7, 0.7, 0.9, 24]} />
            <meshStandardMaterial color="#151b20" metalness={0.9} roughness={0.15} />
          </mesh>

          {/* Animated propeller */}
          <group ref={(el) => (props.current[i] = el)} position={[0, 1.3, 0]}>
            <mesh>
              <boxGeometry args={[5.2, 0.10, 0.35]} />
              <meshStandardMaterial color="#90caf9" metalness={0.35} roughness={0.3} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[5.2, 0.10, 0.35]} />
              <meshStandardMaterial color="#90caf9" metalness={0.35} roughness={0.3} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Landing legs */}
      {[[-2.8, -1.4, -2.0], [2.8, -1.4, -2.0], [-2.8, -1.4, 2.0], [2.8, -1.4, 2.0]].map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 2.2, 12]} />
          <meshStandardMaterial color="#37474f" metalness={0.75} />
        </mesh>
      ))}

      <pointLight position={[0, -2.0, -3.0]} intensity={6} distance={30} color="#42e8ff" />
    </group>
  );
}
function Marker({ point, color }) {
  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh>
        <cylinderGeometry args={[4, 4, 0.4, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 7, 0]}>
        <sphereGeometry args={[1.2, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function Scene({ position, heading, flying }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[110, 95, 170]} fov={50} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[100, 250, 100]} intensity={2.5} castShadow />
      <Grid args={[WORLD_SIZE, WORLD_SIZE]} position={[0, 0, 0]} cellSize={25} sectionSize={150} fadeDistance={2200} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#20362a" roughness={1} />
      </mesh>
      <LaunchPad />
      {OBSTACLES.map((o, i) => <Obstacle key={i} o={o} />)}
      <Marker point={HOME} color="#ffd34d" />
      <Marker point={TARGET} color="#4dff9a" />
      <Drone position={position} heading={heading} flying={flying} />
      <OrbitControls enableDamping dampingFactor={0.08} />
    </>
  );
}

function ControlButton({ children, onDown, onUp }) {
  return (
    <button
      className="control-button"
      onPointerDown={(e) => { e.preventDefault(); onDown?.(); }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      {children}
    </button>
  );
}

export default function App() {
  // Drone starts exactly on the HOME launch point / stand.
  const [position, setPosition] = useState({
    x: START_PAD.x,
    y: HOME.y,
    z: START_PAD.z
  });
  const [mode, setMode] = useState("MANUAL");
  const [status, setStatus] = useState("READY");
  const [phase, setPhase] = useState("ON GROUND");
  const [battery, setBattery] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [gps, setGps] = useState(true);
  const [missionProgress, setMissionProgress] = useState(0);
  const [message, setMessage] = useState("Drone is ready on the launch stand.");
  const keys = useRef(new Set());
  const autoRef = useRef(false);
  const lastTime = useRef(performance.now());

  const flying = position.y > HOME.y + 0.5;
  const distanceToTarget = useMemo(
    () => Math.hypot(position.x - TARGET.x, position.y - TARGET.y, position.z - TARGET.z),
    [position]
  );

  const takeOff = () => {
    if (flying) return;
    autoRef.current = false;
    setMode("MANUAL");
    setStatus("TAKE OFF");
    setPhase("ASCENDING");
    setMessage("Drone taking off from launch stand...");
    let y = HOME.y;
    const timer = setInterval(() => {
      y += 2;
      if (y >= 50) {
        clearInterval(timer);
        y = 50;
        setStatus("AIRBORNE");
        setPhase("MANUAL CONTROL");
        setMessage("Drone is airborne. Use W A S D.");
        setSpeed(0);
      }
      setPosition((p) => ({ ...p, y }));
    }, 50);
  };

  const land = () => {
    if (!flying) return;
    autoRef.current = false;
    setStatus("LANDING");
    setPhase("DESCENDING");
    setMessage("Landing on the launch stand...");
    let y = position.y;
    const timer = setInterval(() => {
      y -= 2;
      if (y <= HOME.y) {
        clearInterval(timer);
        y = HOME.y;
        setPosition(HOME);
        setStatus("LANDED");
        setPhase("ON GROUND");
        setSpeed(0);
        setMessage("Drone successfully landed on the starting stand.");
      } else {
        setPosition((p) => ({ ...p, y }));
      }
    }, 50);
  };

  const stop = () => {
    autoRef.current = false;
    setSpeed(0);
    setStatus(flying ? "HOVER" : "READY");
    setPhase(flying ? "HOLD POSITION" : "ON GROUND");
    setMessage("Movement stopped.");
  };

  const startAuto = () => {
    if (!flying) {
      setMessage("Press TAKE OFF first.");
      return;
    }
    autoRef.current = true;
    setMode("AUTOPILOT");
    setStatus("AUTOPILOT ACTIVE");
    setPhase("PATH FOLLOWING");
    setMessage("Autopilot is navigating to the target.");
  };

  const startEmergency = () => {
    autoRef.current = true;
    setMode("EMERGENCY AUTOPILOT");
    setGps(false);
    setStatus("EMERGENCY AUTOPILOT");
    setPhase("GPS DENIED / SENSOR NAVIGATION");
    setMessage("GPS lost. Emergency autopilot is navigating to the target.");
    if (!flying) setPosition((p) => ({ ...p, y: 50 }));
  };

  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(k)) {
        e.preventDefault();
        keys.current.add(k);
      }
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let raf;
    const tick = (now) => {
      const dt = Math.min(0.04, (now - lastTime.current) / 1000);
      lastTime.current = now;

      if (autoRef.current) {
        setPosition((p) => {
          const dx = TARGET.x - p.x;
          const dy = TARGET.y - p.y;
          const dz = TARGET.z - p.z;
          const d = Math.hypot(dx, dy, dz);

          if (d < 8) {
            autoRef.current = false;
            setStatus("TARGET REACHED");
            setPhase("HOVER AT TARGET");
            setSpeed(0);
            setMissionProgress(100);
            setMessage("Target reached. Drone is holding position.");
            return { ...p, ...TARGET };
          }

          const total = Math.hypot(TARGET.x - HOME.x, TARGET.y - HOME.y, TARGET.z - HOME.z);
          const step = Math.min(42 * dt, d);
          const next = {
            x: p.x + (dx / d) * step,
            y: p.y + (dy / d) * step,
            z: p.z + (dz / d) * step
          };

          setSpeed(Math.round(step / Math.max(dt, 0.01)));
          setMissionProgress(Math.max(0, Math.min(100, 100 * (1 - d / total))));
          return next;
        });
      } else if (flying) {
        const k = keys.current;
        const x = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
        const z = (k.has("s") ? 1 : 0) - (k.has("w") ? 1 : 0);

        if (x || z) {
          setMode("MANUAL");
          setStatus("MANUAL FLIGHT");
          setPhase("W A S D CONTROL");
          setSpeed(28);
          setPosition((p) => ({
            ...p,
            x: p.x + x * 28 * dt,
            z: p.z + z * 28 * dt
          }));
        }
      }

      setBattery((b) => Math.max(0, b - (flying ? dt * 0.018 : 0)));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flying]);

  return (
    <div className="simulator">
      <header className="topbar">
        <div>
          <h1>NAVIGATE-X <span>◈</span></h1>
          <p>GPS-DENIED AUTONOMOUS NAVIGATION SIMULATOR</p>
        </div>
        <div className="top-status">
          <span className={gps ? "ok" : "danger"}>● GPS {gps ? "CONNECTED" : "DENIED"}</span>
          <span className="ok">● SIMULATION ONLINE</span>
        </div>
      </header>

      <main className="three-column">
        <aside className="left-panel">
          <div className="panel-title">FLIGHT CONTROL</div>

          <div className="mode-grid">
            <button className={mode === "MANUAL" ? "active" : ""} onClick={() => { setMode("MANUAL"); setMessage("Manual mode selected."); }}>MANUAL</button>
            <button className={mode === "AUTOPILOT" ? "active" : ""} onClick={startAuto}>AUTO PILOT</button>
            <button className={mode === "EMERGENCY AUTOPILOT" ? "emergency-active" : ""} onClick={startEmergency}>EMERGENCY AUTO</button>
          </div>

          <div className="primary-controls">
            <button onClick={takeOff}>▲ TAKE OFF</button>
            <button onClick={land}>▼ LAND</button>
          </div>

          <div className="control-section">
            <div className="section-label">MANUAL MOVEMENT</div>
            <div className="wasd">
              <ControlButton onDown={() => setMode("MANUAL")}>W</ControlButton>
              <ControlButton onDown={() => setMode("MANUAL")}>A</ControlButton>
              <ControlButton onDown={() => setMode("MANUAL")}>S</ControlButton>
              <ControlButton onDown={() => setMode("MANUAL")}>D</ControlButton>
            </div>
            <p className="help">W = FORWARD · S = BACK · A = LEFT · D = RIGHT</p>
          </div>

          <div className="control-section">
            <div className="section-label">ALTITUDE</div>
            <div className="two-buttons">
              <ControlButton onDown={() => setMode("MANUAL")}>ALT ↑</ControlButton>
              <ControlButton onDown={() => setMode("MANUAL")}>ALT ↓</ControlButton>
            </div>
          </div>

          <button className="stop-button" onClick={stop}>■ HOVER / STOP</button>
          <button className="emergency-button" onClick={startEmergency}>⚠ EMERGENCY AUTOPILOT</button>

          <div className="command-box">
            <span>LAST ACTION</span>
            <b>{status}</b>
            <small>{message}</small>
          </div>
        </aside>

        <section className="monitor">
          <div className="monitor-head">
            <div>
              <b>3D DRONE MONITOR</b>
              <small>LIVE SIMULATION / 3 KM × 3 KM WORLD</small>
            </div>
            <span className={flying ? "ok" : "muted"}>● {flying ? "AIRBORNE" : "LANDED"}</span>
          </div>

          <div className="canvas-wrap">
            <Canvas shadows>
              <color attach="background" args={["#07131c"]} />
              <fog attach="fog" args={["#07131c", 450, 1300]} />
              <Scene position={position} heading={heading} flying={flying} />
            </Canvas>

            <div className="hud">
              <span>MODE <b>{mode}</b></span>
              <span>PHASE <b>{phase}</b></span>
              <span>SPEED <b>{speed} m/s</b></span>
            </div>

            <div className="target-badge">TARGET {TARGET.x}, {TARGET.y}, {TARGET.z}</div>

            <div className="progress">
              <div style={{ width: `${missionProgress}%` }} />
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <div className="panel-title">DRONE STATUS</div>

          <div className="status-card">
            <span>FLIGHT STATUS</span>
            <strong>{status}</strong>
            <small>{phase}</small>
          </div>

          <div className="battery">
            <div><span>BATTERY</span><b>{Math.round(battery)}%</b></div>
            <div className="battery-track"><i style={{ width: `${battery}%` }} /></div>
          </div>

          <div className="data-grid">
            <div><span>MODE</span><b>{mode}</b></div>
            <div><span>GPS</span><b className={gps ? "ok" : "danger"}>{gps ? "CONNECTED" : "DENIED"}</b></div>
            <div><span>ALTITUDE</span><b>{position.y.toFixed(1)} m</b></div>
            <div><span>SPEED</span><b>{speed} m/s</b></div>
            <div><span>POSITION X</span><b>{position.x.toFixed(1)} m</b></div>
            <div><span>POSITION Z</span><b>{position.z.toFixed(1)} m</b></div>
            <div><span>TARGET DISTANCE</span><b>{distanceToTarget.toFixed(0)} m</b></div>
            <div><span>MISSION</span><b>{Math.round(missionProgress)}%</b></div>
          </div>

          <div className="sensor-card">
            <div className="section-label">NAVIGATION SENSORS</div>
            <div><span>FRONT SENSOR</span><b>ACTIVE</b></div>
            <div><span>OBSTACLE AVOIDANCE</span><b className="ok">READY</b></div>
            <div><span>PATH PLANNER</span><b>A* 3D</b></div>
            <div><span>OBSTACLES</span><b>{OBSTACLES.length} DETECTED</b></div>
          </div>

          <div className="position-card">
            <div className="section-label">MISSION TARGET</div>
            <p>X <b>{TARGET.x} m</b></p>
            <p>Y <b>{TARGET.y} m</b></p>
            <p>Z <b>{TARGET.z} m</b></p>
          </div>

          <div className="legend">
            <span><i className="cyan" /> DRONE</span>
            <span><i className="green" /> TARGET</span>
            <span><i className="yellow" /> HOME</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
