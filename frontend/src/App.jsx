import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

const HOME = { x: 0, y: 30, z: 0 };
const TARGET = { x: 1400, y: 120, z: -1100 };
const CRUISE_SPEED = 95;
const MANUAL_SPEED = 90;
const TURN_SPEED = 110;
const SENSOR_NOISE = 2.5;

function Drone({ position, heading }) {
  const group = useRef();
  const rotors = useRef([]);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, heading * Math.PI / 180, dt * 7);
    rotors.current.forEach((r) => { if (r) r.rotation.y += dt * 35; });
  });
  const motors = [[-5,0,-4],[5,0,-4],[-5,0,4],[5,0,4]];
  return <group ref={group} position={[position.x,position.y,position.z]} scale={2.5}>
    <mesh castShadow><capsuleGeometry args={[1.4,3.8,8,24]}/><meshStandardMaterial color="#182a35" metalness={0.85} roughness={0.2}/></mesh>
    <mesh position={[0,0.8,-2.2]}><sphereGeometry args={[0.65,20,16]}/><meshStandardMaterial color="#19dfff" emissive="#00889b" emissiveIntensity={3}/></mesh>
    {motors.map(([x,y,z],i)=><group key={i} position={[x*0.55,y,z*0.55]}>
      <mesh rotation={[0,Math.atan2(z,x),0]}><boxGeometry args={[0.5,0.35,5]}/><meshStandardMaterial color="#304955" metalness={0.8}/></mesh>
      <mesh position={[0,0.55,z>0?2.4:-2.4]}><cylinderGeometry args={[0.65,0.75,0.6,20]}/><meshStandardMaterial color="#101a20" metalness={0.9}/></mesh>
      <group ref={(el)=>(rotors.current[i]=el)} position={[0,1,z>0?2.4:-2.4]}>
        <mesh><boxGeometry args={[4.8,0.08,0.25]}/><meshStandardMaterial color="#a9eaff" transparent opacity={0.65}/></mesh>
        <mesh rotation={[0,Math.PI/2,0]}><boxGeometry args={[4.8,0.08,0.25]}/><meshStandardMaterial color="#a9eaff" transparent opacity={0.65}/></mesh>
      </group>
    </group>)}
  </group>;
}

function ThirdPersonGameCamera({ position, heading }) {
  const camera = useRef();
  const desired = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    if (!camera.current) return;
    const yaw = heading * Math.PI / 180;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    desired.current.set(position.x - forward.x * 58, position.y + 28, position.z - forward.z * 58);
    camera.current.position.lerp(desired.current, 1 - Math.exp(-dt * 5.5));
    camera.current.lookAt(position.x + forward.x * 55, position.y - 3, position.z + forward.z * 55);
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={68} near={0.1} far={3500}/>;
}

function useFrameSimulation(position, missionState, controls, setPosition, setHeading, setSpeed, setBattery, setMissionState) {
  const stateRef = useRef(position);
  useEffect(() => { stateRef.current = position; }, [position]);

  useFrame((_,dt) => {
    if (!stateRef.current) stateRef.current = {...position};

    if (missionState === "MANUAL") {
      const current = stateRef.current;
      const yaw = controls.yaw * Math.PI / 180;
      let nextHeading = (yaw + controls.turn * TURN_SPEED * dt) * 180 / Math.PI;
      nextHeading = (nextHeading + 360) % 360;

      const forward = new THREE.Vector3(-Math.sin(nextHeading * Math.PI / 180), 0, -Math.cos(nextHeading * Math.PI / 180));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const horizontal = forward.multiplyScalar(-controls.throttle * MANUAL_SPEED * dt)
        .add(right.multiplyScalar(controls.strafe * MANUAL_SPEED * dt));

      const next = {
        x: THREE.MathUtils.clamp(current.x + horizontal.x, -2450, 2450),
        y: THREE.MathUtils.clamp(current.y + controls.vertical * MANUAL_SPEED * dt, 8, 1000),
        z: THREE.MathUtils.clamp(current.z + horizontal.z, -2450, 2450)
      };

      stateRef.current = next;
      setPosition(next);
      setHeading(nextHeading);
      const moving = Math.hypot(horizontal.x, horizontal.z, controls.vertical * MANUAL_SPEED * dt);
      setSpeed(moving / Math.max(dt,0.001));
      if (moving > 0 || controls.vertical !== 0) setBattery(b => Math.max(0,b - dt * 0.012));
      return;
    }

    if (missionState !== "AUTONOMOUS" && missionState !== "RETURNING") {
      setSpeed(0);
      return;
    }

    const target = missionState === "RETURNING" ? HOME : TARGET;
    const current = stateRef.current;
    const dx=target.x-current.x, dy=target.y-current.y, dz=target.z-current.z;
    const distance=Math.hypot(dx,dy,dz);

    if(distance<8){
      stateRef.current={...target};
      setPosition({...target});
      setSpeed(0);
      setMissionState("LANDED");
      return;
    }

    const step=Math.min(distance,CRUISE_SPEED*dt);
    const next={x:current.x+(dx/distance)*step,y:current.y+(dy/distance)*step,z:current.z+(dz/distance)*step};
    stateRef.current=next;
    setPosition(next);
    setSpeed(step/Math.max(dt,0.001));
    setHeading((Math.atan2(-dx,-dz)*180/Math.PI+360)%360);
    setBattery(b=>Math.max(0,b-dt*0.018));
  });
}

function SimulationEngine(props) {
  useFrameSimulation(props.position,props.missionState,props.controls,props.setPosition,props.setHeading,props.setSpeed,props.setBattery,props.setMissionState);
  return null;
}

function Environment() {
  const obstacles=[[450,55,-250,120,110,120],[850,85,-500,160,170,100],[1100,65,-720,120,130,160],[1320,95,-900,180,190,130],[1050,45,-300,90,90,180]];
  return <>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[5000,5000]}/><meshStandardMaterial color="#18241d" roughness={1}/></mesh>
    {obstacles.map(([x,y,z,sx,sy,sz],i)=><mesh key={i} position={[x,y,z]} castShadow><boxGeometry args={[sx,sy,sz]}/><meshStandardMaterial color={i%2?"#514538":"#344a3b"} roughness={1}/></mesh>)}
    <Grid args={[5000,5000]} cellSize={100} sectionSize={500} fadeDistance={3000} visible={false}/>
  </>;
}

function Scene(props) {
  return <>
    <ThirdPersonGameCamera position={props.position} heading={props.heading}/>
    <ambientLight intensity={1.1}/><directionalLight position={[300,700,200]} intensity={2.1}/>
    <Environment/>
    <Drone position={props.position} heading={props.heading}/>
    <SimulationEngine {...props}/>
  </>;
}

function PositionEstimator({position,setEstimatedPosition,setSensorError}) {
  useEffect(()=>{
    const timer=setInterval(()=>{
      const ex=position.x+(Math.random()-0.5)*SENSOR_NOISE;
      const ey=position.y+(Math.random()-0.5)*SENSOR_NOISE;
      const ez=position.z+(Math.random()-0.5)*SENSOR_NOISE;
      setEstimatedPosition({x:ex,y:ey,z:ez});
      setSensorError(Math.hypot(ex-position.x,ey-position.y,ez-position.z));
    },250);
    return()=>clearInterval(timer);
  },[position,setEstimatedPosition,setSensorError]);
  return null;
}

function ControllerOverlay({connected, mode, setMode, onTakeoff, onLand, setVirtual}) {
  const press = (name,value) => (event) => {
    event.preventDefault();
    setVirtual(name,value);
  };
  const release = (name) => (event) => {
    event.preventDefault();
    setVirtual(name,0);
  };

  const btn = {
    width:54,height:54,border:"1px solid rgba(180,255,220,.35)",borderRadius:12,
    background:"rgba(5,18,14,.72)",color:"#d9ffe8",fontSize:20,touchAction:"none",userSelect:"none"
  };
  return <div style={{position:"absolute",inset:0,pointerEvents:"none",fontFamily:"monospace"}}>
    <div style={{position:"absolute",top:14,left:14,pointerEvents:"auto",display:"flex",gap:8,alignItems:"center"}}>
      <button onClick={()=>setMode(mode==="MANUAL"?"AUTONOMOUS":"MANUAL")} style={{...btn,width:"auto",height:38,padding:"0 12px",fontSize:11}}>
        MODE: {mode}
      </button>
      <span style={{fontSize:11,color:connected?"#72ff9f":"#ffd36a",background:"rgba(0,0,0,.45)",padding:"8px 10px",borderRadius:8}}>
        {connected ? "CONTROLLER CONNECTED" : "KEYBOARD / TOUCH"}
      </span>
    </div>

    <div style={{position:"absolute",left:18,bottom:18,pointerEvents:"auto",display:"grid",gridTemplateColumns:"repeat(3,54px)",gap:7}}>
      <div/>
      <button style={btn} onPointerDown={press("throttle",1)} onPointerUp={release("throttle")} onPointerCancel={release("throttle")}>▲</button>
      <div/>
      <button style={btn} onPointerDown={press("strafe",-1)} onPointerUp={release("strafe")} onPointerCancel={release("strafe")}>◀</button>
      <button style={btn} onPointerDown={press("throttle",-1)} onPointerUp={release("throttle")} onPointerCancel={release("throttle")}>▼</button>
      <button style={btn} onPointerDown={press("strafe",1)} onPointerUp={release("strafe")} onPointerCancel={release("strafe")}>▶</button>
    </div>

    <div style={{position:"absolute",right:18,bottom:18,pointerEvents:"auto",display:"grid",gridTemplateColumns:"repeat(2,54px)",gap:7}}>
      <button style={btn} onPointerDown={press("vertical",1)} onPointerUp={release("vertical")} onPointerCancel={release("vertical")}>+</button>
      <button style={btn} onPointerDown={press("vertical",-1)} onPointerUp={release("vertical")} onPointerCancel={release("vertical")}>−</button>
      <button style={{...btn,gridColumn:"1 / span 2",width:115,fontSize:11}} onClick={onTakeoff}>TAKE OFF</button>
      <button style={{...btn,gridColumn:"1 / span 2",width:115,fontSize:11}} onClick={onLand}>LAND</button>
    </div>

    <div style={{position:"absolute",right:18,top:70,pointerEvents:"auto",display:"flex",gap:7}}>
      <button style={btn} onPointerDown={press("turn",-1)} onPointerUp={release("turn")} onPointerCancel={release("turn")}>↶</button>
      <button style={btn} onPointerDown={press("turn",1)} onPointerUp={release("turn")} onPointerCancel={release("turn")}>↷</button>
    </div>

    <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",color:"rgba(230,255,240,.75)",fontSize:10,pointerEvents:"none"}}>
      W/S = forward/back • A/D = strafe • Q/E = rotate • R/F = altitude • Space = takeoff • L = land
    </div>
  </div>;
}

function useController() {
  const [connected,setConnected] = useState(false);
  const [virtual,setVirtualState] = useState({throttle:0,strafe:0,vertical:0,turn:0});
  const keys = useRef(new Set());
  const gamepad = useRef(null);

  const setVirtual = (name,value) => {
    setVirtualState(v => ({...v,[name]:value}));
  };

  useEffect(() => {
    const down = (e) => {
      if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
      keys.current.add(e.key.toLowerCase());
      if ([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    const connect = (e) => { gamepad.current=e.gamepad; setConnected(true); };
    const disconnect = () => { gamepad.current=null; setConnected(false); };

    window.addEventListener("keydown",down);
    window.addEventListener("keyup",up);
    window.addEventListener("gamepadconnected",connect);
    window.addEventListener("gamepaddisconnected",disconnect);

    return () => {
      window.removeEventListener("keydown",down);
      window.removeEventListener("keyup",up);
      window.removeEventListener("gamepadconnected",connect);
      window.removeEventListener("gamepaddisconnected",disconnect);
    };
  },[]);

  const controls = useMemo(() => {
    const k = keys.current;
    let throttle = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    let strafe = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    let vertical = (k.has("r") ? 1 : 0) - (k.has("f") ? 1 : 0);
    let turn = (k.has("e") ? 1 : 0) - (k.has("q") ? 1 : 0);

    const gp = gamepad.current;
    if (gp) {
      const dead = (v) => Math.abs(v) < 0.12 ? 0 : v;
      throttle = -dead(gp.axes?.[1] ?? 0) || throttle;
      strafe = dead(gp.axes?.[0] ?? 0) || strafe;
      turn = dead(gp.axes?.[2] ?? 0) || turn;
      vertical = (gp.buttons?.[5]?.pressed ? 1 : 0) - (gp.buttons?.[4]?.pressed ? 1 : 0) || vertical;
    }

    return {throttle,strafe,vertical,turn};
  },[virtual]);

  return {connected,controls:{
    throttle: controls.throttle || virtual.throttle,
    strafe: controls.strafe || virtual.strafe,
    vertical: controls.vertical || virtual.vertical,
    turn: controls.turn || virtual.turn,
    yaw: 0
  },setVirtual};
}

export default function App() {
  const [position,setPosition]=useState({...HOME});
  const [heading,setHeading]=useState(0);
  const [speed,setSpeed]=useState(0);
  const [battery,setBattery]=useState(100);
  const [missionState,setMissionState]=useState("LANDED");
  const [estimatedPosition,setEstimatedPosition]=useState({...HOME});
  const [sensorError,setSensorError]=useState(0);
  const [mode,setMode]=useState("MANUAL");
  const {connected,controls,setVirtual}=useController();

  const distance=useMemo(()=>Math.hypot(position.x-TARGET.x,position.y-TARGET.y,position.z-TARGET.z),[position]);

  const takeoff = () => {
    if (battery <= 2) return;
    setMode("MANUAL");
    setMissionState("MANUAL");
  };

  const land = () => {
    setMissionState("LANDED");
    setSpeed(0);
  };

  useEffect(() => {
    if (mode === "AUTONOMOUS" && missionState === "LANDED") setMissionState("AUTONOMOUS");
  }, [mode]);

  return <div style={{position:"fixed",inset:0,width:"100vw",height:"100vh",overflow:"hidden",background:"#000"}}>
    <PositionEstimator position={position} setEstimatedPosition={setEstimatedPosition} setSensorError={setSensorError}/>
    <Canvas shadows gl={{antialias:true}} style={{width:"100vw",height:"100vh",display:"block"}}>
      <color attach="background" args={["#101a24"]}/>
      <fog attach="fog" args={["#101a24",350,3200]}/>
      <Scene position={position} heading={heading} missionState={missionState} controls={controls} setPosition={setPosition} setHeading={setHeading} setSpeed={setSpeed} setBattery={setBattery} setMissionState={setMissionState}/>
    </Canvas>

    <ControllerOverlay
      connected={connected}
      mode={mode}
      setMode={setMode}
      onTakeoff={takeoff}
      onLand={land}
      setVirtual={setVirtual}
    />
  </div>;
}
