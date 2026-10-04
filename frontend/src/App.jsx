import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

const WORLD_SIZE = 3000;\nconst HOME = { x: 0, y: 4, z: 0 };
const TARGET = { x: 1400, y: 100, z: -1100 };

const START_PAD = { x: 0, y: 2, z: 0 };\n\nconst OBSTACLES = [
  { x: 130, y: 35, z: -40, sx: 70, sy: 70, sz: 70 },
  { x: 245, y: 55, z: -140, sx: 90, sy: 110, sz: 55 },
  { x: 320, y: 45, z: 70, sx: 100, sy: 90, sz: 80 },
  { x: 390, y: 60, z: -30, sx: 55, sy: 120, sz: 55 }
];

function Obstacle({ o }) {
  return (
    <mesh position={[o.x, o.y, o.z]} castShadow>
      <boxGeometry args={[o.sx, o.sy, o.sz]} />
      <meshStandardMaterial color="#7d4d3d" roughness={0.85} />
    </mesh>
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
      if (p && flying) p.rotation.y += dt * 35;
    });
  });

  const arms = [
    [-1.65, 0, -1.05],
    [1.65, 0, -1.05],
    [-1.65, 0, 1.05],
    [1.65, 0, 1.05]
  ];

  return (
    <group ref={group} position={[position.x, position.y, position.z]}>
      <mesh castShadow>
        <boxGeometry args={[3.6, 0.65, 2.4]} />
        <meshStandardMaterial color="#202a32" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.45, 20, 14]} />
        <meshStandardMaterial color="#111820" metalness={0.9} />
      </mesh>
      {arms.map((a, i) => (
        <group key={i} position={a}>
          <mesh>
            <boxGeometry args={[2.5, 0.16, 0.25]} />
            <meshStandardMaterial color="#39444d" metalness={0.7} />
          </mesh>
          <mesh position={[i % 2 ? 1.15 : -1.15, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.5, 12]} />
            <meshStandardMaterial color="#242d34" />
          </mesh>
          <mesh
            ref={(el) => (props.current[i] = el)}
            position={[i % 2 ? 1.15 : -1.15, 0.5, 0]}
          >
            <boxGeometry args={[2.0, 0.05, 0.12]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, -0.7, -1.2]} intensity={3} distance={12} color="#42e8ff" />
    </group>
  );
}

function Marker({ point, color, label }) {
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
      <PerspectiveCamera makeDefault position={[180, 150, 280]} fov={55} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[100, 250, 100]} intensity={2.5} castShadow />
      <Grid args={[WORLD_SIZE, WORLD_SIZE]} position={[0, 0, 0]} cellSize={25} sectionSize={150} fadeDistance={2200} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#20362a" roughness={1} />
      </mesh>
      {OBSTACLES.map((o, i) => <Obstacle key={i} o={o} />)}
      <Marker point={HOME} color="#ffd34d" label="HOME" />
      <Marker point={TARGET} color="#4dff9a" label="TARGET" />
      <Drone position={position} heading={heading} flying={flying} />
      <OrbitControls enableDamping dampingFactor={0.08} />
    </>
  );
}

function ControlButton({ children, onDown, onUp, wide = false, danger = false }) {
  return (
    <button
      className={`control-button ${wide ? "wide" : ""} ${danger ? "danger" : ""}`}
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
  const [position, setPosition] = useState(HOME);
  const [mode, setMode] = useState("MANUAL");
  const [status, setStatus] = useState("READY");
  const [phase, setPhase] = useState("ON GROUND");
  const [battery, setBattery] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [gps, setGps] = useState(true);
  const [message, setMessage] = useState("Select a flight mode and take off.");
  const [missionProgress, setMissionProgress] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [emergencyRunning, setEmergencyRunning] = useState(false);
  const motion = useRef({ x: 0, y: 0, z: 0 });
  const keys = useRef(new Set());
  const autoRef = useRef(false);
  const emergencyRef = useRef(false);
  const lastTime = useRef(performance.now());

  const flying = position.y > 4.5;

  const distanceToTarget = useMemo(
    () => Math.hypot(position.x - TARGET.x, position.y - TARGET.y, position.z - TARGET.z),
    [position]
  );

  const setMotion = (x, y, z) => {
    motion.current = { x, y, z };
    setSpeed(Math.round(Math.hypot(x, y, z)));
  };

  const takeOff = () => {
    if (flying) return;
    autoRef.current = false;
    emergencyRef.current = false;
    setAutoRunning(false);
    setEmergencyRunning(false);
    setMode("MANUAL");
    setStatus("TAKE OFF");
    setPhase("ASCENDING");
    setMessage("Drone taking off...");
    setPosition((p) => ({ ...p, y: 45 }));
    setSpeed(18);
    setTimeout(() => {
      setStatus("AIRBORNE");
      setPhase("MANUAL CONTROL");
      setMessage("Drone is airborne. Use W A S D or the controls.");
      setSpeed(0);
    }, 700);
  };

  const land = () => {
    autoRef.current = false;
    emergencyRef.current = false;
    setAutoRunning(false);
    setEmergencyRunning(false);
    setMotion(0, 0, 0);
    setStatus("LANDING");
    setPhase("DESCENDING");
    setMessage("Landing...");
    setPosition((p) => ({ ...p, y: 4 }));
    setTimeout(() => {
      setStatus("LANDED");
      setPhase("ON GROUND");
      setSpeed(0);
      setMessage("Drone successfully landed.");
    }, 600);
  };

  const manual = (x, y, z) => {
    if (!flying) {
      setMessage("Press TAKE OFF first.");
      return;
    }
    autoRef.current = false;
    emergencyRef.current = false;
    setAutoRunning(false);
    setEmergencyRunning(false);
    setMode("MANUAL");
    setStatus("MANUAL FLIGHT");
    setPhase("REMOTE CONTROL");
    setMotion(x, y, z);
  };

  const startAuto = () => {
    if (!flying) {
      setMessage("Press TAKE OFF first.");
      return;
    }
    emergencyRef.current = false;
    autoRef.current = true;
    setEmergencyRunning(false);
    setAutoRunning(true);
    setMode("AUTOPILOT");
    setStatus("AUTOPILOT ACTIVE");
    setPhase("PATH FOLLOWING");
    setMessage("Autopilot is calculating and following a safe route.");
  };

  const startEmergency = () => {
    emergencyRef.current = true;
    autoRef.current = true;
    setEmergencyRunning(true);
    setAutoRunning(true);
    setMode("EMERGENCY AUTOPILOT");
    setGps(false);
    setStatus("EMERGENCY AUTOPILOT");
    setPhase("GPS DENIED / SENSOR NAVIGATION");
    setMessage("GPS lost. Emergency autopilot is navigating to the target.");
    if (!flying) setPosition((p) => ({ ...p, y: 55 }));
  };

  useEffect(() => {
    const down = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
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
            emergencyRef.current = false;
            setAutoRunning(false);
            setEmergencyRunning(false);
            setStatus("TARGET REACHED");
            setPhase("HOVER AT TARGET");
            setSpeed(0);
            setMissionProgress(100);
            setMessage("Target reached. Drone is holding position.");
            return { ...p, ...TARGET };
          }
          const step = Math.min(42 * dt, d);
          setSpeed(Math.round(step / Math.max(dt, 0.01)));
          setMissionProgress(Math.max(0, Math.min(100, 100 * (1 - d / Math.hypot(TARGET.x - HOME.x, TARGET.y - HOME.y, TARGET.z - HOME.z)))));
          return {
            x: p.x + (dx / d) * step,
            y: p.y + (dy / d) * step,
            z: p.z + (dz / d) * step
          };
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

  const stop = () => {
    autoRef.current = false;
    emergencyRef.current = false;
    setAutoRunning(false);
    setEmergencyRunning(false);
    setMotion(0, 0, 0);
    setSpeed(0);
    setStatus(flying ? "HOVER" : "READY");
    setPhase(flying ? "HOLD POSITION" : "ON GROUND");
    setMessage("Movement stopped.");
  };

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
              <ControlButton onDown={() => manual(0, 0, -1)} onUp={stop}>W</ControlButton>
              <ControlButton onDown={() => manual(-1, 0, 0)} onUp={stop}>A</ControlButton>
              <ControlButton onDown={() => manual(0, 0, 1)} onUp={stop}>S</ControlButton>
              <ControlButton onDown={() => manual(1, 0, 0)} onUp={stop}>D</ControlButton>
            </div>
            <p className="help">W = FORWARD · S = BACK · A = LEFT · D = RIGHT</p>
          </div>

          <div className="control-section">
            <div className="section-label">ALTITUDE</div>
            <div className="two-buttons">
              <ControlButton onDown={() => manual(0, 1, 0)} onUp={stop}>ALT ↑</ControlButton>
              <ControlButton onDown={() => manual(0, -1, 0)} onUp={stop}>ALT ↓</ControlButton>
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
              <small>LIVE SIMULATION / OBSTACLE ENVIRONMENT</small>
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
            <div className="target-badge">TARGET {Math.round(TARGET.x)}, {Math.round(TARGET.y)}, {Math.round(TARGET.z)}</div>
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
