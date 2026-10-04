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
const HOME={x:0,y:10,z:0};

const baseObstacles=[
  {position:{x:18,y:8,z:0},size:{x:10,y:16,z:12},type:"BUILDING"},
  {position:{x:38,y:12,z:10},size:{x:10,y:24,z:10},type:"BUILDING"},
  {position:{x:55,y:7,z:-12},size:{x:14,y:14,z:10},type:"BUILDING"},
  {position:{x:30,y:6,z:-20},size:{x:9,y:12,z:9},type:"BUILDING"}
];

const cityBuildings=Array.from({length:30},(_,i)=>({
  x:-35+(i*17)%105,
  z:-42+((i*29)%84),
  w:6+(i%4)*2,
  d:6+(i%3)*2,
  h:10+(i%7)*6
})).filter(b=>Math.hypot(b.x,b.z)>10);

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

function Building({b}){return <group position={[b.x,b.h/2,b.z]}>
  <mesh castShadow receiveShadow><boxGeometry args={[b.w,b.h,b.d]}/><meshStandardMaterial metalness={.25} roughness={.65}/></mesh>
  {Array.from({length:Math.max(1,Math.floor(b.h/4))},(_,r)=>(
    <group key={r} position={[0,-b.h/2+2+r*4,0]}>
      <mesh position={[0,0,b.d/2+.02]}><boxGeometry args={[b.w*.72,.8,.06]}/><meshStandardMaterial emissive={new THREE.Color("#5ddcff")} emissiveIntensity={.55}/></mesh>
      <mesh position={[0,0,-b.d/2-.02]}><boxGeometry args={[b.w*.72,.8,.06]}/><meshStandardMaterial emissive={new THREE.Color("#5ddcff")} emissiveIntensity={.35}/></mesh>
    </group>
  ))}
</group>}

function City(){return <group>{cityBuildings.map((b,i)=><Building key={i} b={b}/>)}</group>}

function Obstacle({o,dynamic=false}){
  return <mesh position={[o.position.x,o.position.y,o.position.z]} castShadow>
    <boxGeometry args={[o.size.x,o.size.y,o.size.z]}/>
    <meshStandardMaterial transparent opacity={dynamic?.75:.42} metalness={.15} roughness={.6} emissive={dynamic?new THREE.Color("#ff2f55"):new THREE.Color("#172b4d")} emissiveIntensity={dynamic?.65:.2}/>
  </mesh>;
}

function DynamicObject({o}){return <group position={[o.position.x,o.position.y,o.position.z]}>
  <mesh><boxGeometry args={[o.size.x,o.size.y,o.size.z]}/><meshStandardMaterial transparent opacity={.7} emissive={new THREE.Color("#ff304f")} emissiveIntensity={1}/></mesh>
  <pointLight intensity={2} distance={8}/>
</group>}

function DroneCamera({position,heading,enabled}){
  const {camera}=useThree();
  useFrame((_,d)=>{
    if(!enabled)return;
    const a=heading*Math.PI/180;
    const desired=new THREE.Vector3(position.x,position.y+2.4,position.z);
    camera.position.lerp(desired,1-Math.pow(.001,d));
    const look=new THREE.Vector3(position.x+Math.cos(a)*18,position.y+1.2,position.z+Math.sin(a)*18);
    camera.lookAt(look);
  });
  return null;
}

function Route({path}){
  const points=useMemo(()=>path.map(p=>[p.x,p.y,p.z]),[path]);
  if(points.length<2)return null;
  return <Line points={points} color="#55e7ff" lineWidth={3}/>;
}

function TargetMarker({target,onSelect}){
  return <group position={[target.x,target.y,target.z]}>
    <mesh><sphereGeometry args={[1.5,24,16]}/><meshStandardMaterial emissive={new THREE.Color("#43ff9a")} emissiveIntensity={2}/></mesh>
    <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[3,.08,12,48]}/><meshStandardMaterial emissive={new THREE.Color("#43ff9a")} emissiveIntensity={1.5}/></mesh>
  </group>;
}

function GroundPicker({onPick}){
  const {camera,raycaster,gl}=useThree();
  const plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,1,0),-10),[]);
  const point=new THREE.Vector3();
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} visible={false}
    onPointerDown={e=>{
      e.stopPropagation();
      const r=gl.domElement.getBoundingClientRect();
      const mouse=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
      raycaster.setFromCamera(mouse,camera);
      if(raycaster.ray.intersectPlane(plane,point)) onPick({x:Math.round(THREE.MathUtils.clamp(point.x,-45,75)),y:10,z:Math.round(THREE.MathUtils.clamp(point.z,-45,45))});
    }}>
    <planeGeometry args={[140,100]}/>
  </mesh>;
}

function App(){
  const socketRef=useRef(null);
  const idx=useRef(0);
  const returningRef=useRef(false);
  const replanLock=useRef(false);
  const startRef=useRef(null),stopRef=useRef(null),disconnectRef=useRef(null);
  const pathRef=useRef([]);
  const audioRef=useRef(null);

  const [phoneCommand,setPhoneCommand]=useState("STOP");
  const [phoneConnected,setPhoneConnected]=useState(false);
  const [pos,setPos]=useState({...HOME});
  const [target,setTarget]=useState({x:65,y:12,z:0});
  const [path,setPath]=useState([]);
  const [gps,setGps]=useState(true);
  const [auto,setAuto]=useState(false);
  const [status,setStatus]=useState("READY");
  const [phase,setPhase]=useState("IDLE");
  const [speed,setSpeed]=useState(0);
  const [heading,setHeading]=useState(0);
  const [mission,setMission]=useState(null);
  const [sensor,setSensor]=useState(false);
  const [sensorDistance,setSensorDistance]=useState(12);
  const [message,setMessage]=useState("System ready");
  const [obstacles,setObstacles]=useState(baseObstacles);
  const [viewMode,setViewMode]=useState("CHASE");
  const [manualMode,setManualMode]=useState(true);

  pathRef.current=path;

  function takeoffSound(){
    try{
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)return;
      const ctx=audioRef.current||new C();
      audioRef.current=ctx;
      const now=ctx.currentTime;
      [0,1,2,3].forEach(i=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type="sawtooth"; osc.frequency.setValueAtTime(90+i*20,now);
        osc.frequency.exponentialRampToValueAtTime(180+i*35,now+.9);
        gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.06,now+.12);gain.gain.exponentialRampToValueAtTime(.0001,now+1.1);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(now+i*.03);osc.stop(now+1.15);
      });
    }catch{}
  }

  async function patchMission(data){
    if(!mission?._id)return;
    try{await fetch(API+`/missions/${mission._id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});}catch{}
  }

  async function calculate(from=pos,to=target){
    try{
      const r=await fetch(API+"/routes/calculate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:from,goal:to,obstacles})});
      if(!r.ok)throw new Error();
      const d=await r.json(),route=d.route||[];
      setPath(route);idx.current=0;setMessage(route.length?"3D A* route calculated":"No safe route found");
      return route;
    }catch{setPath([]);setMessage("Backend unavailable — start backend on port 5000");return []}
  }

  async function create(){
    const p=await calculate(); if(!p.length)return;
    try{
      const r=await fetch(API+"/missions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:HOME,target,route:p,gpsStatus:gps?"CONNECTED":"DENIED",status:"READY",phase:"PLANNED"})});
      if(!r.ok)throw new Error();const m=await r.json();setMission(m);setStatus("MISSION CREATED");setPhase("PLANNED");setMessage("Mission saved");
    }catch{setMessage("Mission save failed — check MongoDB/backend")}
  }

  async function start(){
    if(!path.length){setMessage("Select a target and calculate a route first");return}
    takeoffSound(); returningRef.current=false;setAuto(true);setManualMode(false);
    const s=gps?"AUTONOMOUS":"EMERGENCY AUTOPILOT";setStatus(s);setPhase(gps?"TAKEOFF / NAVIGATING":"GPS-DENIED NAVIGATION");setMessage("Rotor spin-up — autonomous flight active");
    await patchMission({status:s,phase:gps?"TAKEOFF / NAVIGATING":"GPS-DENIED NAVIGATION",gpsStatus:gps?"CONNECTED":"DENIED"});
  }

  async function stop(){setAuto(false);setSpeed(0);setManualMode(true);setStatus("STOPPED");setPhase("MANUAL");setMessage("Mission paused");await patchMission({status:"STOPPED",phase:"MANUAL"})}

  async function addObstacle(){
    const next=path[idx.current]||{x:pos.x+7,y:pos.y,z:pos.z};
    const o={position:{x:next.x,y:next.y,z:next.z},size:{x:5,y:7,z:5},type:"DYNAMIC"};
    setObstacles(v=>[...v,o]);setSensor(true);setMessage("LIVE DYNAMIC OBSTACLE DETECTED");
    if(mission?._id)fetch(API+"/obstacles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...o,missionId:mission._id})}).catch(()=>{});
  }

  function blocked(n){return obstacles.some(o=>Math.abs(n.x-o.position.x)<o.size.x/2+2&&Math.abs(n.y-o.position.y)<o.size.y/2+2&&Math.abs(n.z-o.position.z)<o.size.z/2+2)}

  async function replan(){
    if(replanLock.current)return;
    replanLock.current=true;setAuto(false);setSpeed(0);setSensor(true);setStatus("OBSTACLE DETECTED");setPhase("REAL-TIME REPLANNING");setMessage("Sensor lock — recalculating safe 3D route");
    const p=await calculate(pos,target);
    if(!p.length){setStatus("ROUTE BLOCKED");setPhase("WAITING FOR CLEAR PATH");setMessage("No safe route. Hold position.");replanLock.current=false;return}
    idx.current=0;setPath(p);setSensor(false);setAuto(true);setManualMode(false);setStatus(gps?"AUTONOMOUS":"EMERGENCY AUTOPILOT");setPhase("REPLANNED NAVIGATION");setMessage("New safe route locked");
    await patchMission({status:gps?"AUTONOMOUS":"EMERGENCY AUTOPILOT",phase:"REPLANNED NAVIGATION",route:p});
    setTimeout(()=>{replanLock.current=false},1200);
  }

  const disconnect=async()=>{
    const next=!gps;setGps(next);
    if(!next){setStatus("EMERGENCY AUTOPILOT");setPhase("GPS DENIED");setMessage("GPS lost — switching to onboard sensor navigation");await patchMission({gpsStatus:"DENIED",status:"EMERGENCY AUTOPILOT",phase:"GPS DENIED"})}
    else{setStatus("READY");setPhase("GPS RESTORED");setMessage("GPS restored");await patchMission({gpsStatus:"CONNECTED",status:"READY",phase:"GPS RESTORED"})}
  };

  function manualMove(cmd){
    setAuto(false);setManualMode(true);setSpeed(6);
    const step=1.8, map={UP:[0,step],DOWN:[0,-step],LEFT:[-step,0],RIGHT:[step,0],UP_LEFT:[-step,step],UP_RIGHT:[step,step],DOWN_LEFT:[-step,-step],DOWN_RIGHT:[step,-step]};
    const [dx,dz]=map[cmd]||[0,0];
    setHeading(Math.atan2(dz,dx)*180/Math.PI);
    setPos(p=>({x:THREE.MathUtils.clamp(p.x+dx,-45,75),y:p.y,z:THREE.MathUtils.clamp(p.z+dz,-45,45)}));
    setStatus("MANUAL FLIGHT");setPhase(cmd.replace("_"," + "));setMessage("Manual controller: "+cmd);
  }

  startRef.current=start;stopRef.current=stop;disconnectRef.current=disconnect;

  useEffect(()=>{
    const s=io(SOCKET_URL);socketRef.current=s;
    s.on("connect",()=>setPhoneConnected(true));s.on("disconnect",()=>setPhoneConnected(false));
    s.on("phone-control",cmd=>{setPhoneCommand(cmd);
      if(cmd==="START")startRef.current?.(); else if(cmd==="STOP")stopRef.current?.(); else if(cmd==="GPS_TOGGLE")disconnectRef.current?.(); else if(cmd==="EMERGENCY"){setGps(false);if(pathRef.current.length){setAuto(true);setManualMode(false);setStatus("EMERGENCY AUTOPILOT");setPhase("PHONE EMERGENCY CONTROL");setMessage("Emergency autopilot activated from remote")}else setMessage("Calculate a route before emergency mode")} else manualMove(cmd);
    });
    return()=>s.disconnect();
  },[]);

  useEffect(()=>{
    if(!auto)return;
    const timer=setInterval(async()=>{
      const n=path[idx.current];
      if(!n){setAuto(false);setSpeed(0);
        if(returningRef.current){setStatus("MISSION COMPLETE");setPhase("HOME LANDED");setMessage("Mission complete — returned to home");await patchMission({status:"MISSION COMPLETE",phase:"HOME LANDED",completedAt:new Date().toISOString()})}
        else{setStatus("TARGET REACHED");setPhase("LANDING");setMessage("Target reached — landing")}
        return;
      }
      if(blocked(n)){await replan();return}
      const prev=pos;setHeading(Math.atan2(n.z-prev.z,n.x-prev.x)*180/Math.PI);setPos(n);setSpeed(12);idx.current++;
    },220);
    return()=>clearInterval(timer);
  },[auto,path,obstacles,gps,pos]);

  useEffect(()=>{
    if(status!=="TARGET REACHED")return;
    const timer=setTimeout(async()=>{setStatus("LANDED");setPhase("WAITING 10s");setSpeed(0);await patchMission({status:"LANDED",phase:"WAITING 10s"});await new Promise(r=>setTimeout(r,10000));returningRef.current=true;const p=await calculate(pos,HOME);
      if(!p.length){setStatus("RETURN ROUTE BLOCKED");setPhase("RETURN FAILED");return}
      idx.current=0;setPath(p);setAuto(true);setStatus("RETURNING HOME");setPhase("RETURN TO HOME");setMessage("Waiting complete — return flight started");await patchMission({status:"RETURNING HOME",phase:"RETURN TO HOME",route:p});
    },1000);return()=>clearTimeout(timer);
  },[status]);

  useEffect(()=>{
    const timer=setInterval(()=>{
      setObstacles(current=>current.map((o,i)=>o.type==="DYNAMIC"?{...o,position:{...o.position,x:o.position.x+Math.sin(Date.now()/900+i)*.35,z:o.position.z+Math.cos(Date.now()/1100+i)*.35}}:o));
    },120);
    return()=>clearInterval(timer);
  },[]);

  useEffect(()=>{
    if(!mission?._id)return;
    const timer=setInterval(()=>{fetch(API+"/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({missionId:mission._id,position:pos,altitude:pos.y,speed,heading,gpsStatus:gps?"CONNECTED":"DENIED",obstacleDetected:sensor,sensorDistance})}).catch(()=>{});socketRef.current?.emit("phone-telemetry",{x:pos.x,y:pos.y,z:pos.z,speed,heading,gps:gps?"CONNECTED":"DENIED",status,phase,target});},500);
    return()=>clearInterval(timer);
  },[mission,pos,speed,heading,gps,sensor,sensorDistance,status,phase,target]);

  const distance=Math.hypot(pos.x-target.x,pos.y-target.y,pos.z-target.z);

  return <div className="app">
    <header className="topbar"><div><h1>NAVIGATE-X <span>◈</span></h1><p>3D GPS-DENIED AUTONOMOUS FLIGHT LAB</p></div><div className="top-status"><span className={gps?"ok":"danger"}>● GPS {gps?"LOCK":"DENIED"}</span><span className={phoneConnected?"ok":"danger"}>● REMOTE {phoneConnected?"LINKED":"OFFLINE"}</span></div></header>
    <main className="sim-layout">
      <section className="scene">
        <Canvas shadows camera={{position:[75,45,75],fov:58}}>
          <color attach="background" args={["#030914"]}/>
          <fog attach="fog" args={["#030914",70,150]}/>
          <ambientLight intensity={.65}/><directionalLight castShadow position={[20,80,20]} intensity={2.2}/>
          <pointLight position={[-30,25,-20]} intensity={20} distance={80}/>
          <Grid args={[140,100]} position={[0,0,0]} sectionSize={5} cellSize={1} fadeDistance={100} fadeStrength={1}/>
          <City/>
          {obstacles.map((o,i)=>o.type==="DYNAMIC"?<DynamicObject key={i} o={o}/>:<Obstacle key={i} o={o}/>)}
          <DroneModel p={pos} heading={heading}/>
          <DroneSensors position={pos} obstacles={obstacles} range={14} onDetection={({detected,distance:front})=>{setSensor(detected);setSensorDistance(front);if(detected&&front<3.5&&auto)replan()}}/>
          <Route path={path}/>
          <TargetMarker target={target}/>
          <GroundPicker onPick={p=>{setTarget(p);setMessage("Target selected at "+p.x+", "+p.y+", "+p.z);}}/>
          <DroneCamera position={pos} heading={heading} enabled={viewMode==="FPV"}/>
          {viewMode!=="FPV"&&<OrbitControls enableDamping dampingFactor={.08}/>}
        </Canvas>
        <div className="flight-hud"><div className="hud-title">LIVE FLIGHT VIEW <span className="pulse">● LIVE</span></div><div className="hud-row"><b>{status}</b><span>ALT {pos.y.toFixed(1)}m</span><span>SPD {speed.toFixed(1)}m/s</span><span>HDG {heading.toFixed(0)}°</span></div><div className="hud-row muted">POSITION {pos.x.toFixed(1)} / {pos.y.toFixed(1)} / {pos.z.toFixed(1)} · TARGET {target.x} / {target.y} / {target.z}</div></div>
        <div className="view-switch"><button className={viewMode==="CHASE"?"active":""} onClick={()=>setViewMode("CHASE")}>CHASE 3D</button><button className={viewMode==="FPV"?"active":""} onClick={()=>setViewMode("FPV")}>DRONE FPV</button></div>
        <div className="mini-monitor"><div className="mini-title">MISSION RADAR</div><div className="radar"><div className="radar-drone" style={{left:`${50+pos.x*.45}%`,top:`${50+pos.z*.45}%`}}>◆</div><div className="radar-target" style={{left:`${50+target.x*.45}%`,top:`${50+target.z*.45}%`}}>✦</div></div><small>D = DRONE · T = TARGET</small></div>
      </section>
      <aside className="control-panel">
        <div className="panel-heading"><span>MISSION CONTROL</span><small>REMOTE + AUTONOMOUS</small></div>
        <div className="target-box"><div className="section-label">TARGET LOCATION</div><div className="coord-grid"><label>X<input type="number" value={target.x} onChange={e=>setTarget({...target,x:+e.target.value})}/></label><label>ALT<input type="number" value={target.y} onChange={e=>setTarget({...target,y:Math.max(2,+e.target.value)})}/></label><label>Z<input type="number" value={target.z} onChange={e=>setTarget({...target,z:+e.target.value})}/></label></div><p className="hint">Tip: click any point in the 3D city to select the target.</p></div>
        <div className="button-grid"><button onClick={()=>calculate()}>CALCULATE 3D A*</button><button onClick={create}>CREATE MISSION</button><button className="primary" onClick={start}>TAKEOFF / START</button><button onClick={stop}>STOP / LAND</button><button className="warning" onClick={addObstacle}>＋ LIVE OBSTACLE</button><button className="warning" onClick={disconnect}>{gps?"GPS DISCONNECT":"GPS RESTORE"}</button></div>
        <div className="manual-box"><div className="section-label">ADVANCED MANUAL CONTROLLER</div><button className={manualMode?"manual-active":""} onClick={()=>setManualMode(true)}>MANUAL MODE</button><div className="dpad"><button onClick={()=>manualMove("UP_LEFT")}>↖</button><button onClick={()=>manualMove("UP")}>↑</button><button onClick={()=>manualMove("UP_RIGHT")}>↗</button><button onClick={()=>manualMove("LEFT")}>←</button><button onClick={()=>stop()}>■</button><button onClick={()=>manualMove("RIGHT")}>→</button><button onClick={()=>manualMove("DOWN_LEFT")}>↙</button><button onClick={()=>manualMove("DOWN")}>↓</button><button onClick={()=>manualMove("DOWN_RIGHT")}>↘</button></div></div>
        <MissionMonitor status={status} phase={phase} gps={gps} waypoints={path.length} missionId={mission?._id} phoneCommand={phoneCommand} phoneConnected={phoneConnected} sensor={sensor}/>
        <TelemetryPanel data={{...pos,altitude:pos.y,speed,distance,heading,sensorDistance}}/>
        <div className="message">{message}</div>
      </aside>
    </main>
  </div>;
}
export default App;
