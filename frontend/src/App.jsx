import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

const HOME = { x: 0, y: 30, z: 0 };
const TARGET = { x: 1400, y: 120, z: -1100 };
const CRUISE_SPEED = 95;
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
      <group ref={(el)=>(rotors.current[i]=el)} position={[0,1,z>0?2.4:-2.4]}><mesh><boxGeometry args={[4.8,0.08,0.25]}/><meshStandardMaterial color="#a9eaff" transparent opacity={0.65}/></mesh><mesh rotation={[0,Math.PI/2,0]}><boxGeometry args={[4.8,0.08,0.25]}/><meshStandardMaterial color="#a9eaff" transparent opacity={0.65}/></mesh></group>
    </group>)}
  </group>;
}

function Marker({point,type}) {
  const color=type==="target"?"#4dff9a":"#ffd34d";
  return <group position={[point.x,point.y,point.z]}><mesh><cylinderGeometry args={[12,12,2,32]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2}/></mesh><mesh position={[0,18,0]}><sphereGeometry args={[3,20,16]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2}/></mesh></group>;
}

function useFrameSimulation(position,missionState,setPosition,setHeading,setSpeed,setBattery,setMissionState) {
  const stateRef=useRef(position);
  useFrame((_,dt)=>{
    if(!stateRef.current) stateRef.current={...position};
    if(missionState!=="AUTONOMOUS"&&missionState!=="RETURNING"){setSpeed(0);return;}
    const target=missionState==="RETURNING"?HOME:TARGET;
    const current=stateRef.current;
    const dx=target.x-current.x,dy=target.y-current.y,dz=target.z-current.z;
    const distance=Math.hypot(dx,dy,dz);
    if(distance<8){stateRef.current={...target};setPosition({...target});setSpeed(0);setMissionState("LANDED");return;}
    const step=Math.min(distance,CRUISE_SPEED*dt);
    const nx=current.x+(dx/distance)*step,ny=current.y+(dy/distance)*step,nz=current.z+(dz/distance)*step;
    stateRef.current={x:nx,y:ny,z:nz};setPosition({x:nx,y:ny,z:nz});setSpeed(step/Math.max(dt,0.001));
    setHeading((Math.atan2(-dx,-dz)*180/Math.PI+360)%360);
    setBattery((b)=>Math.max(0,b-dt*0.018));
  });
}

function SimulationEngine(props){useFrameSimulation(props.position,props.missionState,props.setPosition,props.setHeading,props.setSpeed,props.setBattery,props.setMissionState);return null;}

function MonitorScene(props){
  const camera=useRef();
  useFrame((_,dt)=>{
    if(!camera.current)return;
    const p=props.position;
    const desired=new THREE.Vector3(p.x+520,p.y+500,p.z+620);
    camera.current.position.lerp(desired,Math.min(1,dt*3));
    camera.current.lookAt(p.x,p.y,p.z);
  });
  return <>
    <SimulationEngine {...props}/>
    <PerspectiveCamera ref={camera} makeDefault position={[520,520,620]} fov={48}/>
    <ambientLight intensity={1.5}/><directionalLight position={[300,600,200]} intensity={2.4} castShadow/>
    <Grid args={[3000,3000]} cellSize={50} sectionSize={250} fadeDistance={2500}/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[3000,3000]}/><meshStandardMaterial color="#20362a" roughness={1}/></mesh>
    <Marker point={HOME} type="home"/><Marker point={TARGET} type="target"/><Drone position={props.position} heading={props.heading}/>
    <mesh position={[450,55,-250]} castShadow><boxGeometry args={[120,110,120]}/><meshStandardMaterial color="#754b3d"/></mesh>
    <mesh position={[850,85,-500]} castShadow><boxGeometry args={[160,170,100]}/><meshStandardMaterial color="#754b3d"/></mesh>
  </>;
}

function Metric({label,value}){return <div className="metric"><span>{label}</span><b>{value}</b></div>;}
function addNoise(value,amount=SENSOR_NOISE){return value+(Math.random()-0.5)*amount;}

function PositionEstimator({position,setEstimatedPosition,setSensorError}){
  useEffect(()=>{const timer=setInterval(()=>{
    const ex=addNoise(position.x),ey=addNoise(position.y),ez=addNoise(position.z);
    setEstimatedPosition({x:ex,y:ey,z:ez});
    setSensorError(Math.hypot(ex-position.x,ey-position.y,ez-position.z));
  },250);return()=>clearInterval(timer);},[position.x,position.y,position.z,setEstimatedPosition,setSensorError]);
  return null;
}

function MissionProgress({distance,totalMissionDistance,setRouteProgress}){
  useEffect(()=>{setRouteProgress(Math.max(0,Math.min(100,((totalMissionDistance-distance)/totalMissionDistance)*100)));},[distance,totalMissionDistance,setRouteProgress]);
  return null;
}

export default function App(){
  const [gpsDenied,setGpsDenied]=useState(true);
  const [position,setPosition]=useState({...HOME});
  const [heading,setHeading]=useState(0);
  const [speed,setSpeed]=useState(0);
  const [battery,setBattery]=useState(100);
  const [missionState,setMissionState]=useState("READY");
  const [estimatedPosition,setEstimatedPosition]=useState({...HOME});
  const [sensorError,setSensorError]=useState(0);
  const [routeProgress,setRouteProgress]=useState(0);
  const distance=useMemo(()=>Math.hypot(position.x-TARGET.x,position.y-TARGET.y,position.z-TARGET.z),[position]);
  const totalMissionDistance=Math.hypot(TARGET.x-HOME.x,TARGET.y-HOME.y,TARGET.z-HOME.z);
  const startMission=()=>{if(missionState==="READY"||missionState==="LANDED"||missionState==="COMPLETE"){setMissionState("AUTONOMOUS");setBattery((b)=>Math.max(0,b-0.5));}};
  const returnHome=()=>setMissionState("RETURNING");
  const resetMission=()=>{setPosition({...HOME});setEstimatedPosition({...HOME});setHeading(0);setSpeed(0);setBattery(100);setSensorError(0);setRouteProgress(0);setMissionState("READY");};
  return <div className="app">
    <PositionEstimator position={position} setEstimatedPosition={setEstimatedPosition} setSensorError={setSensorError}/>
    <MissionProgress distance={distance} totalMissionDistance={totalMissionDistance} setRouteProgress={setRouteProgress}/>
    <header className="topbar"><div><h1>NAVIGATE-X <span>◈</span></h1><p>GPS-DENIED AUTONOMOUS NAVIGATION & LIVE MONITORING</p></div><div className={gpsDenied?"gps-badge denied":"gps-badge connected"}>GPS {gpsDenied?"DENIED":"CONNECTED"}</div></header>
    <main className="dashboard">
      <aside className="left-panel"><div className="panel-title">MISSION CONTROL</div>
        <div className="mission-card"><span>MISSION</span><strong>GPS-DENIED TEST</strong><small>Move the simulated vehicle using onboard estimation instead of GPS.</small></div>
        <button className="primary-button" onClick={startMission}>START AUTONOMOUS</button><button className="primary-button" onClick={returnHome}>EMERGENCY RETURN</button><button className="mode" onClick={resetMission}>RESET MISSION</button>
        <div className="control-card"><div className="section-label">NAVIGATION MODE</div><button className={missionState==="AUTONOMOUS"?"mode active":"mode"}>AUTONOMOUS</button><button className="mode">MANUAL</button><button className={missionState==="RETURNING"?"mode emergency active":"mode emergency"}>RETURN HOME</button></div>
        <div className="control-card"><div className="section-label">GPS SIMULATION</div><button className="gps-toggle" onClick={()=>setGpsDenied((v)=>!v)}>{gpsDenied?"GPS IS OFF":"GPS IS ON"}</button><small>Position estimation continues from simulated onboard sensors.</small></div>
        <div className="mission-card"><span>SYSTEM MESSAGE</span><strong>{missionState}</strong><small>{missionState==="AUTONOMOUS"?"Autonomous navigation is moving toward the target.":missionState==="RETURNING"?"Emergency return is navigating toward home.":missionState==="LANDED"?"Vehicle reached its destination and landed.":"Waiting for mission start."}</small></div>
      </aside>
      <section className="monitor"><div className="monitor-head"><div><b>LIVE 3D MONITOR</b><small>Estimated navigation view • GPS independent</small></div><div className="monitor-state">● SIMULATION ONLINE</div></div>
        <div className="canvas-wrap"><Canvas shadows><color attach="background" args={["#07131c"]}/><fog attach="fog" args={["#07131c",700,2200]}/><MonitorScene position={position} heading={heading} missionState={missionState} setPosition={setPosition} setHeading={setHeading} setSpeed={setSpeed} setBattery={setBattery} setMissionState={setMissionState}/></Canvas>
          <div className="monitor-hud"><span>EST. X <b>{estimatedPosition.x.toFixed(1)} m</b></span><span>EST. Y <b>{estimatedPosition.y.toFixed(1)} m</b></span><span>EST. Z <b>{estimatedPosition.z.toFixed(1)} m</b></span><span>HEADING <b>{heading.toFixed(0)}°</b></span><span>GPS <b>{gpsDenied?"DENIED":"CONNECTED"}</b></span></div>
          <div className="route-status"><span>MISSION</span><b>{missionState} • {routeProgress.toFixed(1)}% • {distance.toFixed(1)} m TO TARGET</b></div>
        </div>
      </section>
      <aside className="right-panel"><div className="panel-title">DRONE TELEMETRY</div>
        <div className="status-card"><span>DRONE STATUS</span><strong>{missionState}</strong><small>Live simulation telemetry</small></div>
        <div className="battery-card"><div><span>BATTERY</span><b>{battery.toFixed(1)}%</b></div><div className="battery-track"><i style={{width:battery+"%"}}/></div><small>Estimated reserve based on simulated movement.</small></div>
        <div className="metrics"><Metric label="EST. POSITION X" value={estimatedPosition.x.toFixed(1)+" m"}/><Metric label="EST. POSITION Y" value={estimatedPosition.y.toFixed(1)+" m"}/><Metric label="EST. POSITION Z" value={estimatedPosition.z.toFixed(1)+" m"}/><Metric label="ALTITUDE" value={estimatedPosition.y.toFixed(1)+" m"}/><Metric label="SPEED" value={speed.toFixed(1)+" m/s"}/><Metric label="TARGET DISTANCE" value={distance.toFixed(1)+" m"}/><Metric label="HEADING" value={heading.toFixed(0)+"°"}/><Metric label="MISSION" value={routeProgress.toFixed(1)+"%"}/></div>
        <div className="sensor-card"><div className="section-label">SENSOR STATUS</div><p><span>IMU</span><b>● READY</b></p><p><span>CAMERA</span><b>● READY</b></p><p><span>DEPTH / LiDAR</span><b>● READY</b></p><p><span>ALTIMETER</span><b>● READY</b></p><p><span>POSITION ESTIMATOR</span><b>● ACTIVE</b></p></div>
        <div className="accuracy-card"><span>POSITION ESTIMATION ERROR</span><strong>{sensorError.toFixed(2)} m</strong><small>Ground-truth simulation position is compared with the noisy estimated position.</small></div>
      </aside>
    </main>
  </div>;
}
