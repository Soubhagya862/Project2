import {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Grid,Line} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
function getLanBackendUrl(){
  const configured=import.meta.env.VITE_SOCKET_URL?.trim();
  if(configured)return configured.replace(/\/$/,"");
  const host=window.location.hostname;
  return `http://${host}:5000`;
}
const SOCKET_URL=getLanBackendUrl();
const COMMAND_API=(import.meta.env.VITE_API_URL||`${window.location.protocol}//${window.location.hostname}:5000/api`).replace(/\/$/,"");

const HOME={x:0,y:2,z:0};
const WORLD={minX:-1500,maxX:1500,minY:5,maxY:300,minZ:-1500,maxZ:1500};

const BASE_OBSTACLES=[
 {id:"rock-1",position:{x:220,y:35,z:120},size:{x:90,y:70,z:90},type:"ROCK"},
 {id:"tree-1",position:{x:420,y:60,z:-220},size:{x:80,y:120,z:80},type:"TREE"},
 {id:"wall-1",position:{x:620,y:55,z:260},size:{x:220,y:100,z:45},type:"WALL"},
 {id:"pole-1",position:{x:500,y:70,z:480},size:{x:35,y:140,z:35},type:"POLE"},
 {id:"debris-1",position:{x:800,y:45,z:-420},size:{x:140,y:90,z:110},type:"DEBRIS"},
 {id:"rock-2",position:{x:1100,y:45,z:520},size:{x:120,y:90,z:120},type:"ROCK"}
];

function Terrain(){
 const patches=useMemo(()=>Array.from({length:28},(_,i)=>({
   x:-1450+(i*137)%2900,z:-1400+(i*193)%2800,s:45+(i%5)*25,r:(i*37)%360
 })),[]);
 return <group>
   <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
     <planeGeometry args={[3000,3000,1,1]}/>
     <meshStandardMaterial color="#253828" roughness={1}/>
   </mesh>
   {patches.map((p,i)=><mesh key={i} position={[p.x,.04,p.z]} rotation={[-Math.PI/2,0,p.r*Math.PI/180]}>
     <circleGeometry args={[p.s,12]}/>
     <meshStandardMaterial color={i%2?"#31482f":"#3a5135"} roughness={1}/>
   </mesh>)}
   <Grid args={[3000,3000]} position={[0,.08,0]} sectionSize={10} cellSize={2} fadeDistance={1800} fadeStrength={1}/>
 </group>;
}

function Tree({o}){
 return <group position={[o.position.x,0,o.position.z]}>
   <mesh position={[0,o.size.y*.28,0]} castShadow><cylinderGeometry args={[.7,.9,o.size.y*.55,10]}/><meshStandardMaterial color="#5b3925" roughness={1}/></mesh>
   <mesh position={[0,o.size.y*.58,0]} castShadow><coneGeometry args={[o.size.x*.8,o.size.y*.75,12]}/><meshStandardMaterial color="#244d2a" roughness={1}/></mesh>
   <mesh position={[0,o.size.y*.78,0]} castShadow><coneGeometry args={[o.size.x*.62,o.size.y*.55,12]}/><meshStandardMaterial color="#326237" roughness={1}/></mesh>
 </group>;
}

function Rock({o}){
 return <mesh position={[o.position.x,o.position.y*.45,o.position.z]} scale={[1,.75,1]} rotation={[.1,.4,.08]} castShadow>
   <dodecahedronGeometry args={[o.size.x*.55,1]}/><meshStandardMaterial color="#77736b" roughness={.95}/>
 </mesh>;
}

function Wall({o}){
 return <mesh position={[o.position.x,o.position.y,o.position.z]} castShadow>
   <boxGeometry args={[o.size.x,o.size.y,o.size.z]}/><meshStandardMaterial color="#8b8476" roughness={.9}/>
 </mesh>;
}

function Pole({o}){
 return <group position={[o.position.x,0,o.position.z]}>
   <mesh position={[0,o.size.y/2,0]} castShadow><cylinderGeometry args={[.35,.45,o.size.y,12]}/><meshStandardMaterial color="#555a5c" metalness={.4}/></mesh>
   <mesh position={[0,o.size.y*.88,0]}><boxGeometry args={[5,.3,.3]}/><meshStandardMaterial color="#4d5254" metalness={.5}/></mesh>
 </group>;
}

function Debris({o,dynamic=false}){
 return <group position={[o.position.x,o.position.y*.35,o.position.z]}>
   {[0,1,2].map(i=><mesh key={i} position={[(i-1)*2,0,(i%2)*2-1]} rotation={[i*.5,i*.8,.2]} castShadow>
     <boxGeometry args={[o.size.x*.45,o.size.y*.55,o.size.z*.35]}/><meshStandardMaterial color={dynamic?"#b43b32":"#65584d"} roughness={.9}/>
   </mesh>)}
 </group>;
}

function ObstacleView({o}){
 if(o.type==="TREE")return <Tree o={o}/>;
 if(o.type==="ROCK")return <Rock o={o}/>;
 if(o.type==="WALL")return <Wall o={o}/>;
 if(o.type==="POLE")return <Pole o={o}/>;
 return <Debris o={o} dynamic={o.type==="DYNAMIC"}/>;
}

function DroneModel({position,heading,flying}){
 const ref=useRef();
 const visualPos=useRef(new THREE.Vector3(position.x,position.y,position.z));
 const propRefs=useRef([]);
 useFrame((_,delta)=>{
   if(!ref.current)return;
   const a=heading*Math.PI/180;
   visualPos.current.lerp(new THREE.Vector3(position.x,position.y,position.z),1-Math.pow(.0001,Math.min(delta,.033)));
   ref.current.position.copy(visualPos.current);
   ref.current.rotation.y=THREE.MathUtils.lerp(ref.current.rotation.y,-a,1-Math.pow(.0001,Math.min(delta,.033)));
   propRefs.current.forEach(r=>{if(r&&flying)r.rotation.y+=delta*45;});
   if(flying)ref.current.rotation.z=THREE.MathUtils.lerp(ref.current.rotation.z,0.035,0.08);
   else ref.current.rotation.z=THREE.MathUtils.lerp(ref.current.rotation.z,0,0.08);
 });
 return <group ref={ref} position={[position.x,position.y,position.z]}>
   <group rotation={[0,0,0]}>
    <mesh castShadow scale={[1.25,.42,.78]}><sphereGeometry args={[2.15,32,20]}/><meshStandardMaterial color="#151a20" metalness={.92} roughness={.2}/></mesh>
    <mesh position={[0,.15,-.35]} scale={[.7,.2,.5]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color="#252d36" metalness={.8} roughness={.22}/></mesh>
    <mesh position={[0,-.05,-1.72]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.46,.58,.22,32]}/><meshStandardMaterial color="#080b0f" metalness={.8}/></mesh>
    <mesh position={[0,-.22,-1.96]} rotation={[Math.PI/2,0,0]}><sphereGeometry args={[.28,20,12]}/><meshStandardMaterial color="#05080b" metalness={.7}/></mesh>
    <mesh position={[0,.18,-2.03]}><boxGeometry args={[.72,.18,.32]}/><meshStandardMaterial color="#111820" metalness={.8}/></mesh>
    {[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz],i)=><group key={i} position={[sx*2.15,.02,sz*1.35]} rotation={[0,sx*sz*.28,0]}>
      <mesh castShadow rotation={[0,0,sx*-.06]}><boxGeometry args={[3.15,.22,.32]}/><meshStandardMaterial color="#252d35" metalness={.9} roughness={.2}/></mesh>
      <mesh position={[sx*.95,.08,0]}><cylinderGeometry args={[.42,.5,.22,20]}/><meshStandardMaterial color="#090d12" metalness={.9}/></mesh>
      <mesh ref={el=>propRefs.current[i]=el} position={[0,.24,0]}><boxGeometry args={[2.55,.07,.13]}/><meshStandardMaterial color="#090c10" metalness={.85}/></mesh>
      <mesh position={[0,.24,0]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[2.55,.05,.1]}/><meshStandardMaterial color="#090c10" metalness={.85}/></mesh>
    </group>)}
    <mesh position={[-1.25,-.75,.45]} rotation={[0,0,.18]}><boxGeometry args={[.18,.9,.18]}/><meshStandardMaterial color="#151a20" metalness={.8}/></mesh>
    <mesh position={[1.25,-.75,.45]} rotation={[0,0,-.18]}><boxGeometry args={[.18,.9,.18]}/><meshStandardMaterial color="#151a20" metalness={.8}/></mesh>
    <mesh position={[-1.25,-.75,-.2]} rotation={[0,0,.18]}><boxGeometry args={[.18,.9,.18]}/><meshStandardMaterial color="#151a20" metalness={.8}/></mesh>
    <mesh position={[1.25,-.75,-.2]} rotation={[0,0,-.18]}><boxGeometry args={[.18,.9,.18]}/><meshStandardMaterial color="#151a20" metalness={.8}/></mesh>
    <pointLight position={[-2.1,.15,1.35]} intensity={flying?5:1} distance={12} color="#ff334f"/>
    <pointLight position={[2.1,.15,1.35]} intensity={flying?5:1} distance={12} color="#35e8ff"/>
    <pointLight position={[0,-.45,-2]} intensity={flying?4:1} distance={10} color="#e8f7ff"/>
   </group>
 </group>;
}
