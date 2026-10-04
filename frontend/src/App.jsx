import {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame} from "@react-three/fiber";
import {OrbitControls,Grid} from "@react-three/drei";
import * as THREE from "three";
import {io} from "socket.io-client";
import TelemetryPanel from "./components/TelemetryPanel";
import MissionMonitor from "./components/MissionMonitor";
import DroneSensors from "./components/DroneSensors";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";

const HOME={x:0,y:2,z:0};
const initialObstacles=[
  {position:{x:18,y:5,z:0},size:{x:8,y:10,z:10},type:"STATIC"},
  {position:{x:38,y:8,z:8},size:{x:8,y:16,z:8},type:"STATIC"},
  {position:{x:52,y:4,z:-12},size:{x:12,y:8,z:8},type:"STATIC"}
];

function Drone({p}){
  const g=useRef();
  useFrame((_,d)=>{if(g.current)g.current.rotation.y+=d*1.5;});
  return <group ref={g} position={[p.x,p.y,p.z]}>
    <mesh><boxGeometry args={[2.5,.7,2]}/><meshStandardMaterial/></mesh>
    {[[1.8,.4],[1.8,-.4],[-1.8,.4],[-1.8,-.4]].map((m,i)=>
      <group key={i} position={[m[0],.2,m[1]]}>
        <mesh><cylinderGeometry args={[.12,.12,.3,12]}/><meshStandardMaterial/></mesh>
        <mesh rotation={[Math.PI/2,0,0]}><boxGeometry args={[1.3,.06,.12]}/><meshStandardMaterial/></mesh>
      </group>
    )}
  </group>;
}

function Box({o}){
  return <mesh position={[o.position.x,o.position.y,o.position.z]}>
    <boxGeometry args={[o.size.x,o.size.y,o.size.z]}/>
    <meshStandardMaterial transparent opacity={.55}/>
  </mesh>;
}

function Route({path}){
  const pts=useMemo(()=>path.map(p=>new THREE.Vector3(p.x,p.y,p.z)),[path]);
  if(pts.length<2)return null;
  return <line>
    <bufferGeometry attach="geometry" setFromPoints={pts}/>
    <lineBasicMaterial/>
  </line>;
}

function App(){
  const socketRef=useRef(null);
  const idx=useRef(0);
  const returningRef=useRef(false);
  const replanLock=useRef(false);
  const startRef=useRef(null);
  const stopRef=useRef(null);
  const disconnectRef=useRef(null);

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
  const [obstacles,setObstacles]=useState(initialObstacles);

  async function patchMission(data){
    if(!mission?._id)return;
    try{
      await fetch(API+`/missions/${mission._id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data)
      });
    }catch{}
  }

  async function calculate(from=pos,to=target){
    try{
      const r=await fetch(API+"/routes/calculate",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({start:from,goal:to,obstacles})
      });
      if(!r.ok)throw new Error("Route API failed");
      const d=await r.json();
      const route=d.route||[];
      setPath(route);
      idx.current=0;
      setMessage(route.length?"3D A* route calculated":"No safe route found");
      return route;
    }catch(e){
      setPath([]);
      setMessage("Backend unavailable — start the backend server");
      return [];
    }
  }

  async function create(){
    const p=await calculate();
    if(!p.length)return;
    try{
      const r=await fetch(API+"/missions",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          start:HOME,target,route:p,
          gpsStatus:gps?"CONNECTED":"DENIED",
          status:"READY",phase:"PLANNED"
        })
      });
      if(!r.ok)throw new Error();
      const m=await r.json();
      setMission(m);
      setStatus("MISSION CREATED");
      setPhase("PLANNED");
      setMessage("Mission saved to MongoDB");
    }catch{
      setMessage("Mission could not be saved — check MongoDB/backend");
    }
  }

  async function start(){
    if(!path.length){
      setMessage("Calculate a route first");
      return;
    }
    returningRef.current=false;
    setAuto(true);
    const nextStatus=gps?"AUTONOMOUS":"EMERGENCY AUTOPILOT";
    const nextPhase=gps?"NAVIGATING":"GPS-DENIED NAVIGATION";
    setStatus(nextStatus);
    setPhase(nextPhase);
    setMessage("Autonomous navigation active");
    await patchMission({status:nextStatus,phase:nextPhase,gpsStatus:gps?"CONNECTED":"DENIED"});
  }

  async function stop(){
    setAuto(false);
    setSpeed(0);
    setStatus("STOPPED");
    setPhase("MANUAL");
    setMessage("Mission paused");
    await patchMission({status:"STOPPED",phase:"MANUAL"});
  }

  async function addObstacle(){
    const next=path[idx.current]||{x:pos.x+7,y:pos.y,z:pos.z};
    const o={
      position:{x:next.x,y:next.y,z:next.z},
      size:{x:5,y:5,z:5},
      type:"DYNAMIC"
    };
    setObstacles(v=>[...v,o]);
    setSensor(true);
    setMessage("Dynamic obstacle injected ahead");
    if(mission?._id){
      fetch(API+"/obstacles",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...o,missionId:mission._id})
      }).catch(()=>{});
    }
  }

  function blocked(n){
    return obstacles.some(o=>
      Math.abs(n.x-o.position.x)<o.size.x/2+2 &&
      Math.abs(n.y-o.position.y)<o.size.y/2+2 &&
      Math.abs(n.z-o.position.z)<o.size.z/2+2
    );
  }

  async function replan(){
    setAuto(false);
    setSpeed(0);
    setSensor(true);
    setStatus("OBSTACLE DETECTED");
    setPhase("REPLANNING");
    setMessage("Obstacle detected — calculating new safe route");
    const p=await calculate(pos,target);
    if(!p.length){
      setStatus("ROUTE BLOCKED");
      setPhase("WAITING FOR CLEAR PATH");
      setMessage("No safe route found. Move/remove the obstacle.");
      return;
    }
    setSensor(false);
    idx.current=0;
    setPath(p);
    setAuto(true);
    const nextStatus=gps?"AUTONOMOUS":"EMERGENCY AUTOPILOT";
    setStatus(nextStatus);
    setPhase("REPLANNED NAVIGATION");
    setMessage("New safe route calculated");
    await patchMission({status:nextStatus,phase:"REPLANNED NAVIGATION",route:p});
  }

  const disconnect=async()=>{
    const next=!gps;
    setGps(next);
    if(!next){
      setStatus("EMERGENCY AUTOPILOT");
      setPhase("GPS DENIED");
      setMessage("GPS lost — switching to sensor-based navigation");
      await patchMission({gpsStatus:"DENIED",status:"EMERGENCY AUTOPILOT",phase:"GPS DENIED"});
    }else{
      setStatus("READY");
      setPhase("GPS RESTORED");
      setMessage("GPS restored");
      await patchMission({gpsStatus:"CONNECTED",status:"READY",phase:"GPS RESTORED"});
    }
  };

  startRef.current=start;
  stopRef.current=stop;
  disconnectRef.current=disconnect;

  useEffect(()=>{
    const s=io(SOCKET_URL);
    socketRef.current=s;
    s.on("connect",()=>setPhoneConnected(true));
    s.on("disconnect",()=>setPhoneConnected(false));
    s.on("phone-control",cmd=>{
      setPhoneCommand(cmd);
      if(cmd==="START")startRef.current?.();
      else if(cmd==="STOP")stopRef.current?.();
      else if(cmd==="GPS_TOGGLE")disconnectRef.current?.();
      else if(cmd==="EMERGENCY"){
        setGps(false);
        setAuto(true);
        setStatus("EMERGENCY AUTOPILOT");
        setPhase("PHONE EMERGENCY CONTROL");
        setMessage("Emergency mode activated from phone");
      }else if(["UP","DOWN","LEFT","RIGHT"].includes(cmd)){
        setAuto(false);
        setSpeed(5);
        const dx=cmd==="RIGHT"?1:cmd==="LEFT"?-1:0;
        const dy=cmd==="UP"?1:cmd==="DOWN"?-1:0;
        setPos(p=>({x:p.x+dx,y:Math.max(0,p.y+dy),z:p.z}));
      }
    });
    return()=>s.disconnect();
  },[]);

  useEffect(()=>{
    if(!auto)return;
    const timer=setInterval(async()=>{
      const n=path[idx.current];
      if(!n){
        setAuto(false);
        setSpeed(0);
        if(returningRef.current){
          setStatus("MISSION COMPLETE");
          setPhase("HOME LANDED");
          setMessage("Mission complete — vehicle returned home");
          await patchMission({status:"MISSION COMPLETE",phase:"HOME LANDED",completedAt:new Date().toISOString()});
        }else{
          setStatus("TARGET REACHED");
          setPhase("LANDING");
          setMessage("Target reached — landing");
        }
        return;
      }
      if(blocked(n)){
        await replan();
        return;
      }
      const previous=pos;
      setHeading(Math.atan2(n.z-previous.z,n.x-previous.x)*180/Math.PI);
      setPos(n);
      setSpeed(12);
      idx.current++;
    },220);
    return()=>clearInterval(timer);
  },[auto,path,obstacles,gps,pos]);

  useEffect(()=>{
    if(status!=="TARGET REACHED")return;
    const timer=setTimeout(async()=>{
      setStatus("LANDED");
      setPhase("WAITING 10s");
      setSpeed(0);
      await patchMission({status:"LANDED",phase:"WAITING 10s"});
      await new Promise(r=>setTimeout(r,10000));
      returningRef.current=true;
      const p=await calculate(pos,HOME);
      if(!p.length){
        setStatus("RETURN ROUTE BLOCKED");
        setPhase("RETURN FAILED");
        setMessage("Could not calculate the return route");
        return;
      }
      idx.current=0;
      setPath(p);
      setAuto(true);
      setStatus("RETURNING HOME");
      setPhase("RETURN TO HOME");
      setMessage("10 seconds complete — returning home");
      await patchMission({status:"RETURNING HOME",phase:"RETURN TO HOME",route:p});
    },1000);
    return()=>clearTimeout(timer);
  },[status]);

  useEffect(()=>{
    if(!mission?._id)return;
    const timer=setInterval(()=>{
      fetch(API+"/telemetry",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          missionId:mission._id,
          position:pos,
          altitude:pos.y,
          speed,
          heading,
          gpsStatus:gps?"CONNECTED":"DENIED",
          obstacleDetected:sensor,
          sensorDistance
        })
      }).catch(()=>{});
      socketRef.current?.emit("phone-telemetry",{
        x:pos.x,y:pos.y,z:pos.z,speed,heading,
        gps:gps?"CONNECTED":"DENIED",status,phase
      });
    },500);
    return()=>clearInterval(timer);
  },[mission,pos,speed,heading,gps,sensor,sensorDistance,status,phase]);

  const distance=Math.hypot(pos.x-target.x,pos.y-target.y,pos.z-target.z);

  return <div className="app">
    <header>
      <div><h1>NAVIGATE-X</h1><p>GPS-DENIED AUTONOMOUS NAVIGATION SIMULATOR</p></div>
      <div>
        <span className={gps?"ok":"danger"}>● GPS {gps?"CONNECTED":"DENIED"}</span>
        <span className={phoneConnected?"ok":"danger"} style={{marginLeft:16}}>● PHONE {phoneConnected?"LINKED":"OFFLINE"}</span>
      </div>
    </header>

    <main>
      <section className="scene">
        <Canvas camera={{position:[90,60,90],fov:50}}>
          <ambientLight intensity={1}/>
          <directionalLight position={[20,50,10]} intensity={2}/>
          <Grid args={[120,120]} sectionSize={5} cellSize={1}/>
          <Drone p={pos}/>
          <DroneSensors
            position={pos}
            obstacles={obstacles}
            range={12}
            onDetection={({detected,distance:front})=>{
              setSensor(detected);
              setSensorDistance(front);
              if(detected && front<3.5 && auto && !replanLock.current && !["REPLANNING","OBSTACLE DETECTED"].includes(status)){
                replanLock.current=true;
                replan().finally(()=>setTimeout(()=>{replanLock.current=false;},1500));
              }
            }}
          />
          <Route path={path}/>
          <mesh position={[target.x,target.y,target.z]}>
            <sphereGeometry args={[2,20,20]}/><meshStandardMaterial/>
          </mesh>
          {obstacles.map((o,i)=><Box o={o} key={i}/>)}
          <OrbitControls/>
        </Canvas>
        <div className="scene-hud">
          <b>{status}</b>
          <span>Sensor: {sensor?"OBSTACLE":"CLEAR"} | Range: {sensorDistance.toFixed(1)}m</span>
        </div>
      </section>

      <aside>
        <h2>Mission Control</h2>
        <label>Target X<input type="number" value={target.x} onChange={e=>setTarget({...target,x:+e.target.value})}/></label>
        <label>Target Y<input type="number" value={target.y} onChange={e=>setTarget({...target,y:+e.target.value})}/></label>
        <label>Target Z<input type="number" value={target.z} onChange={e=>setTarget({...target,z:+e.target.value})}/></label>

        <button onClick={()=>calculate()}>Calculate 3D A*</button>
        <button onClick={create}>Create Mission</button>
        <button onClick={start}>Start Autonomous Mission</button>
        <button onClick={stop}>Stop Mission</button>
        <button onClick={addObstacle}>+ Inject Dynamic Obstacle</button>
        <button className="warn" onClick={disconnect}>{gps?"Disconnect GPS":"Restore GPS"}</button>
        {sensor&&<button className="warn" onClick={replan}>Replan From Sensor Detection</button>}

        <MissionMonitor
          status={status}
          phase={phase}
          gps={gps}
          waypoints={path.length}
          missionId={mission?._id}
          phoneCommand={phoneCommand}
          phoneConnected={phoneConnected}
          sensor={sensor}
        />
        <TelemetryPanel data={{...pos,altitude:pos.y,speed,distance,heading,sensorDistance}}/>

        <div className="message">{message}</div>
        <div className="cards">
          <b>STATUS<br/><span>{status}</span></b>
          <b>PHASE<br/><span>{phase}</span></b>
          <b>POSITION<br/><span>{pos.x.toFixed(1)}, {pos.y.toFixed(1)}, {pos.z.toFixed(1)}</span></b>
          <b>SPEED<br/><span>{speed.toFixed(1)} m/s</span></b>
          <b>DISTANCE<br/><span>{distance.toFixed(1)} m</span></b>
          <b>WAYPOINTS<br/><span>{path.length}</span></b>
        </div>
      </aside>
    </main>
  </div>;
}

export default App;
