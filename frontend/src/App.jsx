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
 const propRefs=useRef([]);
 useFrame((state,delta)=>{
   if(!ref.current)return;
   const a=heading*Math.PI/180;
   ref.current.rotation.y=THREE.MathUtils.lerp(ref.current.rotation.y,-a,delta*8);
   if(flying) propRefs.current.forEach(r=>{if(r)r.rotation.y+=delta*32;});
 });
 return <group ref={ref} position={[position.x,position.y,position.z]}>
   <mesh castShadow><boxGeometry args={[3.8,.7,2.6]}/><meshStandardMaterial color="#242b31" metalness={.85} roughness={.22}/></mesh>
   <mesh position={[0,.25,0]}><sphereGeometry args={[.48,24,16]}/><meshStandardMaterial color="#111820" metalness={.9}/></mesh>
   <mesh position={[0,-.42,-1.05]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.42,.42,.16,24]}/><meshStandardMaterial color="#111820" metalness={.7}/></mesh>
   {[[-2,.55,-1.25],[2,.55,-1.25],[-2,.55,1.25],[2,.55,1.25]].map(([x,y,z],i)=>
    <group key={i} position={[x,0,z]}>
      <mesh><cylinderGeometry args={[.13,.17,.55,12]}/><meshStandardMaterial color="#30383e" metalness={.8}/></mesh>
      <mesh ref={el=>propRefs.current[i]=el} position={[0,.35,0]}><boxGeometry args={[2,.06,.12]}/><meshStandardMaterial color="#0d1115" metalness={.7}/></mesh>
    </group>)}
   <pointLight position={[0,-.65,-1.25]} intensity={3} distance={10} color="#59e7ff"/>
 </group>;
}

function DroneCamera({position,heading}){
 const {camera}=useThree(); const init=useRef(false);
 useFrame((_,delta)=>{
   const a=heading*Math.PI/180;
   const behind=new THREE.Vector3(position.x-Math.cos(a)*20,position.y+9,position.z-Math.sin(a)*20);
   const look=new THREE.Vector3(position.x+Math.cos(a)*18,position.y-1,position.z+Math.sin(a)*18);
   if(!init.current){camera.position.copy(behind);init.current=true;}
   camera.position.lerp(behind,1-Math.pow(.001,Math.min(delta,.05)));
   camera.lookAt(look);
 });
 return null;
}

function Route({path,returning}){
 const points=useMemo(()=>path.map(p=>[p.x,p.y+.15,p.z]),[path]);
 return points.length>1?<Line points={points} color={returning?"#ffd34d":"#39e7ff"} lineWidth={4}/>:null;
}

function TargetMarker({target,home=false}){
 return <group position={[target.x,target.y,target.z]}>
  <mesh><cylinderGeometry args={[2.2,2.2,.18,32]}/><meshStandardMaterial color={home?"#4d8cff":"#4dff9a"} emissive={new THREE.Color(home?"#1644aa":"#0d8c4c")} emissiveIntensity={1.5}/></mesh>
  <mesh position={[0,1,0]}><sphereGeometry args={[.6,20,12]}/><meshStandardMaterial emissive={new THREE.Color(home?"#4d8cff":"#4dff9a")} emissiveIntensity={2}/></mesh>
 </group>;
}

function App(){
 const socketRef=useRef(null),idx=useRef(0),pathRef=useRef([]),missionRef=useRef(null),replanLock=useRef(false),returning=useRef(false),manualAnnounced=useRef(false);
 const [pos,setPos]=useState({...HOME}),[target,setTarget]=useState({x:700,y:60,z:450}),[path,setPath]=useState([]);
 const [obstacles,setObstacles]=useState(BASE_OBSTACLES),[gps,setGps]=useState(true),[mode,setMode]=useState("MANUAL");
 const [status,setStatus]=useState("READY"),[phase,setPhase]=useState("IDLE"),[speed,setSpeed]=useState(0),[heading,setHeading]=useState(0);
 const [mission,setMission]=useState(null),[sensor,setSensor]=useState(false),[sensorDistance,setSensorDistance]=useState(14),[message,setMessage]=useState("Choose a destination to begin");
 const [phoneConnected,setPhoneConnected]=useState(false),[phoneCommand,setPhoneCommand]=useState("STOP"),[destinationChosen,setDestinationChosen]=useState(false),[landing,setLanding]=useState(false),[takeoffCountdown,setTakeoffCountdown]=useState(null);
 pathRef.current=path; missionRef.current=mission;
 const flying=speed>0&&pos.y>2.5;
 const speak=text=>{try{window.speechSynthesis?.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.95;window.speechSynthesis?.speak(u)}catch{}};

 const patchMission=async data=>{if(!missionRef.current?._id)return;try{await fetch(API+`/missions/${missionRef.current._id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})}catch{}};

 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 const isBlocked=p=>obstacles.some(o=>Math.abs(p.x-o.position.x)<o.size.x/2+2.5&&Math.abs(p.y-o.position.y)<o.size.y/2+2.5&&Math.abs(p.z-o.position.z)<o.size.z/2+2.5);

 async function calculate(from=pos,to=target){
   try{
    const r=await fetch(API+"/routes/calculate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:from,goal:to,obstacles})});
    if(!r.ok)throw Error();
    const d=await r.json(),route=d.route||[];
    setPath(route);idx.current=0;
    setMessage(route.length?"Safe 3D A* route calculated":"No safe route found");
    return route;
   }catch{setPath([]);setMessage("Route server unavailable — start backend on port 5000");return []}
 }

 async function chooseTarget(t=target){
   const safe={x:THREE.MathUtils.clamp(Number(t.x)||0,WORLD.minX,WORLD.maxX),y:THREE.MathUtils.clamp(Number(t.y)||12,WORLD.minY,WORLD.maxY),z:THREE.MathUtils.clamp(Number(t.z)||0,WORLD.minZ,WORLD.maxZ)};
   setTarget(safe);setDestinationChosen(true);setMode("MANUAL");setStatus("DESTINATION SELECTED");setPhase("READY FOR ROUTE");
   const r=await calculate(pos,safe); if(r.length)setMessage("Destination locked — calculate route or create mission");
 }

 async function createMission(){
   if(!destinationChosen){setMessage("Choose a destination first");return}
   const r=path.length?path:await calculate();
   if(!r.length)return;
   try{
    const res=await fetch(API+"/missions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:HOME,target,route:r,gpsStatus:gps?"CONNECTED":"DENIED",status:"READY",phase:"PLANNED"})});
    if(!res.ok)throw Error();
    const m=await res.json();setMission(m);missionRef.current=m;setStatus("MISSION CREATED");setPhase("PLANNED");setMessage("Mission saved and ready");
   }catch{setMessage("Mission save failed — check backend and MongoDB")}
 }

 function manualMove(cmd){
   if(pos.y<=2.5){setMessage("Drone is on the ground — use TAKEOFF first");return}
   setMode("MANUAL");setStatus("MANUAL FLIGHT");setPhase("USER CONTROL");setSpeed(8);if(!manualAnnounced.current){manualAnnounced.current=true;speak("Your drone is going towards the location");setMessage("Your drone is going towards the location");}
   const step=12, map={UP:[0,-step],DOWN:[0,step],LEFT:[-step,0],RIGHT:[step,0],UP_LEFT:[-step,-step],UP_RIGHT:[step,-step],DOWN_LEFT:[-step,step],DOWN_RIGHT:[step,step]};
   const [dx,dz]=map[cmd]||[0,0]; if(!map[cmd])return;
   setHeading(Math.atan2(-dz,-dx)*180/Math.PI);
   setPos(p=>({x:THREE.MathUtils.clamp(p.x+dx,WORLD.minX,WORLD.maxX),y:p.y,z:THREE.MathUtils.clamp(p.z+dz,WORLD.minZ,WORLD.maxZ)}));
 }

 async function startAutopilot(){
   if(!destinationChosen){setMessage("CHOOSE DESTINATION before takeoff");return}
   if(takeoffCountdown!==null)return;
   const r=path.length?path:await calculate(); if(!r.length)return;
   for(let i=5;i>0;i--){setTakeoffCountdown(i);await new Promise(res=>setTimeout(res,1000))}
   setTakeoffCountdown(null);setPos(p=>({...p,y:30}));setStatus("READY FOR TAKEOFF");setPhase("TAKEOFF COMPLETE");setSpeed(0);manualAnnounced.current=false;
   speak("Your drone is ready to take off");
   if(mode==="MANUAL"){setMessage("Your drone is ready — manual flight enabled");return}
   await new Promise(res=>setTimeout(res,700));
   returning.current=false;setLanding(false);setMode(gps?"AUTOPILOT":"EMERGENCY AUTOPILOT");setStatus(gps?"AUTOPILOT ACTIVE":"EMERGENCY AUTOPILOT");setPhase(gps?"GOING TOWARDS TARGET":"GPS LOST — SENSOR NAVIGATION");setSpeed(50);setMessage("Your drone is going towards the location");speak("Your drone is going towards the location");await patchMission({status:gps?"AUTOPILOT":"EMERGENCY AUTOPILOT",phase:gps?"GOING TOWARDS TARGET":"GPS LOST — SENSOR NAVIGATION"});
 }

 async function stopFlight(){setMode("MANUAL");setStatus("STOPPED");setPhase("MANUAL");setSpeed(0);setLanding(false);await patchMission({status:"STOPPED",phase:"MANUAL"})}

 async function emergencyAutopilot(){
   if(!destinationChosen){setMessage("Choose destination before emergency test");return}
   if(takeoffCountdown!==null)return;
   setGps(false);setMode("EMERGENCY AUTOPILOT");
   const r=await calculate(pos,target);if(!r.length)return;
   for(let i=5;i>0;i--){setTakeoffCountdown(i);await new Promise(res=>setTimeout(res,1000))}
   setTakeoffCountdown(null);setPos(p=>({...p,y:30}));setStatus("READY FOR TAKEOFF");setPhase("TAKEOFF COMPLETE");setSpeed(0);
   speak("Your drone is ready to take off");await new Promise(res=>setTimeout(res,700));
   setStatus("EMERGENCY AUTOPILOT");setPhase("GPS DENIED — SENSOR NAVIGATION");setSpeed(50);setMessage("Your drone is going towards the location");speak("Your drone is going towards the location");await patchMission({gpsStatus:"DENIED",status:"EMERGENCY AUTOPILOT",phase:"GPS DENIED — SENSOR NAVIGATION",route:r});
 }

 async function toggleGps(){
   const next=!gps;setGps(next);
   if(!next){await emergencyAutopilot()}else{setStatus("GPS RESTORED");setPhase("GPS CONNECTED");setMessage("GPS restored — awaiting pilot/autopilot command");if(mode==="EMERGENCY AUTOPILOT")setMode("MANUAL");await patchMission({gpsStatus:"CONNECTED",status:"READY",phase:"GPS CONNECTED"})}
 }

 async function addLiveObstacle(){
   const n=path[idx.current]||{x:pos.x+8,y:pos.y,z:pos.z};
   const o={id:"dynamic-"+Date.now(),position:{x:n.x,y:n.y,z:n.z},size:{x:6,y:8,z:6},type:"DYNAMIC"};
   setObstacles(v=>[...v,o]);setSensor(true);setMessage("LIVE OBSTACLE ENTERED — REPLANNING");
   if(mode!=="MANUAL")await replan([...obstacles,o]);
 }

 async function replan(currentObstacles=obstacles){
   if(replanLock.current)return;replanLock.current=true;setSensor(true);setStatus("OBSTACLE DETECTED");setPhase("REAL-TIME REPLANNING");setSpeed(0);
   try{
    const r=await fetch(API+"/routes/replan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:pos,goal:returning.current?HOME:target,obstacles:currentObstacles})});
    const d=r.ok?await r.json():null;const route=d?.route||[];
    if(!route.length){setStatus("ROUTE BLOCKED");setPhase("HOLD POSITION");setMessage("No safe route found — drone holding");return}
    setPath(route);idx.current=0;setSensor(false);setMode(gps?"AUTOPILOT":"EMERGENCY AUTOPILOT");setStatus(gps?"AUTOPILOT ACTIVE":"EMERGENCY AUTOPILOT");setPhase("REPLANNED SAFE ROUTE");setSpeed(50);setMessage("Obstacle avoided — new route locked");await patchMission({status:gps?"AUTOPILOT":"EMERGENCY AUTOPILOT",phase:"REPLANNED SAFE ROUTE",route});
   }catch{setStatus("REPLANNING ERROR");setMessage("Backend replan unavailable")}finally{setTimeout(()=>{replanLock.current=false},700)}
 }

 useEffect(()=>{
  const s=io(SOCKET_URL);socketRef.current=s;s.on("connect",()=>setPhoneConnected(true));s.on("disconnect",()=>setPhoneConnected(false));
  s.on("phone-control",async cmd=>{
   setPhoneCommand(cmd);
   if(cmd==="START")startAutopilot();
   else if(cmd==="STOP")stopFlight();
   else if(cmd==="EMERGENCY")emergencyAutopilot();
   else if(cmd==="GPS_TOGGLE")toggleGps();
   else if(cmd.startsWith("TARGET:")){try{const t=JSON.parse(cmd.slice(7));await chooseTarget(t)}catch{setMessage("Invalid remote target")}}
   else manualMove(cmd);
  });
  return()=>s.disconnect();
 },[gps,destinationChosen,target,path,pos,obstacles,mode]);

 useEffect(()=>{
  if(!["AUTOPILOT","EMERGENCY AUTOPILOT"].includes(mode)||!path.length)return;
  let alive=true;
  const timer=setInterval(async()=>{
   if(!alive)return;
   const n=path[idx.current];
   if(!n){clearInterval(timer);setSpeed(0);setLanding(true);setStatus(returning.current?"HOME ARRIVAL":"TARGET REACHED");setPhase("LANDING");setMessage(returning.current?"Returning home — landing":"Target reached — precision landing");return}
   if(isBlocked(n)){await replan();return}
   const d=distance(pos,n),step=Math.min(3.5,d);
   if(d<.05){idx.current++;return}
   const ratio=step/d;
   const next={x:pos.x+(n.x-pos.x)*ratio,y:pos.y+(n.y-pos.y)*ratio,z:pos.z+(n.z-pos.z)*ratio};
   setHeading(Math.atan2(n.z-pos.z,n.x-pos.x)*180/Math.PI);setPos(next);setSpeed(10);
   idx.current=distance(next,n)<.15?idx.current+1:idx.current;
  },70);
  return()=>{alive=false;clearInterval(timer)}
 },[mode,path,pos,obstacles]);

 useEffect(()=>{
  if(!landing)return;
  const timer=setTimeout(async()=>{
   setPos(p=>({...p,y:returning.current?HOME.y:target.y}));setSpeed(0);setStatus(returning.current?"MISSION COMPLETE":"LANDED");setPhase(returning.current?"HOME LANDED":"WAITING 10s");
   await patchMission({status:returning.current?"MISSION COMPLETE":"LANDED",phase:returning.current?"HOME LANDED":"WAITING 10s"});
   if(!returning.current){
    await new Promise(r=>setTimeout(r,10000));returning.current=true;
    const r=await calculate({...pos,y:target.y},HOME);
    if(!r.length){setStatus("RETURN ROUTE BLOCKED");setPhase("RETURN FAILED");return}
    setPath(r);idx.current=0;setLanding(false);setMode(gps?"AUTOPILOT":"EMERGENCY AUTOPILOT");setStatus("RETURNING HOME");setPhase("AUTONOMOUS RETURN TO HOME");setSpeed(10);setMessage("10-second landing wait complete — returning home");await patchMission({status:"RETURNING HOME",phase:"AUTONOMOUS RETURN TO HOME",route:r});
   }
  },1200);
  return()=>clearTimeout(timer)
 },[landing]);

 useEffect(()=>{
  if(!mission?._id)return;
  const timer=setInterval(()=>{fetch(API+"/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({missionId:mission._id,position:pos,altitude:pos.y,speed,heading,gpsStatus:gps?"CONNECTED":"DENIED",obstacleDetected:sensor,sensorDistance,status,phase,mode})}).catch(()=>{});
   socketRef.current?.emit("phone-telemetry",{x:pos.x,y:pos.y,z:pos.z,speed,heading,gps:gps?"CONNECTED":"DENIED",status,phase,mode,target,home:HOME,distanceToTarget:distance(pos,target),sensorDistance});
  },400);return()=>clearInterval(timer)
 },[mission,pos,speed,heading,gps,sensor,sensorDistance,status,phase,mode,target]);

 const dist=distance(pos,target),eta=Math.ceil(dist/50);
 return <div className="app">
  <header className="topbar"><div><h1>NAVIGATE-X <span>◈</span></h1><p>GPS-DENIED AUTONOMOUS NAVIGATION SIMULATOR</p></div><div className="top-status"><span className={gps?"ok":"danger"}>● GPS {gps?"CONNECTED":"LOST"}</span><span className={phoneConnected?"ok":"danger"}>● PHONE {phoneConnected?"LINKED":"OFFLINE"}</span><span>MODE {mode}</span></div></header>
  <main className="sim-layout">
   <section className="scene" onContextMenu={e=>e.preventDefault()}>
    <Canvas shadows camera={{position:[0,28,45],fov:62}} gl={{antialias:true}} style={{touchAction:"none"}}>
     <color attach="background" args={["#87a9c1"]}/><fog attach="fog" args={["#87a9c1",100,210]}/>
     <ambientLight intensity={1.5}/><directionalLight castShadow position={[30,80,20]} intensity={3}/><hemisphereLight intensity={1.2} groundColor="#263b2a" skyColor="#b8d7ed"/>
     <Terrain/>
     {obstacles.map(o=><ObstacleView key={o.id||JSON.stringify(o.position)} o={o}/>)}<DroneModel position={pos} heading={heading} flying={flying}/>
     <DroneSensors position={pos} obstacles={obstacles} range={18} onDetection={({detected,distance:front})=>{setSensor(detected);setSensorDistance(front);if(detected&&front<4&&["AUTOPILOT","EMERGENCY AUTOPILOT"].includes(mode))replan()}}/>
     <Route path={path} returning={returning.current}/><TargetMarker target={target}/><TargetMarker target={HOME} home/>
     <DroneCamera position={pos} heading={heading}/>
    </Canvas>
    <div className="flight-hud"><div className="hud-title">DRONE LIVE VIEW <span className="pulse">● LIVE</span></div><div className="hud-row"><b>{status}</b><span>MODE {mode}</span><span>ALT {pos.y.toFixed(1)}m</span><span>SPD {speed.toFixed(1)}m/s</span><span>HDG {heading.toFixed(0)}°</span></div><div className="hud-row muted">DRONE {pos.x.toFixed(1)} / {pos.y.toFixed(1)} / {pos.z.toFixed(1)} · TARGET {target.x} / {target.y} / {target.z} · ETA {eta}s</div></div>
    <div className="camera-badge">FPV / CHASE CAMERA · LOCKED</div>
    <div className="drone-reticle">+</div>
    <div className="mini-monitor"><div className="mini-title">LIVE TRACKING RADAR</div><div className="radar"><div className="radar-line"></div><div className="radar-drone" style={{left:`${50+pos.x*.35}%`,top:`${50+pos.z*.35}%`}}>◆</div><div className="radar-target" style={{left:`${50+target.x*.35}%`,top:`${50+target.z*.35}%`}}>✦</div><div className="radar-home" style={{left:"50%",top:"50%"}}>H</div></div><small>D DRONE · T TARGET · H HOME</small></div>
   </section>
   <aside className="control-panel">
    <div className="panel-heading"><span>FLIGHT CONTROLLER</span><small>{phoneConnected?"REMOTE LINK ACTIVE":"LOCAL CONTROL"}</small></div>
    <div className="mode-tabs"><button className={mode==="MANUAL"?"active":""} onClick={()=>{setMode("MANUAL");setStatus("MANUAL READY");setPhase("USER CONTROL");setSpeed(0)}}>MANUAL</button><button className={mode==="AUTOPILOT"?"active":""} onClick={startAutopilot}>AUTOPILOT</button><button className={mode==="EMERGENCY AUTOPILOT"?"active danger-tab":""} onClick={emergencyAutopilot}>EMERGENCY</button></div>
    <div className="target-box"><div className="section-label">1 · DESTINATION / LIVE TRACKER</div>{destinationChosen?<div className="mission-radar"><div className="radar-sweep"></div><div className="radar-ring ring1"></div><div className="radar-ring ring2"></div><div className="radar-cross cross-x"></div><div className="radar-cross cross-z"></div><div className="radar-point radar-home-point" style={{left:"50%",top:"50%"}}>H</div><div className="radar-point radar-drone-point" style={{left:`${50+pos.x/30}%`,top:`${50+pos.z/30}%`}}>D</div><div className="radar-point radar-target-point" style={{left:`${50+target.x/30}%`,top:`${50+target.z/30}%`}}>T</div><div className="radar-label">LIVE 3 KM × 3 KM TRACKER</div></div>:<div className="mission-map" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const x=Math.round(((e.clientX-r.left)/r.width-.5)*3000);const z=Math.round(((e.clientY-r.top)/r.height-.5)*3000);setTarget({x,y:60,z})}}><div className="map-home">H</div><div className="map-target" style={{left:`${50+target.x/30}%`,top:`${50+target.z/30}%`}}>◆</div><div className="map-drone" style={{left:`${50+pos.x/30}%`,top:`${50+pos.z/30}%`}}>D</div></div>}<div className="map-readout">{destinationChosen?"D DRONE · T TARGET · H HOME":"Target: "+Math.round(target.x)+" m / "+Math.round(target.z)+" m"}</div>{!destinationChosen&&<button className="primary-wide" onClick={()=>chooseTarget(target)}>✓ CONFIRM DESTINATION</button>}</div>
    <div className="button-grid"><button onClick={()=>calculate()}>2 · CALCULATE 3D A*</button><button onClick={createMission}>3 · CREATE MISSION</button><button className="primary" onClick={startAutopilot}>4 · TAKEOFF / START</button><button onClick={stopFlight}>STOP / LAND</button><button className="warning" onClick={addLiveObstacle}>＋ LIVE OBSTACLE</button><button className="warning" onClick={toggleGps}>{gps?"GPS DISCONNECT":"GPS RESTORE"}</button></div>
    <div className="manual-box"><div className="section-label">MANUAL FLIGHT CONTROL</div><div className="dpad"><span></span><button onClick={()=>manualMove("UP")}>↑</button><span></span><button onClick={()=>manualMove("LEFT")}>←</button><button onClick={()=>stopFlight()}>■</button><button onClick={()=>manualMove("RIGHT")}>→</button><span></span><button onClick={()=>manualMove("DOWN")}>↓</button><span></span></div><p className="hint">Manual mode: user controls the drone. Autopilot mode: route control. Emergency mode: GPS-denied sensor navigation.</p></div>
    <MissionMonitor status={status} phase={phase} gps={gps} waypoints={path.length} missionId={mission?._id} phoneCommand={phoneCommand} phoneConnected={phoneConnected} sensor={sensor}/>
    
    {takeoffCountdown!==null&&<div className="takeoff-overlay"><div className="takeoff-title">DRONE TAKEOFF</div><div className="takeoff-number">{takeoffCountdown}</div><div className="takeoff-sub">GETTING READY...</div></div>}<div className="message">{message}</div>
   </aside>
  </main>
 </div>;
}

export default App;
