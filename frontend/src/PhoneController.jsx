import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./phone.css";

function getLanBackendUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL?.trim();

  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }

  return `http://${window.location.hostname}:5000`;
}

const SOCKET_URL = getLanBackendUrl();

const COMMAND_API = (() => {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (
    configured &&
    !configured.includes("localhost") &&
    !configured.includes("127.0.0.1")
  ) {
    return configured.endsWith("/")
      ? configured.slice(0, -1)
      : configured;
  }

  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
})();

const IS_BRIDGE = window.location.pathname === "/phone";

const DEFAULT_TARGET = {
  x: 700,
  y: 60,
  z: 450,
};

const KEY_COMMANDS = {
  w: "UP",
  s: "DOWN",
  a: "LEFT",
  d: "RIGHT",
  q: "YAW_LEFT",
  e: "YAW_RIGHT",
  ArrowUp: "ASCEND",
  ArrowDown: "DESCEND",
};

export default function PhoneController() {
  const socketRef = useRef(null);
  const joystickRef = useRef(null);
  const joystickActiveRef = useRef(false);
  const joystickVectorRef = useRef({ x: 0, y: 0 });
  const joystickTimerRef = useRef(null);
  const buttonTimerRef = useRef(null);
  const buttonCommandRef = useRef("");
  const lastJoystickCommandRef = useRef("");
  const targetPendingRef = useRef(false);
  const keyboardRef = useRef(new Set());

  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState("HOVER");
  const [confirmed, setConfirmed] = useState(false);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [battery, setBattery] = useState(100);

  const [telemetry, setTelemetry] = useState({
    x: 0,
    y: 2,
    z: 0,
    speed: 0,
    heading: 0,
    gps: "CONNECTED",
    status: "READY",
    phase: "IDLE",
    mode: "MANUAL",
    target: DEFAULT_TARGET,
    distanceToTarget: 0,
    sensorDistance: 18,
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);

      socket.emit("register-client", {
        role: IS_BRIDGE ? "bridge" : "controller",
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleControllerCommand = (payload) => {
      if (IS_BRIDGE && payload?.command) {
        socket.emit("bridge-control", payload.command);
      }
    };

    const handleTelemetry = (data) => {
      if (!data) return;

      setTelemetry(data);

      if (typeof data.battery === "number") {
        setBattery(data.battery);
      }

      if (data.target && !targetPendingRef.current) {
        setTarget(data.target);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("controller-command", handleControllerCommand);
    socket.on("phone-telemetry", handleTelemetry);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("controller-command", handleControllerCommand);
      socket.off("phone-telemetry", handleTelemetry);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function speak(command) {
    const speech = {
      START: "Drone is ready to take off",
      LAND: "Drone landing",
      HOVER: "Drone holding position",
      AUTOPILOT: "Autopilot activated",
      EMERGENCY: "Emergency autonomous mode activated",
    }[command];

    if (!speech) return;

    try {
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.speak(
        new SpeechSynthesisUtterance(speech)
      );
    } catch {
      // Speech is optional.
    }
  }

  function send(command) {
    if (!command) return;

    setLast(command);
    speak(command);

    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit(
        IS_BRIDGE ? "bridge-control" : "controller-control",
        command
      );
      return;
    }

    fetch(`${COMMAND_API}/flight-command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command,
        source: IS_BRIDGE ? "bridge" : "controller",
      }),
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Command server returned an error");
        }
      })
      .catch(() => {
        setLast("COMMAND SERVER OFFLINE");
      });
  }

  function selectTargetFromMap(event) {
    const rect = event.currentTarget.getBoundingClientRect();

    const x = Math.round(
      ((event.clientX - rect.left) / rect.width - 0.5) * 3000
    );

    const z = Math.round(
      ((event.clientY - rect.top) / rect.height - 0.5) * 3000
    );

    const nextTarget = {
      x,
      y: 60,
      z,
    };

    targetPendingRef.current = true;
    setTarget(nextTarget);
    setConfirmed(false);
    setLast("TARGET SELECTED");
  }

  function confirmTarget() {
    const safeTarget = {
      x: Number(target.x) || 0,
      y: Math.max(5, Number(target.y) || 60),
      z: Number(target.z) || 0,
    };

    targetPendingRef.current = false;
    setTarget(safeTarget);
    setConfirmed(true);
    setLast("TARGET CONFIRMED");

    send(`TARGET:${JSON.stringify(safeTarget)}`);
  }

  function setMode(mode) {
    if (mode === "MANUAL") {
      send("HOVER");
    }

    if (mode === "AUTOPILOT") {
      send("AUTOPILOT");
    }

    if (mode === "EMERGENCY") {
      send("EMERGENCY");
    }
  }

  function startButtonControl(command) {
    clearInterval(buttonTimerRef.current);

    buttonCommandRef.current = command;
    send(command);

    buttonTimerRef.current = setInterval(() => {
      if (buttonCommandRef.current) {
        send(buttonCommandRef.current);
      }
    }, 120);
  }

  function endButtonControl() {
    clearInterval(buttonTimerRef.current);

    buttonTimerRef.current = null;
    buttonCommandRef.current = "";

    send("HOVER");
  }

  function joystickCommand(x, y) {
    const deadZone = 0.18;

    let command = "HOVER";

    if (Math.hypot(x, y) >= deadZone) {
      command =
        Math.abs(y) >= Math.abs(x)
          ? y < 0
            ? "UP"
            : "DOWN"
          : x < 0
            ? "LEFT"
            : "RIGHT";
    }

    if (command !== lastJoystickCommandRef.current) {
      lastJoystickCommandRef.current = command;
      send(command);
    }
  }

  function updateJoystick(event) {
    if (!joystickActiveRef.current || !joystickRef.current) return;

    const rect = joystickRef.current.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.34;

    const x = Math.max(
      -1,
      Math.min(1, (event.clientX - centerX) / maxDistance)
    );

    const y = Math.max(
      -1,
      Math.min(1, (event.clientY - centerY) / maxDistance)
    );

    joystickVectorRef.current = { x, y };
    setJoystick({ x, y });

    joystickCommand(x, y);
  }

  function startJoystick(event) {
    event.preventDefault();

    const element = joystickRef.current;

    if (!element) return;

    joystickActiveRef.current = true;

    element.setPointerCapture?.(event.pointerId);

    updateJoystick(event);

    clearInterval(joystickTimerRef.current);

    joystickTimerRef.current = setInterval(() => {
      const { x, y } = joystickVectorRef.current;
      joystickCommand(x, y);
    }, 120);
  }

  function endJoystick(event) {
    joystickActiveRef.current = false;

    joystickVectorRef.current = {
      x: 0,
      y: 0,
    };

    clearInterval(joystickTimerRef.current);

    joystickTimerRef.current = null;
    lastJoystickCommandRef.current = "";

    setJoystick({
      x: 0,
      y: 0,
    });

    send("HOVER");

    try {
      joystickRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (IS_BRIDGE) return;

      const command = KEY_COMMANDS[event.key];

      if (!command || keyboardRef.current.has(event.key)) {
        return;
      }

      event.preventDefault();
      keyboardRef.current.add(event.key);
      send(command);
    };

    const handleKeyUp = (event) => {
      if (IS_BRIDGE) return;

      const command = KEY_COMMANDS[event.key];

      if (!command) return;

      event.preventDefault();
      keyboardRef.current.delete(event.key);

      if (keyboardRef.current.size === 0) {
        send("HOVER");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      keyboardRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(joystickTimerRef.current);
      clearInterval(buttonTimerRef.current);
    };
  }, []);

  const droneLeft =
    50 +
    Math.max(
      -46,
      Math.min(46, Number(telemetry.x || 0) / 30)
    );

  const droneTop =
    50 +
    Math.max(
      -40,
      Math.min(40, Number(telemetry.z || 0) / 30)
    );

  const targetLeft =
    50 +
    Math.max(
      -46,
      Math.min(46, Number(target.x || 0) / 30)
    );

  const targetTop =
    50 +
    Math.max(
      -40,
      Math.min(40, Number(target.z || 0) / 30)
    );

  const gpsLost = telemetry.gps !== "CONNECTED";

  return (
    <div className="flight-control-page">
      <header className="fc-header">
        <div>
          <h1>
            NAVIGATE-X <span>◈</span>
          </h1>

          <p>
            FLIGHT CONTROL / GPS-DENIED NAVIGATION
          </p>
        </div>

        <div className="fc-link">
          <b className={connected ? "ok" : "danger"}>
            ● {connected ? "LINKED" : "OFFLINE"}
          </b>

          <span>
            {IS_BRIDGE
              ? "PHONE BRIDGE"
              : "PC CONTROL: WASD + Q/E"}
          </span>
        </div>
      </header>

      <main className="fc-layout">
        <aside className="fc-left">
          <div className="fc-panel-title">
            MISSION / EMERGENCY
          </div>

          <button
            className="fc-mode manual"
            onClick={() => setMode("MANUAL")}
          >
            ◉ MANUAL
            <br />
            <small>REMOTE CONTROL</small>
          </button>

          <button
            className="fc-mode auto"
            onClick={() => setMode("AUTOPILOT")}
          >
            ◆ AUTOPILOT
            <br />
            <small>FOLLOW SAFE ROUTE</small>
          </button>

          <button
            className="fc-mode emergency"
            onClick={() => setMode("EMERGENCY")}
          >
            ! EMERGENCY AUTONOMOUS
            <br />
            <small>GPS-DENIED SENSOR MODE</small>
          </button>

          <div className="fc-action-grid">
            <button
              className="takeoff"
              onClick={() => send("START")}
            >
              ▲
              <span>TAKE OFF</span>
            </button>

            <button
              className="land"
              onClick={() => send("LAND")}
            >
              ▼
              <span>LAND</span>
            </button>

            <button onClick={() => send("HOVER")}>
              ●
              <span>HOVER</span>
            </button>

            <button onClick={() => send("STOP")}>
              ■
              <span>STOP</span>
            </button>

            <button onClick={() => send("GPS_TOGGLE")}>
              GPS
              <span>{gpsLost ? "OFF" : "ON"}</span>
            </button>

            <button onClick={() => send("EMERGENCY")}>
              !
              <span>EMERGENCY</span>
            </button>
          </div>

          <div className="fc-status">
            <div>
              STATUS <b>{telemetry.status}</b>
            </div>

            <div>
              PHASE <b>{telemetry.phase}</b>
            </div>

            <div>
              MODE <b>{telemetry.mode}</b>
            </div>

            <div>
              GPS{" "}
              <b className={gpsLost ? "danger" : "ok"}>
                {gpsLost ? "LOST" : "CONNECTED"}
              </b>
            </div>
          </div>
        </aside>

        <section className="fc-center">
          <div className="fc-live">
            <div className="fc-section-head">
              <b>● LIVE DRONE MONITOR</b>
              <span>{telemetry.mode}</span>
            </div>

            <div className="camera-screen">
              <div className="camera-sky"></div>
              <div className="camera-horizon"></div>
              <div className="camera-ground"></div>
              <div className="camera-grid"></div>

              <div className="camera-reticle">+</div>

              <div
                className="target-lock"
                style={{
                  left: `${targetLeft}%`,
                  top: `${targetTop}%`,
                }}
              >
                T
                <div>TARGET</div>
              </div>

              <div
                className="camera-drone"
                style={{
                  left: `${droneLeft}%`,
                  top: `${droneTop}%`,
                }}
              >
                ◆
              </div>

              <div className="camera-info">
                <span>
                  ALT {Number(telemetry.y || 0).toFixed(1)}m
                </span>

                <span>
                  SPD {Number(telemetry.speed || 0).toFixed(1)}m/s
                </span>

                <span>
                  HDG {Number(telemetry.heading || 0).toFixed(0)}°
                </span>
              </div>

              <div className="camera-bottom">
                <span>{telemetry.status}</span>

                <span>
                  D{" "}
                  {Number(
                    telemetry.distanceToTarget || 0
                  ).toFixed(0)}
                  m
                </span>
              </div>
            </div>
          </div>

          <div className="fc-target-panel">
            <div className="fc-section-head">
              <b>SELECT TARGET LOCATION</b>

              <span>
                {confirmed
                  ? "✓ ROUTE TARGET LOCKED"
                  : "CLICK MAP TO SELECT"}
              </span>
            </div>

            <div
              className="fc-target-map"
              onClick={selectTargetFromMap}
            >
              <div className="map-cross x"></div>
              <div className="map-cross z"></div>

              <div className="map-home">H</div>

              <div
                className="map-drone"
                style={{
                  left: `${droneLeft}%`,
                  top: `${droneTop}%`,
                }}
              >
                D
              </div>

              <div
                className="map-target"
                style={{
                  left: `${targetLeft}%`,
                  top: `${targetTop}%`,
                }}
              >
                T
              </div>

              {!confirmed && (
                <div className="map-hint">
                  CLICK ANY AREA TO SET TARGET
                </div>
              )}
            </div>

            <div className="target-readout">
              <span>
                X <b>{Math.round(target.x)}</b>
              </span>

              <span>
                ALT <b>{Math.round(target.y)}</b>
              </span>

              <span>
                Z <b>{Math.round(target.z)}</b>
              </span>

              <span>
                DIST{" "}
                <b>
                  {Number(
                    telemetry.distanceToTarget || 0
                  ).toFixed(0)}{" "}
                  m
                </b>
              </span>
            </div>

            <button
              className="confirm-target"
              onClick={confirmTarget}
              disabled={confirmed}
            >
              {confirmed
                ? "✓ TARGET LOCKED — ROUTE SENT"
                : "CONFIRM LOCATION & CALCULATE ROUTE"}
            </button>

            <p className="route-note">
              After confirmation, the simulator receives the
              same X/Z target and its 3D A* navigation engine
              calculates a safe route around obstacles.
            </p>
          </div>
        </section>

        <aside className="fc-right">
          <div className="fc-panel-title">
            FLIGHT STICK
          </div>

          <div className="joystick-wrap">
            <div
              className="joystick"
              ref={joystickRef}
              onPointerDown={startJoystick}
              onPointerMove={updateJoystick}
              onPointerUp={endJoystick}
              onPointerCancel={endJoystick}
            >
              <div className="joystick-ring"></div>
              <div className="joystick-ring ring2"></div>

              <div
                className="joystick-center"
                style={{
                  transform: `translate(
                    calc(-50% + ${joystick.x * 62}px),
                    calc(-50% + ${joystick.y * 62}px)
                  )`,
                }}
              ></div>
            </div>
          </div>

          <div className="joystick-label">
            FORWARD ↑ &nbsp; / &nbsp; BACK ↓
            <br />
            LEFT ← &nbsp; / &nbsp; RIGHT →
          </div>

          <div className="keyboard-card">
            <b>PC KEYBOARD</b>

            <div className="key-row">
              <kbd>Q</kbd>
              <kbd>W</kbd>
              <kbd>E</kbd>
            </div>

            <div className="key-row">
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
            </div>

            <p>
              W/S MOVE FORWARD/BACK
              <br />
              A/D MOVE LEFT/RIGHT
              <br />
              Q/E YAW · ↑/↓ ALTITUDE
            </p>
          </div>

          <div className="bottom-flight-controls">
            <div className="bottom-control-title">
              DIRECT DRONE MOVEMENT — HOLD BUTTON
            </div>

            <div className="bottom-control-grid">
              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("YAW_LEFT");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ↶
                <small>YAW L</small>
              </button>

              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("ASCEND");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ↑
                <small>UP</small>
              </button>

              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("YAW_RIGHT");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ↷
                <small>YAW R</small>
              </button>

              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("LEFT");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ←
                <small>LEFT</small>
              </button>

              <button
                className="forward"
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("UP");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ▲
                <small>FORWARD</small>
              </button>

              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("RIGHT");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                →
                <small>RIGHT</small>
              </button>

              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("DESCEND");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ↓
                <small>DOWN</small>
              </button>

              <button onClick={() => send("HOVER")}>
                ●
                <small>HOVER</small>
              </button>

              <button
                onPointerDown={(event) => {
                  event.preventDefault();
                  startButtonControl("DOWN");
                }}
                onPointerUp={endButtonControl}
                onPointerCancel={endButtonControl}
              >
                ▼
                <small>BACK</small>
              </button>
            </div>
          </div>

          <div className="telemetry-card">
            <div>
              <span>BATTERY</span>
              <b>{Math.round(battery)}%</b>
            </div>

            <div className="battery-bar">
              <i
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, battery)
                  )}%`,
                }}
              ></i>
            </div>

            <div className="telemetry-values">
              <span>
                ALT
                <b>
                  {Number(telemetry.y || 0).toFixed(1)}m
                </b>
              </span>

              <span>
                SPEED
                <b>
                  {Number(telemetry.speed || 0).toFixed(1)}m/s
                </b>
              </span>

              <span>
                SENSOR
                <b>
                  {Number(
                    telemetry.sensorDistance || 0
                  ).toFixed(1)}m
                </b>
              </span>
            </div>
          </div>

          <div className="fc-command-status">
            <span>LAST COMMAND</span>
            <b>{last}</b>
          </div>
        </aside>
      </main>
    </div>
  );
}
