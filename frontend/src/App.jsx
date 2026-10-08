import { useState } from "react";

const environments = ["Mountain Caves", "Forest", "Plain"];

function App() {
  const [environment, setEnvironment] = useState(environments[0]);
  const [mode, setMode] = useState("MANUAL");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GPS-DENIED AUTONOMOUS NAVIGATION</p>
          <h1>NAVIGATE-X</h1>
        </div>
        <div className="status-pill">SYSTEM READY</div>
      </header>

      <section className="dashboard">
        <aside className="panel controller">
          <h2>Controller</h2>

          <label>
            Environment
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
              {environments.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <div className="field-label">Flight mode</div>
          <div className="mode-grid">
            {["MANUAL", "AI", "EMERGENCY"].map((item) => (
              <button
                key={item}
                className={mode === item ? "active" : ""}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="control-row">
            <button>TAKE OFF</button>
            <button>LAND</button>
          </div>

          <div className="controller-pad" aria-label="Manual controller preview">
            <button>▲</button>
            <div>
              <button>◀</button>
              <span>DRONE</span>
              <button>▶</button>
            </div>
            <button>▼</button>
          </div>

          <p className="hint">Manual controls will be connected to the 3D drone in the next build step.</p>
        </aside>

        <section className="panel viewport">
          <div className="viewport-header">
            <div>
              <span className="badge">{environment}</span>
              <h2>3D Navigation World</h2>
            </div>
            <div className="telemetry-mini">GPS: DENIED · VPS: ACTIVE</div>
          </div>
          <div className="world-placeholder">
            <div className="mountain-shape" />
            <div className="drone-marker">✦</div>
            <div className="world-label">3D WORLD ENGINE</div>
            <div className="world-subtitle">5 km × 5 km simulation will be connected next</div>
          </div>
        </section>

        <aside className="panel telemetry">
          <h2>Telemetry</h2>
          <div className="metric"><span>GPS</span><strong className="danger">DENIED</strong></div>
          <div className="metric"><span>VPS</span><strong className="success">ACTIVE</strong></div>
          <div className="metric"><span>Mode</span><strong>{mode}</strong></div>
          <div className="metric"><span>Altitude</span><strong>2 m</strong></div>
          <div className="metric"><span>Speed</span><strong>0 m/s</strong></div>
          <div className="metric"><span>Night Vision</span><strong>{environment === "Mountain Caves" ? "READY" : "STANDBY"}</strong></div>
          <div className="metric"><span>Mission</span><strong>READY</strong></div>
        </aside>
      </section>
    </main>
  );
}

export default App;
