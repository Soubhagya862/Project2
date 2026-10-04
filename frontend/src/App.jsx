import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, PerspectiveCamera } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

const HOME = { x: 0, y: 30, z: 0 };
const TARGET = { x: 1400, y: 120, z: -1100 };

function Drone({ position, heading }) {
  const group = useRef();
  const rotors = useRef([]);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, heading, dt * 6);
    rotors.current.forEach((r) => { if (r) r.rotation.y += dt * 35; });
  });
  const motors = [[-5,0,-4],[5,0,-4],[-5,0,4],[5,0,4]];
  return <group ref={group} position={[position.x,position.y,position.z]} scale={2.5}>
    <mesh castShadow><capsuleGeometry args={[1.4,3.8,8,24]}/><meshStandardMaterial color="#182a35" metalness={0.85} roughness={0.2}/></mesh>
    <mesh position={[0,0.8,-2.2]}><sphereGeometry args={[0.65,20,16]}/><meshStandardMaterial color="#19dfff" emissive="#00889b" emissiveIntensity={3}/></mesh>
    {motors.map(([x,y,z],i)=><group key={i} position={[x*.55,y,z*.55]}>
      <mesh rotation={[0,Math.atan2(z,x),0]}><boxGeometry args={[0.5,0.35,5]}/><meshStandardMaterial color="#304955" metalness={0.8}/></mesh>
      <mesh position={[0,0.55,z>0?2.4:-2.4]}><cylinderGeometry args={[0.65,0.75,0.6,20]}/><meshStandardMaterial color="#101a20" metalness={0.9}/></mesh>
      <group ref={el=>(rotors.current[i]=el)} position={[0,1,z>0?2.4:-2.4]}>
        <mesh><boxGeometry args={[4.8,0.08,0.25]}/><meshStandardMaterial color="#a9eaff" transparent opacity={0.65}/></mesh>
        <mesh rotation={[0,Math.PI/2,0]}><boxGeometry args={[4.8,0.08,0.25]}/><meshStandardMaterial color="#a9eaff" transparent opacity={0.65}/></mesh>
      </group>
    </group>)}
  </group>;
}

function Marker({ point, type }) {
  const color = type === "target" ? "#4dff9a" : "#ffd34d";
  return <group position={[point.x,point.y,point.z]}>
    <mesh><cylinderGeometry args={[12,12,2,32]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2}/></mesh>
    <mesh position={[0,18,0]}><sphereGeometry args={[3,20,16]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2}/></mesh>
  </group>;
}

function MonitorScene({ position, heading }) {
  const camera = useRef();
  useFrame((_,dt)=>{
    if (!camera.current) return;
    const desired = new THREE.Vector3(position.x+520,position.y+500,position.z+620);
    camera.current.position.lerp(desired,Math.min(1,dt*3));
    camera.current.lookAt(position.x,position.y,position.z);
  });
  return <>
    <PerspectiveCamera ref={camera} makeDefault position={[520,520,620]} fov={48}/>
    <ambientLight intensity={1.5}/><directionalLight position={[300,600,200]} intensity={2.4} castShadow/>
    <Grid args={[3000,3000]} cellSize={50} sectionSize={250} fadeDistance={2500}/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[3000,3000]}/><meshStandardMaterial color="#20362a" roughness={1}/></mesh>
    <Marker point={HOME} type="home"/><Marker point={TARGET} type="target"/>
    <Drone position={position} heading={heading}/>
    <mesh position={[450,55,-250]} castShadow><boxGeometry args={[120,110,120]}/><meshStandardMaterial color="#754b3d"/></mesh>
    <mesh position={[850,85,-500]} castShadow><boxGeometry args={[160,170,100]}/><meshStandardMaterial color="#754b3d"/></mesh>
  </>;
}

function Metric({label,value}) { return <div className="metric"><span>{label}</span><b>{value}</b></div>; }

export default function App() {
  const [gpsDenied,setGpsDenied]=useState(true);
  const [position]=useState({x:0,y:30,z:0});
  const [heading]=useState(0);
  const distance=useMemo(()=>Math.hypot(position.x-TARGET.x,position.y-TARGET.y,position.z-TARGET.z),[position]);
  return <div className="app">
    <header className="topbar">
      <div><h1>NAVIGATE-X <span>◈</span></h1><p>GPS-DENIED AUTONOMOUS NAVIGATION & LIVE MONITORING</p></div>
      <div className={gpsDenied?"gps-badge denied":"gps-badge connected"}>GPS {gpsDenied?"DENIED":"CONNECTED"}</div>
    </header>
    <main className="dashboard">
      <aside className="left-panel">
        <div className="panel-title">MISSION CONTROL</div>
        <div className="mission-card"><span>MISSION</span><strong>GPS-DENIED TEST</strong><small>Monitor and navigate without GPS coordinates.</small></div>
        <button className="primary-button">SELECT TARGET</button>
        <div className="control-card"><div className="section-label">NAVIGATION MODE</div><button className="mode active">AUTONOMOUS</button><button className="mode">MANUAL</button><button className="mode emergency">EMERGENCY RETURN</button></div>
        <div className="control-card"><div className="section-label">GPS SIMULATION</div><button className="gps-toggle" onClick={()=>setGpsDenied(v=>!v)}>{gpsDenied?"GPS IS OFF":"GPS IS ON"}</button><small>Navigation will later use simulated onboard sensors when GPS is denied.</small></div>
        <div className="mission-card"><span>SYSTEM MESSAGE</span><strong>READY</strong><small>Waiting for mission start.</small></div>
      </aside>
      <section className="monitor">
        <div className="monitor-head"><div><b>LIVE 3D MONITOR</b><small>Estimated navigation view • GPS independent</small></div><div className="monitor-state">● SIMULATION ONLINE</div></div>
        <div className="canvas-wrap">
          <Canvas shadows><color attach="background" args={["#07131c"]}/><fog attach="fog" args={["#07131c",700,2200]}/><MonitorScene position={position} heading={heading}/></Canvas>
          <div className="monitor-hud"><span>POSITION <b>X 0 / Y 30 / Z 0</b></span><span>HEADING <b>0°</b></span><span>GPS <b>{gpsDenied?"DENIED":"CONNECTED"}</b></span></div>
          <div className="route-status"><span>PLANNED ROUTE</span><b>WAITING FOR TARGET ANALYSIS</b></div>
        </div>
      </section>
      <aside className="right-panel">
        <div className="panel-title">DRONE TELEMETRY</div>
        <div className="status-card"><span>DRONE STATUS</span><strong>READY</strong><small>GPS-denied monitoring active</small></div>
        <div className="battery-card"><div><span>BATTERY</span><b>100%</b></div><div className="battery-track"><i style={{width:"100%"}}/></div><small>Estimated flight reserve: calculating</small></div>
        <div className="metrics">
          <Metric label="EST. POSITION X" value="0.0 m"/><Metric label="EST. POSITION Y" value="30.0 m"/><Metric label="EST. POSITION Z" value="0.0 m"/>
          <Metric label="ALTITUDE" value="30.0 m"/><Metric label="SPEED" value="0.0 m/s"/><Metric label="TARGET DISTANCE" value={distance.toFixed(1)+" m"}/>
          <Metric label="HEADING" value="0°"/><Metric label="MISSION" value="0%"/>
        </div>
        <div className="sensor-card"><div className="section-label">SENSOR STATUS</div><p><span>IMU</span><b>● READY</b></p><p><span>CAMERA</span><b>● READY</b></p><p><span>DEPTH / LiDAR</span><b>● READY</b></p><p><span>ALTIMETER</span><b>● READY</b></p><p><span>POSITION ESTIMATOR</span><b>● READY</b></p></div>
        <div className="accuracy-card"><span>POSITION ESTIMATION</span><strong>GROUND TRUTH MODE</strong><small>Accuracy measurement will be added in the sensor-estimation phase.</small></div>
      </aside>
    </main>
  </div>;
}
