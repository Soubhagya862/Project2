import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

function Device() {
  return (
    <mesh position={[0, 2, 0]}>
      <boxGeometry args={[2, 0.7, 2]} />
      <meshStandardMaterial color="#2563eb" />
    </mesh>
  );
}

function World() {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 15, 10]} intensity={2} />
      <Grid args={[100, 100]} cellSize={1} sectionSize={5} />
      <Device />
    </>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>NAVIGATE-X</h1>
          <p>GPS-Denied Autonomous Navigation System</p>
        </div>
        <span className="status">SYSTEM READY</span>
      </header>

      <main className="dashboard">
        <section className="simulation">
          <Canvas camera={{ position: [12, 10, 12], fov: 50 }}>
            <World />
            <OrbitControls />
          </Canvas>
        </section>

        <aside className="panel">
          <h2>Live Monitoring</h2>
          <div className="metric"><span>Position X</span><strong>0.0</strong></div>
          <div className="metric"><span>Altitude Y</span><strong>2.0</strong></div>
          <div className="metric"><span>Position Z</span><strong>0.0</strong></div>
          <div className="metric"><span>Speed</span><strong>0.0 m/s</strong></div>
          <div className="metric"><span>GPS</span><strong className="gps">CONNECTED</strong></div>
          <div className="metric"><span>Flight State</span><strong>STANDBY</strong></div>

          <h2>Mission</h2>
          <button>START AUTONOMOUS MISSION</button>
          <button className="secondary">DISCONNECT GPS</button>
        </aside>
      </main>
    </div>
  );
}