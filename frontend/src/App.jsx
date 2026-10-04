import {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Grid,Line,OrbitControls} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import TelemetryPanel from "./components/TelemetryPanel";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";
const WORLD={minX:-1500,maxX:1500,minY:5,maxY:300,minZ:-1500,maxZ:1500};
const HOME={x:0,y:80,z:0};
const FLIGHT_STEP=20;

const baseObstacles=[
  {position:{x:180,y:90,z:0},size:{x:120,y:180,z:100},type:"BUILDING"},
  {position:{x:420,y:130,z:220},size:{x:120,y:260,z:120},type:"BUILDING"},
  {position:{x:760,y:90,z:-260},size:{x:160,y:180,z:120},type:"BUILDING"},
  {position:{x:-280,y:110,z:-360},size:{x:140,y:220,z:130},type:"BUILDING"}
];

const cityBuildings=Array.from({length:180},(_,i)=>({
  x:-1450+(i*317)%2900,
  z:-1450+((i*577)%2900),
  w:45+(i%5)*18,
  d:45+(i%4)*20,
  h:35+(i%12)*22
})).filter(b=>Math.hypot(b.x,b.z)>120);

function DroneModel({p,heading}){
  const group=useRef();
  const rotors=useRef([]);
  useFrame((_,d)=>{
    if(group.current)group.current.rotation.y=THREE.MathUtils.lerp(group.current.rotation.y,-heading*Math.PI/180,d*8);
    rotors.current.forEach(r=>{if(r)r.rotation.y+=d*28});
  });
  const arms=[[-2.7,0,-1.8],[2.7,0,-1.8],[-2.7,0,1.8],[2.7,0,1.8]];
  return <group ref={group} position={[p.x,p.y,p.z]} scale={[1.15,1.15,1.15]}>
    <mesh castShadow><capsuleGeometry args={[0.9,2.8,8,20]}/><meshStandardMaterial metalness={.9} roughness={.18}/></mesh>
    <mesh position={[0,.45,0]} scale={[.8,.35,.8]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial metalness={.45} roughness={.12}/></mesh>
    <mesh position={[0,-.55,0]}><cylinderGeometry args={[.32,.5,.35,20]}/><meshStandardMaterial metalness={.8} roughness={.2}/></mesh>
    <pointLight position={[0,-.8,-1.2]} intensity={3} distance={12}/>
    {arms.map(([x,y,z],i)=><group key={i} position={[x,y,z]}>
      <mesh rotation={[0,0,Math.atan2(z,x)]}><boxGeometry args={[3.6,.18,.22]}/><meshStandardMaterial metalness={.8} roughness={.2}/></mesh>
      <group ref={el=>rotors.current[i]=el} position={[0,.35,0]}>
        <mesh><cylinderGeometry args={[.22,.22,.18,20]}/><meshStandardMaterial metalness={.9}/></mesh>
        <mesh rotation={[Math.PI/2,0,0]}><boxGeometry args={[2.4,.08,.16]}/><meshStandardMaterial/></mesh>
        <mesh rotation={[Math.PI/2,0,Math.PI/2]}><boxGeometry args={[2.4,.08,.16]}/><meshStandardMaterial/></mesh>
      </group>
    </group>)}
  </group>;
}
