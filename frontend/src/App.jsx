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

function DroneVisionCamera({ position, heading }) {
  const camera = useRef();
  useFrame(() => {
    if (!camera.current) return;
    const yaw = heading * Math.PI / 180;
    const forward = new THREE.Vector3(-Math.sin(yaw), -0.04, -Math.cos(yaw)).normalize();
    camera.current.position.set(position.x + forward.x * 7, position.y + 3, position.z + forward.z * 7);
    camera.current.lookAt(position.x + forward.x * 180, position.y + forward.y * 180, position.z + forward.z * 180);
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={88} near={0.1} far={3500}/>;
}

function useFrameSimulation(position, missionState, setPosition, setHeading, setSpeed, setBattery, setMissionState) {
  const stateRef = useRef(position);
  useFrame((_,dt) => {
    if (!stateRef.current) stateRef.current = {...position};
    if (missionState !== "AUTONOMOUS" && missionState !== "RETURNING") { setSpeed(0); return; }
    const target = missionState === "RETURNING" ? HOME : TARGET;
    const current = stateRef.current;
    const dx=target.x-current.x, dy=target.y-current.y, dz=target.z-current.z;
    const distance=Math.hypot(dx,dy,dz);
    if(distance<8){ stateRef.current={...target}; setPosition({...target}); setSpeed(0); setMissionState("LANDED"); return; }
    const step=Math.min(distance,CRUISE_SPEED*dt);
    const next={x:current.x+(dx/distance)*step,y:current.y+(dy/distance)*step,z:current.z+(dz/distance)*step};
    stateRef.current=next; setPosition(next); setSpeed(step/Math.max(dt,0.001));
    setHeading((Math.atan2(-dx,-dz)*180/Math.PI+360)%360);
    setBattery(b=>Math.max(0,b-dt*0.018));
  });
}

function SimulationEngine(props) {
  useFrameSimulation(props.position,props.missionState,props.setPosition,props.setHeading,props.setSpeed,props.setBattery,props.setMissionState);
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
    <DroneVisionCamera position={props.position} heading={props.heading}/>
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

export default function App() {
  const [position,setPosition]=useState({...HOME});
  const [heading,setHeading]=useState(0);
  const [speed,setSpeed]=useState(0);
  const [battery,setBattery]=useState(100);
  const [missionState,setMissionState]=useState("AUTONOMOUS");
  const [estimatedPosition,setEstimatedPosition]=useState({...HOME});
  const [sensorError,setSensorError]=useState(0);

  const distance=useMemo(()=>Math.hypot(position.x-TARGET.x,position.y-TARGET.y,position.z-TARGET.z),[position]);

  useEffect(()=>{
    if(missionState!=="LANDED") return;
    const timer=setTimeout(()=>setMissionState("RETURNING"),10000);
    return()=>clearTimeout(timer);
  },[missionState]);

  return <div style={{position:"fixed",inset:0,width:"100vw",height:"100vh",overflow:"hidden",background:"#000"}}>
    <PositionEstimator position={position} setEstimatedPosition={setEstimatedPosition} setSensorError={setSensorError}/>
    <Canvas shadows gl={{antialias:true}} style={{width:"100vw",height:"100vh",display:"block"}}>
      <color attach="background" args={["#050b08"]}/>
      <fog attach="fog" args={["#050b08",250,2800]}/>
      <Scene position={position} heading={heading} missionState={missionState} setPosition={setPosition} setHeading={setHeading} setSpeed={setSpeed} setBattery={setBattery} setMissionState={setMissionState}/>
    </Canvas>

    <div style={{position:"absolute",top:16,left:16,padding:"7px 11px",border:"1px solid rgba(120,255,170,.28)",borderRadius:6,background:"rgba(0,20,10,.42)",color:"#b7ffd0",fontFamily:"monospace",fontSize:12,letterSpacing:1}}>
      DRONE VISION • GPS DENIED • VPS ACTIVE
    </div>
    <div style={{position:"absolute",left:16,bottom:16,padding:"7px 11px",borderRadius:6,background:"rgba(0,0,0,.45)",color:"#b7ffd0",fontFamily:"monospace",fontSize:12}}>
      {missionState} | {speed.toFixed(0)} m/s | {distance.toFixed(0)} m TO TARGET | BAT {battery.toFixed(0)}%
    </div>
    <div style={{position:"absolute",top:16,right:16,width:9,height:9,borderRadius:"50%",background:"#65ff9c",boxShadow:"0 0 14px #65ff9c"}}/>
    <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(circle at center,transparent 45%,rgba(0,0,0,.38) 100%),repeating-linear-gradient(0deg,rgba(120,255,160,.035) 0px,rgba(120,255,160,.035) 1px,transparent 1px,transparent 4px)"}}/>
    <div style={{position:"absolute",left:"50%",top:"50%",width:24,height:24,transform:"translate(-50%,-50%)",pointerEvents:"none"}}>
      <span style={{position:"absolute",left:11,top:0,width:2,height:8,background:"rgba(170,255,200,.7)"}}/><span style={{position:"absolute",left:11,bottom:0,width:2,height:8,background:"rgba(170,255,200,.7)"}}/><span style={{position:"absolute",left:0,top:11,width:8,height:2,background:"rgba(170,255,200,.7)"}}/><span style={{position:"absolute",right:0,top:11,width:8,height:2,background:"rgba(170,255,200,.7)"}}/>
    </div>
  </div>;
}
