import {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Grid,Line} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=(()=>{const v=import.meta.env.VITE_API_URL?.trim();if(v&&!v.includes("localhost")&&!v.includes("127.0.0.1"))return v.endsWith("/")?v.slice(0,-1):v;return window.location.protocol+"//"+window.location.hostname+":5000/api";})();
function getLanBackendUrl(){
  const configured=import.meta.env.VITE_SOCKET_URL?.trim();
  if(configured)return configured.endsWith("/")?configured.slice(0,-1):configured;
  const host=window.location.hostname;
  return `http://${host}:5000`;
}
const SOCKET_URL=getLanBackendUrl();
const COMMAND_API=(()=>{const v=import.meta.env.VITE_API_URL?.trim();if(v&&!v.includes("localhost")&&!v.includes("127.0.0.1"))return v.endsWith("/")?v.slice(0,-1):v;return `${window.location.protocol}//${window.location.hostname}:5000/api`;})();

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
     <circleGeometry args={[p.s,12]}/><meshStandardMaterial color={i%2?"#31482f":"#3a5135"} roughness={1}/>
   </mesh>)}
   <Grid args={[3000,3000]} position={[0,.08,0]} sectionSize={10} cellSize={2} fadeDistance={1800} fadeStrength={1}/>
 </group>;
}

function Tree({o}){return <group position={[o.position.x,0,o.position.z]}>
 <mesh position={[0,o.size.y*.28,0]} castShadow><cylinderGeometry args={[.7,.9,o.size.y*.55,10]}/><meshStandardMaterial color="#5b3925" roughness={1}/></mesh>
 <mesh position={[0,o.size.y*.58,0]} castShadow><coneGeometry args={[o.size.x*.8,o.size.y*.75,12]}/><meshStandardMaterial color="#244d2a" roughness={1}/></mesh>
 <mesh position={[0,o.size.y*.78,0]} castShadow><coneGeometry args={[o.size.x*.62,o.size.y*.55,12]}/><meshStandardMaterial color="#326237" roughness={1}/></mesh>
 </group>;}

function Rock({o}){return <mesh position={[o.position.x,o.position.y*.45,o.position.z]} scale={[1,.75,1]} rotation={[.1,.4,.08]} castShadow>
 <dodecahedronGeometry args={[o.size.x*.55,1]}/><meshStandardMaterial color="#77736b" roughness={.95}/></mesh>;}

function Wall({o}){return <mesh position={[o.position.x,o.position.y,o.position.z]} castShadow>
 <boxGeometry args={[o.size.x,o.size.y,o.size.z]}/><meshStandardMaterial color="#8b8476" roughness={.9}/></mesh>;}

function Pole({o}){return <group position={[o.position.x,0,o.position.z]}>
 <mesh position={[0,o.size.y/2,0]} castShadow><cylinderGeometry args={[.35,.45,o.size.y,12]}/><meshStandardMaterial color="#555a5c" metalness={.4}/></mesh>
 <mesh position={[0,o.size.y*.88,0]}><boxGeometry args={[5,.3,.3]}/><meshStandardMaterial color="#4d5254" metalness={.5}/></mesh>
 </group>;}

function Debris({o,dynamic=false}){return <group position={[o.position.x,o.position.y*.35,o.position.z]}>
 {[0,1,2].map(i=><mesh key={i} position={[(i-1)*2,0,(i%2)*2-1]} rotation={[i*.5,i*.8,.2]} castShadow>
 <boxGeometry args={[o.size.x*.45,o.size.y*.55,o.size.z*.35]}/><meshStandardMaterial color={dynamic?"#b43b32":"#65584d"} roughness={.9}/></mesh>)}
 </group>;}

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
   if(flying)propRefs.current.forEach(r=>{if(r)r.rotation.y+=delta*32;});
 });
 return <group ref={ref} position={[position.x,position.y,position.z]}>
   <mesh castShadow><boxGeometry args={[3.8,.7,2.6]}/><meshStandardMaterial color="#242b31" metalness={.85} roughness={.22}/></mesh>
   <mesh position={[0,.25,0]}><sphereGeometry args={[.48,24,16]}/><meshStandardMaterial color="#111820" metalness={.9}/></mesh>
   <mesh position={[0,-.42,-1.05]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.42,.42,.16,24]}/><meshStandardMaterial color="#111820" metalness={.7}/></mesh>
   {[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz],i)=><group key={"arm"+i} position={[sx*1.75,.05,sz*1.05]} rotation={[0,sx*sz*.18,0]}>
     <mesh castShadow><boxGeometry args={[2.7,.16,.28]}/><meshStandardMaterial color="#343d44" metalness={.8} roughness={.25}/></mesh>
     <mesh position={[sx*.95,.05,sz*.15]}><boxGeometry args={[.55,.12,.55]}/><meshStandardMaterial color="#171d22" metalness={.75}/></mesh>
   </group>)}
   {[[-2,.55,-1.25],[2,.55,-1.25],[-2,.55,1.25],[2,.55,1.25]].map(([x,y,z],i)=><group key={i} position={[x,0,z]}>
     <mesh><cylinderGeometry args={[.13,.17,.55,12]}/><meshStandardMaterial color="#30383e" metalness={.8}/></mesh>
     <mesh ref={el=>propRefs.current[i]=el} position={[0,.35,0]}><boxGeometry args={[2.2,.06,.12]}/><meshStandardMaterial color="#0d1115" metalness={.7}/></mesh>
     <mesh position={[0,.35,0]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[2.2,.04,.1]}/><meshStandardMaterial color="#0d1115" metalness={.7}/></mesh>
   </group>)}
   <pointLight position={[0,-.65,-1.25]} intensity={3} distance={10} color="#59e7ff"/>
 </group>;
}

function DroneCamera({position,heading}){
 const {camera}=useThree();const init=useRef(false);
 useFrame((_,delta)=>{
   const a=heading*Math.PI/180;
   const behind=new THREE.Vector3(position.x-Math.cos(a)*20,position.y+9,position.z-Math.sin(a)*20);
   const look=new THREE.Vector3(position.x+Math.cos(a)*18,position.y-1,position.z+Math.sin(a)*18);
   if(!init.current){camera.position.copy(behind);init.current=true;}
   camera.position.lerp(behind,1-Math.pow(.001,Math.min(delta,.05)));camera.lookAt(look);
 });
 return null;
}

function Route({path,returning}){const points=useMemo(()=>path.map(p=>[p.x,p.y+.15,p.z]),[path]);return points.length>1?<Line points={points} color={returning?"#ffd34d":"#39e7ff"} lineWidth={4}/>:null;}

function TargetMarker({target,home=false}){return <group position={[target.x,target.y,target.z]}>
 <mesh><cylinderGeometry args={[2.2,2.2,.18,32]}/><meshStandardMaterial color={home?"#4d8cff":"#4dff9a"} emissive={new THREE.Color(home?"#1644aa":"#0d8c4c")} emissiveIntensity={1.5}/></mesh>
 <mesh position={[0,1,0]}><sphereGeometry args={[.6,20,12]}/><meshStandardMaterial emissive={new THREE.Color(home?"#4d8cff":"#4dff9a")} emissiveIntensity={2}/></mesh>
 </group>;}

function App(){
 const socketRef=useRef(null),idx=useRef(0),pathRef=useRef([]),missionRef=useRef(null),replanLock=useRef(false),returning=useRef(false),manualAnnounced=useRef(false),manualMotionRef=useRef({vx:0,vy:0,vz:0,yaw:0,until:0}),lastCommandIdRef=useRef(0),commandBusyRef=useRef(false),landingBusyRef=useRef(false);
 const [pos,setPos]=useState({...HOME}),[target,setTarget]=useState({x:700,y:60,z:450}),[path,setPath]=useState([]);
 const [obstacles,setObstacles]=useState(BASE_OBSTACLES),[gps,setGps]=useState(true),[mode,setMode]=useState("MANUAL");
 const [status,setStatus]=useState("READY"),[phase,setPhase]=useState("IDLE"),[speed,setSpeed]=useState(0),[heading,setHeading]=useState(0);
 const [mission,setMission]=useState(null),[sensor,setSensor]=useState(false),[sensorDistance,setSensorDistance]=useState(14),[message,setMessage]=useState("Choose a destination to begin");
 const [phoneConnected,setPhoneConnected]=useState(false),[phoneCommand,setPhoneCommand]=useState("STOP"),[remoteControl,setRemoteControl]=useState("STOP"),[destinationChosen,setDestinationChosen]=useState(false),[landing,setLanding]=useState(false),[takeoffCountdown,setTakeoffCountdown]=useState(null),[audioReady,setAudioReady]=useState(false);
 pathRef.current=path;missionRef.current=mission;
 const flying=pos.y>2.5;
 const speak=text=>{try{window.speechSynthesis?.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;window.speechSynthesis?.speak(u);setAudioReady(true)}catch{}};

 const patchMission=async data=>{if(!missionRef.current?._id)return;try{await fetch(API+`/missions/${missionRef.current._id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})}catch{}};
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 const isBlocked=p=>obstacles.some(o=>Math.abs(p.x-o.position.x)<o.size.x/2+2.5&&Math.abs(p.y-o.position.y)<o.size.y/2+2.5&&Math.abs(p.z-o.position.z)<o.size.z/2+2.5);

 async function calculate(from=pos,to=target){
   try{
    const r=await fetch(API+"/routes/calculate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:from,goal:to,obstacles})});
    if(!r.ok)throw Error();const d=await r.json(),route=d.route||[];setPath(route);idx.current=0;
    setMessage(route.length?"Safe 3D A* route calculated":"No safe route found");return route;
   }catch{setPath([]);setMessage("Route server unavailable — start backend on port 5000");return []}
 }

 async function chooseTarget(t=target){
   const safe={x:THREE.MathUtils.clamp(Number(t.x)||0,WORLD.minX,WORLD.maxX),y:THREE.MathUtils.clamp(Number(t.y)||12,WORLD.minY,WORLD.maxY),z:THREE.MathUtils.clamp(Number(t.z)||0,WORLD.minZ,WORLD.maxZ)};
   setTarget(safe);setDestinationChosen(true);setMode("MANUAL");setStatus("DESTINATION SELECTED");setPhase("READY FOR ROUTE");
   const r=await calculate(pos,safe);if(r.length){setMessage("Destination locked — safe route calculated");await createMission(safe,r);}
 }
 async function createMission(targetPoint=target,routeInput=path){
   if(!destinationChosen){setMessage("Choose a destination first");return null}
   const r=routeInput?.length?routeInput:await calculate(pos,targetPoint);if(!r.length)return null;
   try{const res=await fetch(API+"/missions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:HOME,target:targetPoint,route:r,gpsStatus:gps?"CONNECTED":"DENIED",status:"READY",phase:"PLANNED"})});if(!res.ok)throw Error();
    const m=await res.json();setMission(m);missionRef.current=m;setStatus("MISSION CREATED");setPhase("PLANNED");setMessage("Mission saved and ready");return m;
   }catch{setMessage("Mission save unavailable — simulation will continue locally");return null}
 }
 function manualMove(cmd){
   if(pos.y<=2.5&&cmd!=="ASCEND"){setMessage("Drone is on the ground — press TAKE OFF first");return}
   setMode("MANUAL");setStatus("MANUAL FLIGHT");setPhase("REMOTE PILOT CONTROL");
   if(!manualAnnounced.current){manualAnnounced.current=true;speak("Remote control active");setMessage("Remote control active — smooth flight control");}
   const now=performance.now(),cruiseSpeed=24,altitudeSpeed=10,yawSpeed=75,h=heading*Math.PI/180;
   const forwardX=Math.cos(h),forwardZ=Math.sin(h),rightX=-Math.sin(h),rightZ=Math.cos(h);let vx=0,vy=0,vz=0,yaw=0;
   if(cmd==="UP"){vx=forwardX*cruiseSpeed;vz=forwardZ*cruiseSpeed}else if(cmd==="DOWN"){vx=-forwardX*cruiseSpeed;vz=-forwardZ*cruiseSpeed}else if(cmd==="LEFT"){vx=-rightX*cruiseSpeed;vz=-rightZ*cruiseSpeed}else if(cmd==="RIGHT"){vx=rightX*cruiseSpeed;vz=rightZ*cruiseSpeed}else if(cmd==="UP_LEFT"){vx=forwardX*cruiseSpeed-rightX*cruiseSpeed*.7;vz=forwardZ*cruiseSpeed-rightZ*cruiseSpeed*.7}else if(cmd==="UP_RIGHT"){vx=forwardX*cruiseSpeed+rightX*cruiseSpeed*.7;vz=forwardZ*cruiseSpeed+rightZ*cruiseSpeed*.7}else if(cmd==="DOWN_LEFT"){vx=-forwardX*cruiseSpeed-rightX*cruiseSpeed*.7;vz=-forwardZ*cruiseSpeed-rightZ*cruiseSpeed*.7}else if(cmd==="DOWN_RIGHT"){vx=-forwardX*cruiseSpeed+rightX*cruiseSpeed*.7;vz=-forwardZ*cruiseSpeed+rightZ*cruiseSpeed*.7}else if(cmd==="ASCEND"){vy=altitudeSpeed}else if(cmd==="DESCEND"){vy=-altitudeSpeed}else if(cmd==="YAW_LEFT"){yaw=yawSpeed}else if(cmd==="YAW_RIGHT"){yaw=-yawSpeed}else return;
   manualMotionRef.current={vx,vy,vz,yaw,until:now+420};setSpeed(Math.hypot(vx,vz)+Math.abs(vy));
   if(yaw)setPhase(cmd==="YAW_LEFT"?"YAW LEFT":"YAW RIGHT");else if(vy>0)setPhase("ASCENDING");else if(vy<0)setPhase("DESCENDING");
 }
 async function startAutopilot(){
   if(commandBusyRef.current||takeoffCountdown!==null||flying)return;
   commandBusyRef.current=true;
   try{
     setLanding(false);returning.current=false;setTakeoffCountdown(null);setMode("MANUAL");
     setStatus("TAKEOFF");setPhase("REMOTE TAKE OFF COMMAND");setSpeed(0);setMessage("TAKE OFF command received");
     speak("Drone is taking off");
     await new Promise(r=>setTimeout(r,250));
     setPos(p=>({...p,y:30}));
     setStatus("AIRBORNE");setPhase("MANUAL FLIGHT READY");setMode("MANUAL");setSpeed(0);
     manualMotionRef.current={vx:0,vy:0,vz:0,yaw:0,until:0};manualAnnounced.current=false;
     setMessage("AIRBORNE — controller commands are active");
   }finally{commandBusyRef.current=false}
 }
 async function stopFlight(){
   if(landingBusyRef.current)return;
   landingBusyRef.current=true;
   manualMotionRef.current={vx:0,vy:0,vz:0,yaw:0,until:0};setLanding(false);setMode("MANUAL");setStatus("LANDING");setPhase("REMOTE LAND COMMAND");setSpeed(3);
   const startY=pos.y;if(startY<=2.5){setPos(p=>({...p,y:2}));setSpeed(0);setStatus("LANDED");setPhase("LANDED");landingBusyRef.current=false;return}
   const steps=Math.max(1,Math.ceil((startY-2)/2));for(let i=1;i<=steps;i++){await new Promise(r=>setTimeout(r,80));setPos(p=>({...p,y:Math.max(2,startY-(startY-2)*(i/steps))}))}
   setSpeed(0);setStatus("LANDED");setPhase("LANDED");setMessage("LAND command completed");await patchMission({status:"LANDED",phase:"LANDED"});landingBusyRef.current=false;
 }
 async function emergencyAutopilot(){
   if(!destinationChosen){setMessage("Choose destination before emergency test");return}
   if(takeoffCountdown!==null)return;
   setGps(false);setMode("EMERGENCY AUTOPILOT");const r=await calculate(pos,target);if(!r.length)return;
   for(let i=5;i>0;i--){setTakeoffCountdown(i);await new Promise(res=>setTimeout(res,1000))}
   setTakeoffCountdown(null);setPos(p=>({...p,y:30}));setStatus("READY FOR TAKEOFF");setPhase("TAKEOFF COMPLETE");setSpeed(0);
   speak("Your drone is ready to take off");await new Promise(res=>setTimeout(res,700));setStatus("EMERGENCY AUTOPILOT");setPhase("GPS DENIED — SENSOR NAVIGATION");setSpeed(50);setMessage("Your drone is going towards the location");speak("Your drone is going towards the location");await patchMission({gpsStatus:"DENIED",status:"EMERGENCY AUTOPILOT",phase:"GPS DENIED — SENSOR NAVIGATION",route:r});
 }
 async function toggleGps(){
   const next=!gps;setGps(next);
   if(!next){await emergencyAutopilot()}else{setStatus("GPS RESTORED");setPhase("GPS CONNECTED");setMessage("GPS restored — awaiting pilot/autopilot command");if(mode==="EMERGENCY AUTOPILOT")setMode("MANUAL");await patchMission({gpsStatus:"CONNECTED",status:"READY",phase:"GPS CONNECTED"})}
 }
 async function replan(currentObstacles=obstacles){
   if(replanLock.current)return;replanLock.current=true;setSensor(true);setStatus("OBSTACLE DETECTED");setPhase("REAL-TIME REPLANNING");setSpeed(0);
   try{const r=await fetch(API+"/routes/replan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:pos,goal:returning.current?HOME:target,obstacles:currentObstacles})});const d=r.ok?await r.json():null;const route=d?.route||[];
    if(!route.length){setStatus("ROUTE BLOCKED");setPhase("HOLD POSITION");setMessage("No safe route found — drone holding");return}
    setPath(route);idx.current=0;setSensor(false);setMode(gps?"AUTOPILOT":"EMERGENCY AUTOPILOT");setStatus(gps?"AUTOPILOT ACTIVE":"EMERGENCY AUTOPILOT");setPhase("REPLANNED SAFE ROUTE");setSpeed(50);setMessage("Obstacle avoided — new route locked");await patchMission({status:gps?"AUTOPILOT":"EMERGENCY AUTOPILOT",phase:"REPLANNED SAFE ROUTE",route});
   }catch{setStatus("REPLANNING ERROR");setMessage("Backend replan unavailable")}finally{setTimeout(()=>{replanLock.current=false},700)}
 }
 const hoverFlight=()=>{manualMotionRef.current={vx:0,vy:0,vz:0,yaw:0,until:0};setSpeed(0);setRemoteControl("HOVER");setStatus(flying?"HOVER":"LANDED");setPhase(flying?"HOLD POSITION":"ON GROUND");setMessage(flying?"Drone holding position":"Drone is on the ground")};
 const commandHandlerRef=useRef(null);
 commandHandlerRef.current=async cmd=>{
   const command=String(cmd||"").trim().toUpperCase();
   setPhoneCommand(command);setRemoteControl(command);
   if(command==="START")return startAutopilot();
   if(command==="LAND"||command==="STOP")return stopFlight();
   if(command==="HOVER")return hoverFlight();
   if(command==="EMERGENCY")return emergencyAutopilot();
   if(command==="AUTOPILOT"){if(!destinationChosen){setMessage("Choose and confirm a target first");return}const r=pathRef.current.length?pathRef.current:await calculate(pos,target);if(!r.length)return;setPath(r);idx.current=0;setMode("AUTOPILOT");setStatus("AUTOPILOT ACTIVE");setPhase("FOLLOWING SAFE 3D ROUTE");setSpeed(10);setMessage("Autopilot command accepted — following route");return}
   if(command==="GPS_TOGGLE")return toggleGps();
   if(command.startsWith("TARGET:")){try{const t=JSON.parse(command.slice(7));await chooseTarget(t);setRemoteControl("TARGET")}catch{setMessage("Invalid remote target")}return}
   if(["UP","DOWN","LEFT","RIGHT","UP_LEFT","UP_RIGHT","DOWN_LEFT","DOWN_RIGHT","ASCEND","DESCEND","YAW_LEFT","YAW_RIGHT"].includes(command))return manualMove(command);
   setMessage("Unknown controller command: "+command);
 };
 useEffect(()=>{const s=io(SOCKET_URL,{transports:["websocket","polling"],reconnection:true});socketRef.current=s;s.on("connect",()=>{setPhoneConnected(true);s.emit("register-client",{role:"simulator"})});s.on("disconnect",()=>setPhoneConnected(false));s.on("flight-control-command",payload=>{const id=typeof payload==="object"?Number(payload.id||0):0;const command=typeof payload==="string"?payload:payload?.command;if(id&&id<=lastCommandIdRef.current)return;if(id)lastCommandIdRef.current=id;if(command)commandHandlerRef.current?.(command)});return()=>s.disconnect()},[]);
 useEffect(()=>{let cancelled=false;const poll=setInterval(async()=>{if(cancelled)return;try{const r=await fetch(COMMAND_API+"/flight-command?client=simulator",{cache:"no-store"});if(!r.ok)return;const d=await r.json();if(d?.id&&d.id>lastCommandIdRef.current){lastCommandIdRef.current=d.id;commandHandlerRef.current?.(d.command)}}catch{}},100);return()=>{cancelled=true;clearInterval(poll)}},[]);
 useEffect(()=>{let raf=0,lastTime=performance.now();const tick=now=>{const dt=Math.min((now-lastTime)/1000,.033);lastTime=now;const m=manualMotionRef.current;if(mode==="MANUAL"&&now<m.until){setPos(p=>({x:THREE.MathUtils.clamp(p.x+m.vx*dt,WORLD.minX,WORLD.maxX),y:THREE.MathUtils.clamp(p.y+m.vy*dt,2,WORLD.maxY),z:THREE.MathUtils.clamp(p.z+m.vz*dt,WORLD.minZ,WORLD.maxZ)}));if(m.yaw)setHeading(h=>h+m.yaw*dt)}else if(mode==="MANUAL"&&m.until!==0){manualMotionRef.current={vx:0,vy:0,vz:0,yaw:0,until:0};setSpeed(0);setPhase("REMOTE CONTROL IDLE")}raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[mode]);
 useEffect(()=>{if(!["AUTOPILOT","EMERGENCY AUTOPILOT"].includes(mode)||!path.length)return;let alive=true;const timer=setInterval(async()=>{if(!alive)return;const n=path[idx.current];if(!n){clearInterval(timer);setSpeed(0);setLanding(true);setStatus(returning.current?"HOME ARRIVAL":"TARGET REACHED");setPhase("LANDING");setMessage(returning.current?"Returning home — landing":"Target reached — precision landing");return}if(isBlocked(n)){await replan();return}const d=distance(pos,n),step=Math.min(3.5,d);if(d<.05){idx.current++;return}const ratio=step/d,next={x:pos.x+(n.x-pos.x)*ratio,y:pos.y+(n.y-pos.y)*ratio,z:pos.z+(n.z-pos.z)*ratio};setHeading(Math.atan2(n.z-pos.z,n.x-pos.x)*180/Math.PI);setPos(next);setSpeed(10);idx.current=distance(next,n)<.15?idx.current+1:idx.current},70);return()=>{alive=false;clearInterval(timer)}},[mode,path,pos,obstacles]);
 useEffect(()=>{if(!landing)return;const timer=setTimeout(async()=>{const landingY=returning.current?HOME.y:2;const startY=pos.y;const steps=Math.max(1,Math.ceil(Math.max(0,startY-landingY)/3));setStatus("LANDING");setPhase(returning.current?"HOME LANDING":"PRECISION LANDING");for(let i=1;i<=steps;i++){await new Promise(r=>setTimeout(r,70));setPos(p=>({...p,y:Math.max(landingY,startY-(startY-landingY)*(i/steps))}))}setPos(p=>({...p,y:landingY}));setSpeed(0);setStatus(returning.current?"MISSION COMPLETE":"LANDED");setPhase(returning.current?"HOME LANDED":"WAITING 10s");await patchMission({status:returning.current?"MISSION COMPLETE":"LANDED",phase:returning.current?"HOME LANDED":"WAITING 10s"});if(!returning.current){await new Promise(r=>setTimeout(r,10000));returning.current=true;setPos(p=>({...p,y:30}));setStatus("RETURN TAKEOFF");setPhase("AUTONOMOUS TAKEOFF");await new Promise(r=>setTimeout(r,600));const r=await calculate({...pos,y:30},HOME);if(!r.length){setStatus("RETURN ROUTE BLOCKED");setPhase("RETURN FAILED");return}setPath(r);idx.current=0;setLanding(false);setMode(gps?"AUTOPILOT":"EMERGENCY AUTOPILOT");setStatus("RETURNING HOME");setPhase("AUTONOMOUS RETURN TO HOME");setSpeed(10);setMessage("10-second landing wait complete — taking off and returning home");await patchMission({status:"RETURNING HOME",phase:"AUTONOMOUS RETURN TO HOME",route:r})}},1200);return()=>clearTimeout(timer)},[landing]);
 useEffect(()=>{const timer=setInterval(()=>{socketRef.current?.emit("phone-telemetry",{x:pos.x,y:pos.y,z:pos.z,speed,heading,gps:gps?"CONNECTED":"DENIED",status,phase,mode,target,home:HOME,distanceToTarget:distance(pos,target),sensorDistance});if(mission?._id){fetch(API+`/telemetry`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({missionId:mission._id,position:pos,altitude:pos.y,speed,heading,gpsStatus:gps?"CONNECTED":"DENIED",obstacleDetected:sensor,sensorDistance,status,phase,mode})}).catch(()=>{})}},400);return()=>clearInterval(timer)},[mission,pos,speed,heading,gps,sensor,sensorDistance,status,phase,mode,target]);
 const dist=distance(pos,target),eta=Math.ceil(dist/50);
 return <div className="app">
  <header className="topbar"><div><h1>NAVIGATE-X <span>◈</span></h1><p>GPS-DENIED AUTONOMOUS NAVIGATION SIMULATOR</p></div><div className="top-status"><span className={gps?"ok":"danger"}>● GPS {gps?"CONNECTED":"LOST"}</span><span className={phoneConnected?"ok":"danger"}>● PHONE {phoneConnected?"LINKED":"OFFLINE"}</span><span>MODE {mode}</span></div></header>
  <main className="sim-layout"><section className="scene" onContextMenu={e=>e.preventDefault()}>
   <Canvas shadows camera={{position:[0,28,45],fov:62}} gl={{antialias:true}} style={{touchAction:"none"}}>
    <color attach="background" args={["#87a9c1"]}/><fog attach="fog" args={["#87a9c1",100,210]}/><ambientLight intensity={1.5}/><directionalLight castShadow position={[30,80,20]} intensity={3}/><hemisphereLight intensity={1.2} groundColor="#263b2a" skyColor="#b8d7ed"/>
    <Terrain/>{obstacles.map(o=><ObstacleView key={o.id||JSON.stringify(o.position)} o={o}/>)}<DroneModel position={pos} heading={heading} flying={flying}/>
    <DroneSensors position={pos} obstacles={obstacles} range={18} onDetection={({detected,distance:front})=>{setSensor(detected);setSensorDistance(front);if(detected&&front<4&&["AUTOPILOT","EMERGENCY AUTOPILOT"].includes(mode))replan()}}/>
    <Route path={path} returning={returning.current}/><TargetMarker target={target}/><TargetMarker target={HOME} home/><DroneCamera position={pos} heading={heading}/>
   </Canvas>
   <div className="flight-hud"><div className="hud-title">DRONE LIVE VIEW <span className="pulse">● LIVE</span></div><div className="hud-row"><b>{status}</b><span>MODE {mode}</span><span>ALT {pos.y.toFixed(1)}m</span><span>SPD {speed.toFixed(1)}m/s</span><span>HDG {heading.toFixed(0)}°</span></div><div className="hud-row muted">DRONE {pos.x.toFixed(1)} / {pos.y.toFixed(1)} / {pos.z.toFixed(1)} · TARGET {target.x} / {target.y} / {target.z} · ETA {eta}s</div></div>
   <div className="camera-badge">FPV / CHASE CAMERA · LOCKED</div><div className="drone-reticle">+</div>
   <div className="mini-monitor"><div className="mini-title">LIVE TRACKING RADAR</div><div className="radar"><div className="radar-line"></div><div className="radar-drone" style={{left:`${50+pos.x*.35}%`,top:`${50+pos.z*.35}%`}}>◆</div><div className="radar-target" style={{left:`${50+target.x*.35}%`,top:`${50+target.z*.35}%`}}>✦</div><div className="radar-home" style={{left:"50%",top:"50%"}}>H</div></div><small>D DRONE · T TARGET · H HOME</small></div>
  </section></main>
 </div>;
}
export default App;
