import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";
import "./phone.css";

function getLanBackendUrl(){
 const configured=import.meta.env.VITE_SOCKET_URL?.trim();
 if(configured)return configured.replace(/\/$/,"");
 return `http://${window.location.hostname}:5000`;
}
const SOCKET_URL=getLanBackendUrl();

export default function PhoneController(){
 const socketRef=useRef(null);
 const joystickRef=useRef(null);
 const joystickActiveRef=useRef(false);
 const joystickVectorRef=useRef({x:0,y:0});
 const joystickTimerRef=useRef(null);
 const lastJoystickCommandRef=useRef("");
 const [connected,setConnected]=useState(false);
 const [last,setLast]=useState("HOVER");
 const [confirmed,setConfirmed]=useState(false);
 const [joystick,setJoystick]=useState({x:0,y:0});
 const [target,setTarget]=useState({x:700,y:60,z:450});
 const [battery,setBattery]=useState(100);
 const [telemetry,setTelemetry]=useState({x:0,y:12,z:0,speed:0,heading:0,gps:"CONNECTED",status:"READY",phase:"IDLE",mode:"MANUAL",target:{x:65,y:16,z:0},distanceToTarget:0,sensorDistance:18});

 useEffect(()=>{
  const s=io(SOCKET_URL,{transports:["websocket","polling"],reconnection:true});
  socketRef.current=s;
  s.on("connect",()=>{setConnected(true);s.emit("register-client",{role:"phone"});});
  s.on("disconnect",()=>setConnected(false));
  s.on("phone-telemetry",d=>{
   if(!d)return;
   setTelemetry(d);
   if(typeof d.battery==="number")setBattery(d.battery);
   if(d.target){setTarget(d.target);if(d.status&&d.status!=="READY")setConfirmed(true)}
  });
  return()=>s.disconnect();
 },[]);

 function send(command){
  setLast(command);
  if(socketRef.current?.connected)socketRef.current.emit("phone-control",command);
  else setLast("OFFLINE");
 }

 function selectTarget(){
  const safe={x:Number(target.x)||0,y:Math.max(5,Number(target.y)||30),z:Number(target.z)||0};
  setTarget(safe);setConfirmed(true);setLast("TARGET");
  socketRef.current?.emit("target-sync",safe);
  socketRef.current?.emit("phone-control","TARGET:"+JSON.stringify(safe));
 }

 function joystickCommand(x,y){
  const dead=.18;
  let command="HOVER";
  if(Math.hypot(x,y)>=dead){
   if(Math.abs(y)>=Math.abs(x))command=y<0?"UP":"DOWN";
   else command=x<0?"LEFT":"RIGHT";
  }
  if(command!==lastJoystickCommandRef.current){
   lastJoystickCommandRef.current=command;
   send(command);
  }
 }

 function updateJoystick(e){
  if(!joystickActiveRef.current)return;
  const el=joystickRef.current,r=el.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;
  const x=Math.max(-1,Math.min(1,(e.clientX-cx)/max));
  const y=Math.max(-1,Math.min(1,(e.clientY-cy)/max));
  joystickVectorRef.current={x,y};
  setJoystick({x,y});
  joystickCommand(x,y);
 }

 function startJoystick(e){
  e.preventDefault();
  const el=joystickRef.current;
  if(!el)return;
  joystickActiveRef.current=true;
  el.setPointerCapture?.(e.pointerId);
  updateJoystick(e);
  clearInterval(joystickTimerRef.current);
  joystickTimerRef.current=setInterval(()=>joystickCommand(joystickVectorRef.current.x,joystickVectorRef.current.y),120);
 }

 function endJoystick(e){
  joystickActiveRef.current=false;
  joystickVectorRef.current={x:0,y:0};
  clearInterval(joystickTimerRef.current);
  lastJoystickCommandRef.current="";
  setJoystick({x:0,y:0});
  send("HOVER");
  try{joystickRef.current?.releasePointerCapture?.(e.pointerId)}catch{}
 }

 useEffect(()=>()=>clearInterval(joystickTimerRef.current),[]);

 const droneLeft=50+Math.max(-46,Math.min(46,Number(telemetry.x||0)/30));
 const droneTop=50+Math.max(-40,Math.min(40,Number(telemetry.z||0)/30));
 const targetLeft=50+Math.max(-46,Math.min(46,Number(target.x||0)/30));
 const targetTop=50+Math.max(-40,Math.min(40,Number(target.z||0)/30));
 const gpsLost=telemetry.gps!=="CONNECTED";

 return <div className="phone-controller">
  <header className="remote-header">
   <div><h1>NAVIGATE-X</h1><p>SMART FLIGHT REMOTE</p></div>
   <span className={connected?"ok":"danger"}>● {connected?"LINKED":"OFFLINE"}</span>
  </header>

  <section className="camera-monitor">
   <div className="camera-top"><span>● LIVE FPV CAMERA</span><span>{telemetry.mode||"MANUAL"}</span></div>
   <div className="camera-screen">
    <div className="camera-sky"></div>
    <div className="camera-horizon"></div>
    <div className="camera-ground"></div>
    <div className="camera-reticle">+</div>
    <div className="target-lock" style={{left:`${targetLeft}%`,top:`${targetTop}%`}}>T<div>TARGET</div></div>
    <div className="camera-drone" style={{left:`${droneLeft}%`,top:`${droneTop}%`}}>◆</div>
    <div className="camera-grid"></div>
    <div className="camera-info"><span>ALT {Number(telemetry.y||0).toFixed(1)}m</span><span>SPD {Number(telemetry.speed||0).toFixed(1)}m/s</span><span>HDG {Number(telemetry.heading||0).toFixed(0)}°</span></div>
    <div className="camera-bottom"><span>{telemetry.status}</span><span>D {Number(telemetry.distanceToTarget||0).toFixed(0)}m</span></div>
   </div>
  </section>

  <section className="remote-card battery-panel">
   <div><span>BATTERY</span><b>{Math.round(battery)}%</b></div>
   <div className="battery-bar"><i style={{width:`${Math.max(0,Math.min(100,battery))}%`}}></i></div>
   <div className="battery-meta"><span>GPS <b className={gpsLost?"danger":"ok"}>{gpsLost?"LOST":"LOCKED"}</b></span><span>SIGNAL <b className={connected?"ok":"danger"}>{connected?"STRONG":"OFFLINE"}</b></span><span>PHASE <b>{telemetry.phase||"IDLE"}</b></span></div>
  </section>

  <section className="remote-card target-card">
   <div className="section-title"><h3>TARGET LOCATION</h3><span>{confirmed?"LOCKED":"SELECT"}</span></div>
   <div className="target-map" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const x=Math.round(((e.clientX-r.left)/r.width-.5)*3000);const z=Math.round(((e.clientY-r.top)/r.height-.5)*3000);setTarget({x,y:60,z});setConfirmed(false);setLast("TARGET SELECTED")}}>
    <div className="map-cross x"></div><div className="map-cross z"></div><div className="map-home">H</div>
    <div className="map-drone" style={{left:`${droneLeft}%`,top:`${droneTop}%`}}>D</div>
    <div className="map-target" style={{left:`${targetLeft}%`,top:`${targetTop}%`}}>T</div>
    {!confirmed&&<div className="map-hint">TAP TO SET TARGET</div>}
   </div>
   <div className="target-coords">TARGET · X {Math.round(target.x)} · Z {Math.round(target.z)} · DIST {Number(telemetry.distanceToTarget||0).toFixed(0)}m</div>
   <div className="target-row">
    <button onClick={e=>{const r=e.currentTarget.previousSibling.getBoundingClientRect();void r;}} className="small-action">3 KM MAP</button>
    <button className="confirm-target" onClick={selectTarget} disabled={confirmed}>{confirmed?"✓ TARGET LOCKED":"CONFIRM TARGET"}</button>
   </div>
  </section>

  <section className="remote-card control-deck">
   <div className="section-title"><h3>FLIGHT CONTROL</h3><span>TOUCH</span></div>
   <div className="sticks-row">
    <div className="stick-block"><div className="joystick" ref={joystickRef} onPointerDown={startJoystick} onPointerMove={updateJoystick} onPointerUp={endJoystick} onPointerCancel={endJoystick}>
      <div className="joystick-ring"></div><div className="joystick-center" style={{transform:`translate(calc(-50% + ${joystick.x*36}px),calc(-50% + ${joystick.y*36}px))`}}></div>
    </div><div className="stick-label">← LEFT &nbsp;&nbsp; FORWARD ↑ &nbsp;&nbsp; RIGHT →</div></div>
    <div className="shortcut-grid">
     <button onClick={()=>send("HOVER")}>HOVER</button><button onClick={()=>send("STOP")}>STOP</button>
     <button onClick={()=>send("GPS_TOGGLE")}>GPS</button><button onClick={()=>send("AUTOPILOT")}>AUTO</button>
    </div>
   </div>
  </section>

  <section className="action-deck">
   <button className="takeoff-button" onClick={()=>send("START")}>▲<span>TAKE OFF</span></button>
   <button className="land-button" onClick={()=>send("LAND")}>▼<span>LAND</span></button>
   <button className="auto-button" onClick={()=>send("AUTOPILOT")}>◆<span>AUTOPILOT</span></button>
   <button className="emergency-button" onClick={()=>send("EMERGENCY")}>!</button>
  </section>

  <div className={gpsLost?"gps-warning active":"gps-warning"}>⚠ {gpsLost?"GPS SIGNAL LOST — EMERGENCY AUTOPILOT READY":"GPS SIGNAL STABLE"} <b>{gpsLost?"EMERGENCY AUTO":"NORMAL"}</b></div>
  <div className="last-command">LAST COMMAND <b>{last}</b></div>
  <p className="hint">Phone Remote → Socket.IO → Main Flight Controller → 3D Simulator</p>
 </div>
}
