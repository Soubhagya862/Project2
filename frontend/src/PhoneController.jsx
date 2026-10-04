import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";
import "./phone.css";

function getLanBackendUrl(){
 const configured=import.meta.env.VITE_SOCKET_URL?.trim();
 if(configured)return configured.replace(/\/$/,"");
 return `http://${window.location.hostname}:5000`;
}
const SOCKET_URL=getLanBackendUrl();
const COMMAND_API=(()=>{const v=import.meta.env.VITE_API_URL?.trim();if(v&&!/localhost|127\.0\.0\.1/i.test(v))return v.replace(/\/$/,"");return `${window.location.protocol}//${window.location.hostname}:5000/api`;})();

const DEFAULT_TARGET={x:700,y:60,z:450};
const KEY_COMMANDS={w:"UP",s:"DOWN",a:"LEFT",d:"RIGHT",q:"YAW_LEFT",e:"YAW_RIGHT","ArrowUp":"ASCEND","ArrowDown":"DESCEND"};

export default function PhoneController(){
 const socketRef=useRef(null),joystickRef=useRef(null),joystickActiveRef=useRef(false),joystickVectorRef=useRef({x:0,y:0}),joystickTimerRef=useRef(null),buttonTimerRef=useRef(null),buttonCommandRef=useRef(""),lastJoystickCommandRef=useRef(""),targetPendingRef=useRef(false),keyboardRef=useRef(new Set());
 const [connected,setConnected]=useState(false),[last,setLast]=useState("HOVER"),[confirmed,setConfirmed]=useState(false),[joystick,setJoystick]=useState({x:0,y:0}),[target,setTarget]=useState(DEFAULT_TARGET),[battery,setBattery]=useState(100);
 const [telemetry,setTelemetry]=useState({x:0,y:2,z:0,speed:0,heading:0,gps:"CONNECTED",status:"READY",phase:"IDLE",mode:"MANUAL",target:DEFAULT_TARGET,distanceToTarget:0,sensorDistance:18});

 useEffect(()=>{
  const s=io(SOCKET_URL,{transports:["websocket","polling"],reconnection:true});socketRef.current=s;
  s.on("connect",()=>{setConnected(true);s.emit("register-client",{role:"phone"})});s.on("disconnect",()=>setConnected(false));
  s.on("phone-telemetry",d=>{if(!d)return;setTelemetry(d);if(typeof d.battery==="number")setBattery(d.battery);if(d.target&&!targetPendingRef.current)setTarget(d.target)});
  return()=>s.disconnect();
 },[]);

 function send(command){
  setLast(command);
  const speech={START:"Drone is ready to take up",LAND:"Drone landing",HOVER:"Drone holding position"}[command];
  if(speech)try{window.speechSynthesis?.cancel();window.speechSynthesis?.speak(new SpeechSynthesisUtterance(speech))}catch{}
  fetch(COMMAND_API+"/flight-command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command}),cache:"no-store"})
   .then(r=>{if(!r.ok)throw Error()}).catch(()=>setLast("COMMAND SERVER OFFLINE"));
 }

 function selectTargetFromMap(e){
  const r=e.currentTarget.getBoundingClientRect(),x=Math.round(((e.clientX-r.left)/r.width-.5)*3000),z=Math.round(((e.clientY-r.top)/r.height-.5)*3000),next={x,y:60,z};
  targetPendingRef.current=true;setTarget(next);setConfirmed(false);setLast("TARGET SELECTED");
 }
 function confirmTarget(){const safe={x:Number(target.x)||0,y:Math.max(5,Number(target.y)||60),z:Number(target.z)||0};targetPendingRef.current=false;setTarget(safe);setConfirmed(true);setLast("TARGET CONFIRMED");send("TARGET:"+JSON.stringify(safe))}
 function setMode(mode){if(mode==="MANUAL")send("HOVER");if(mode==="AUTOPILOT")send("AUTOPILOT");if(mode==="EMERGENCY")send("EMERGENCY")}
 function startButtonControl(command){clearInterval(buttonTimerRef.current);buttonCommandRef.current=command;send(command);buttonTimerRef.current=setInterval(()=>send(buttonCommandRef.current),120)}
 function endButtonControl(){clearInterval(buttonTimerRef.current);buttonTimerRef.current=null;buttonCommandRef.current="";send("HOVER")}
 function joystickCommand(x,y){const dead=.18;let command="HOVER";if(Math.hypot(x,y)>=dead)command=Math.abs(y)>=Math.abs(x)?(y<0?"UP":"DOWN"):(x<0?"LEFT":"RIGHT");if(command!==lastJoystickCommandRef.current){lastJoystickCommandRef.current=command;send(command)}}
 function updateJoystick(e){if(!joystickActiveRef.current)return;const el=joystickRef.current,r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34,x=Math.max(-1,Math.min(1,(e.clientX-cx)/max)),y=Math.max(-1,Math.min(1,(e.clientY-cy)/max));joystickVectorRef.current={x,y};setJoystick({x,y});joystickCommand(x,y)}
 function startJoystick(e){e.preventDefault();const el=joystickRef.current;if(!el)return;joystickActiveRef.current=true;el.setPointerCapture?.(e.pointerId);updateJoystick(e);clearInterval(joystickTimerRef.current);joystickTimerRef.current=setInterval(()=>joystickCommand(joystickVectorRef.current.x,joystickVectorRef.current.y),120)}
 function endJoystick(e){joystickActiveRef.current=false;joystickVectorRef.current={x:0,y:0};clearInterval(joystickTimerRef.current);lastJoystickCommandRef.current="";setJoystick({x:0,y:0});send("HOVER");try{joystickRef.current?.releasePointerCapture?.(e.pointerId)}catch{}}

 useEffect(()=>{
  const down=e=>{const command=KEY_COMMANDS[e.key];if(!command||keyboardRef.current.has(e.key))return;e.preventDefault();keyboardRef.current.add(e.key);send(command)};
  const up=e=>{const command=KEY_COMMANDS[e.key];if(!command)return;e.preventDefault();keyboardRef.current.delete(e.key);if(keyboardRef.current.size===0)send("HOVER")};
  window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);keyboardRef.current.clear()};
 },[]);
 useEffect(()=>()=>{clearInterval(joystickTimerRef.current);clearInterval(buttonTimerRef.current)},[]);

 const droneLeft=50+Math.max(-46,Math.min(46,Number(telemetry.x||0)/30)),droneTop=50+Math.max(-40,Math.min(40,Number(telemetry.z||0)/30)),targetLeft=50+Math.max(-46,Math.min(46,Number(target.x||0)/30)),targetTop=50+Math.max(-40,Math.min(40,Number(target.z||0)/30)),gpsLost=telemetry.gps!=="CONNECTED";

 return <div className="flight-control-page">
  <header className="fc-header"><div><h1>NAVIGATE-X <span>◈</span></h1><p>FLIGHT CONTROL / GPS-DENIED NAVIGATION</p></div><div className="fc-link"><b className={connected?"ok":"danger"}>● {connected?"LINKED":"OFFLINE"}</b><span>PC CONTROL: WASD + Q/E</span></div></header>
  <main className="fc-layout">
   <aside className="fc-left"><div className="fc-panel-title">MISSION / EMERGENCY</div>
    <button className="fc-mode manual" onClick={()=>setMode("MANUAL")}>◉ MANUAL<br/><small>REMOTE CONTROL</small></button>
    <button className="fc-mode auto" onClick={()=>setMode("AUTOPILOT")}>◆ AUTOPILOT<br/><small>FOLLOW SAFE ROUTE</small></button>
    <button className="fc-mode emergency" onClick={()=>setMode("EMERGENCY")}>! EMERGENCY AUTONOMOUS<br/><small>GPS-DENIED SENSOR MODE</small></button>
    <div className="fc-action-grid"><button className="takeoff" onClick={()=>send("START")}>▲<span>TAKE OFF</span></button><button className="land" onClick={()=>send("LAND")}>▼<span>LAND</span></button><button onClick={()=>send("HOVER")}>●<span>HOVER</span></button><button onClick={()=>send("STOP")}>■<span>STOP</span></button><button onClick={()=>send("GPS_TOGGLE")}>GPS<span>{gpsLost?"OFF":"ON"}</span></button><button onClick={()=>send("EMERGENCY")}>!<span>EMERGENCY</span></button></div>
    <div className="fc-status"><div>STATUS <b>{telemetry.status}</b></div><div>PHASE <b>{telemetry.phase}</b></div><div>MODE <b>{telemetry.mode}</b></div><div>GPS <b className={gpsLost?"danger":"ok"}>{gpsLost?"LOST":"CONNECTED"}</b></div></div>
   </aside>
   <section className="fc-center">
    <div className="fc-live"><div className="fc-section-head"><b>● LIVE DRONE MONITOR</b><span>{telemetry.mode}</span></div>
     <div className="camera-screen"><div className="camera-sky"></div><div className="camera-horizon"></div><div className="camera-ground"></div><div className="camera-grid"></div><div className="camera-reticle">+</div><div className="target-lock" style={{left:`${targetLeft}%`,top:`${targetTop}%`}}>T<div>TARGET</div></div><div className="camera-drone" style={{left:`${droneLeft}%`,top:`${droneTop}%`}}>◆</div><div className="camera-info"><span>ALT {Number(telemetry.y||0).toFixed(1)}m</span><span>SPD {Number(telemetry.speed||0).toFixed(1)}m/s</span><span>HDG {Number(telemetry.heading||0).toFixed(0)}°</span></div><div className="camera-bottom"><span>{telemetry.status}</span><span>D {Number(telemetry.distanceToTarget||0).toFixed(0)}m</span></div></div>
    </div>
    <div className="fc-target-panel"><div className="fc-section-head"><b>SELECT TARGET LOCATION</b><span>{confirmed?"✓ ROUTE TARGET LOCKED":"CLICK MAP TO SELECT"}</span></div>
     <div className="fc-target-map" onClick={selectTargetFromMap}><div className="map-cross x"></div><div className="map-cross z"></div><div className="map-home">H</div><div className="map-drone" style={{left:`${droneLeft}%`,top:`${droneTop}%`}}>D</div><div className="map-target" style={{left:`${targetLeft}%`,top:`${targetTop}%`}}>T</div>{!confirmed&&<div className="map-hint">CLICK ANY AREA TO SET TARGET</div>}</div>
     <div className="target-readout"><span>X <b>{Math.round(target.x)}</b></span><span>ALT <b>{Math.round(target.y)}</b></span><span>Z <b>{Math.round(target.z)}</b></span><span>DIST <b>{Number(telemetry.distanceToTarget||0).toFixed(0)} m</b></span></div>
     <button className="confirm-target" onClick={confirmTarget} disabled={confirmed}>{confirmed?"✓ TARGET LOCKED — ROUTE SENT":"CONFIRM LOCATION & CALCULATE ROUTE"}</button><p className="route-note">After confirmation, the simulator receives the same X/Z target and its 3D A* navigation engine calculates a safe route around obstacles.</p>
    </div>
   </section>
   <aside className="fc-right"><div className="fc-panel-title">FLIGHT STICK</div>
    <div className="joystick-wrap"><div className="joystick" ref={joystickRef} onPointerDown={startJoystick} onPointerMove={updateJoystick} onPointerUp={endJoystick} onPointerCancel={endJoystick}><div className="joystick-ring"></div><div className="joystick-ring ring2"></div><div className="joystick-center" style={{transform:`translate(calc(-50% + ${joystick.x*62}px),calc(-50% + ${joystick.y*62}px))`}}></div></div></div>
    <div className="joystick-label">FORWARD ↑ &nbsp; / &nbsp; BACK ↓<br/>LEFT ← &nbsp; / &nbsp; RIGHT →</div>
    <div className="keyboard-card"><b>PC KEYBOARD</b><div className="key-row"><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd></div><div className="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><p>W/S MOVE FORWARD/BACK<br/>A/D MOVE LEFT/RIGHT<br/>Q/E YAW · ↑/↓ ALTITUDE</p></div>
    <div className="bottom-flight-controls"><div className="bottom-control-title">DIRECT DRONE MOVEMENT — HOLD BUTTON</div><div className="bottom-control-grid">
     <button onPointerDown={e=>{e.preventDefault();startButtonControl("YAW_LEFT")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>↶<small>YAW L</small></button><button onPointerDown={e=>{e.preventDefault();startButtonControl("ASCEND")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>↑<small>UP</small></button><button onPointerDown={e=>{e.preventDefault();startButtonControl("YAW_RIGHT")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>↷<small>YAW R</small></button>
     <button onPointerDown={e=>{e.preventDefault();startButtonControl("LEFT")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>←<small>LEFT</small></button><button className="forward" onPointerDown={e=>{e.preventDefault();startButtonControl("UP")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>▲<small>FORWARD</small></button><button onPointerDown={e=>{e.preventDefault();startButtonControl("RIGHT")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>→<small>RIGHT</small></button>
     <button onPointerDown={e=>{e.preventDefault();startButtonControl("DESCEND")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>↓<small>DOWN</small></button><button onClick={()=>send("HOVER")}>●<small>HOVER</small></button><button onPointerDown={e=>{e.preventDefault();startButtonControl("DOWN")}} onPointerUp={endButtonControl} onPointerCancel={endButtonControl}>▼<small>BACK</small></button>
    </div></div>
    <div className="telemetry-card"><div><span>BATTERY</span><b>{Math.round(battery)}%</b></div><div className="battery-bar"><i style={{width:`${Math.max(0,Math.min(100,battery))}%`}}></i></div><div className="telemetry-values"><span>ALT<b>{Number(telemetry.y||0).toFixed(1)}m</b></span><span>SPEED<b>{Number(telemetry.speed||0).toFixed(1)}m/s</b></span><span>SENSOR<b>{Number(telemetry.sensorDistance||0).toFixed(1)}m</b></span></div></div>
   </aside>
  </main>
 </div>;
}
