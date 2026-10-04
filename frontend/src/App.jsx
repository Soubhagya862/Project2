import {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Grid,Line} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import TelemetryPanel from "./components/TelemetryPanel";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";
const HOME={x:0,y:10,z:0};

const baseObstacles=[
  {position:{x:24,y:4,z:8},size:{x:7,y:8,z:7},type:"ROCK"},
  {position:{x:42,y:3,z:-8},size:{x:6,y:6,z:6},type:"TREE"},
  {position:{x:58,y:5,z:14},size:{x:10,y:10,z:5},type:"WALL"},
  {position:{x:35,y:2.5,z:25},size:{x:5,y:5,z:5},type:"POLE"},
  {position:{x:70,y:4,z:-22},size:{x:8,y:8,z:8},type:"DEBRIS"}
];

function DroneModel({p,heading}){
  const group=useRef();
  useFrame((_,d)=>{
    if(group.current)group.current.rotation.y=THREE.MathUtils.lerp(group.current.rotation.y,-heading*Math.PI/180,d*7);
  });
  return <group ref={group} position={[p.x,p.y,p.z]}>
    <mesh castShadow><boxGeometry args={[3,.65,2.2]}/><meshStandardMaterial metalness={.75} roughness={.25}/></mesh>
    <mesh position={[0,.35,0]}><sphereGeometry args={[.45,20,12]}/><meshStandardMaterial metalness={.8} roughness={.15}/></mesh>
    <mesh position={[0,-.55,0]}><sphereGeometry args={[.3,16,10]}/><meshStandardMaterial/></mesh>
    {[[-2,.55,-1.25],[2,.55,-1.25],[-2,.55,1.25],[2,.55,1.25]].map(([x,y,z],i)=>
      <group key={i} position={[x,0,z]}>
        <mesh><cylinderGeometry args={[.12,.16,.45,16]}/><meshStandardMaterial metalness={.8}/></mesh>
        <mesh position={[0,.28,0]} rotation={[0,0,Math.PI/2]}>
          <boxGeometry args={[1.8,.07,.12]}/><meshStandardMaterial/>
        </mesh>
      </group>
    )}
    <mesh position={[0,-.35,-1.05]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[.38,.38,.18,24]}/><meshStandardMaterial/>
    </mesh>
    <pointLight position={[0,-.7,-1.2]} intensity={2} distance={7}/>
  </group>;
}

mport {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Grid,Line} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import TelemetryPanel from "./components/TelemetryPanel";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";
const HOME={x:0,y:10,z:0};

const baseObstacles=[
  {position:{x:24,y:4,z:8},size:{x:7,y:8,z:7},type:"ROCK"},
  {position:{x:42,y:3,z:-8},size:{x:6,y:6,z:6},type:"TREE"},
  {position:{x:58,y:5,z:14},size:{x:10,y:10,z:5},type:"WALL"},
  {position:{x:35,y:2.5,z:25},size:{x:5,y:5,z:5},type:"POLE"},
  {position:{x:70,y:4,z:-22},size:{x:8,y:8,z:8},type:"DEBRIS"}
];

mport {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Grid,Line} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import TelemetryPanel from "./components/TelemetryPanel";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";
const HOME={x:0,y:10,z:0};

const baseObstacles=[
  {position:{x:24,y:4,z:8},size:{x:7,y:8,z:7},type:"ROCK"},
  {position:{x:42,y:3,z:-8},size:{x:6,y:6,z:6},type:"TREE"},
  {position:{x:58,y:5,z:14},size:{x:10,y:10,z:5},type:"WALL"},
  {position:{x:35,y:2.5,z:25},size:{x:5,y:5,z:5},type:"POLE"},
  {position:{x:70,y:4,z:-22},size:{x:8,y:8,z:8},type:"DEBRIS"}
];

function DroneModel({p,heading}){
  const group=useRef();
  useFrame((_,d)=>{
    if(group.current)group.current.rotation.y=THREE.MathUtils.lerp(group.current.rotation.y,-heading*Math.PI/180,d*7);
  });
  return <group ref={group} position={[p.x,p.y,p.z]}>
    <mesh castShadow><boxGeometry args={[3,.65,2.2]}/><meshStandardMaterial metalness={.75} roughness={.25}/></mesh>
    <mesh position={[0,.35,0]}><sphereGeometry args={[.45,20,12]}/><meshStandardMaterial metalness={.8} roughness={.15}/></mesh>
    <mesh position={[0,-.55,0]}><sphereGeometry args={[.3,16,10]}/><meshStandardMaterial/></mesh>
    {[[-2,.55,-1.25],[2,.55,-1.25],[-2,.55,1.25],[2,.55,1.25]].map(([x,y,z],i)=>
      <group key={i} position={[x,0,z]}>
        <mesh><cylinderGeometry args={[.12,.16,.45,16]}/><meshStandardMaterial metalness={.8}/></mesh>
        <mesh position={[0,.28,0]} rotation={[0,0,Math.PI/2]}>
          <boxGeometry args={[1.8,.07,.12]}/><meshStandardMaterial/>
        </mesh>
      </group>
    )}
    <mesh position={[0,-.35,-1.05]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[.38,.38,.18,24]}/><meshStandardMaterial/>
    </mesh>
    <pointLight position={[0,-.7,-1.2]} intensity={2} distance={7}/>
  </group>;
}

function Obstacle({o,dynamic=false}){
  const colors={ROCK:"#77736b",TREE:"#245b35",WALL:"#8b765e",POLE:"#55585c",DEBRIS:"#6b6258"};
  const color=dynamic?"#ff304f":(colors[o.type]||"#6b7280");
  return <mesh position={[o.position.x,o.position.y,o.position.z]} castShadow>
    <boxGeometry args={[o.size.x,o.size.y,o.size.z]}/>
    <meshStandardMaterial transparent opacity={dynamic?.78:.95} metalness={.15} roughness={.75} color={color} emissive={dynamic?new THREE.Color("#ff2f55"):new THREE.Color("#000000")} emissiveIntensity={dynamic?.65:0}/>
  </mesh>;
}
