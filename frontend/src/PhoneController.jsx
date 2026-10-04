import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";
import "./phone.css";

function getLanBackendUrl(){
 const configured=import.meta.env.VITE_SOCKET_URL?.trim();
 if(configured)return configured.replace(/\/$/,"");
 const host=window.location.hostname;
 return `http://${host}:5000`;
}
const SOCKET_URL=getLanBackendUrl();

export default function PhoneController(){
 const socketRef=useRef(null);
 const joystickRef=useRef(null);
 const joystickTimerRef=useRef(null);
 const joystickActiveRef=useRef(false);
 const joystickVectorRef=useRef({x:0,y:0});
 const lastJoystickCommandRef=useRef("");
 const [connected,setConnected]=useState(false);
 const [last,setLast]=useState("HOVER");
 const [confirmed,setConfirmed]=useState(false);
 const [joystick,setJoystick]=useState({x:0,y:0});
 const [target,setTarget]=useState({x:700,y:60,z:450});
 const [telemetry,setTelemetry]=useState({x:0,y:12,z:0,speed:0,heading:0,gps:"CONNECTED",status:"READY",phase:"IDLE",mode:"MANUAL",target:{x:65,y:16,z:0},distanceToTarget:0,sensorDistance:18});

 useEffect(()=>{
  const s=io(SOCKET_URL,{transports:["websocket","polling"],reconnection:true});
  socketRef.current=s;
  s.on("connect",()=>{setConnected(true);s.emit("register-client",{role:"phone"});});
  s.on("disconnect",()=>setConnected(false));
  s.on("phone-telemetry",d=>{if(!d)return;setTelemetry(d);if(d.target){setTarget(d.target);if(d.status&&d.status!=="READY")setConfirmed(true)}});
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
  let command=null;
  if(Math.hypot(x,y)<dead)command="HOVER";
  else if(Math.abs(y)>=Math.abs(x))command=y<0?"UP":"DOWN";
  else command=x<0?"LEFT":"RIGHT";
  if(command!==lastJoystickCommandRef.current){
   lastJoystickCommandRef.current=command;
   send(command);
  }
 }

 function startJoystick(e){
  e.preventDefault();
  const el=joystickRef.current;
  if(!el)return;
  joystickActiveRef.current=true;
  el.setPointerCapture?.(e.pointerId);
  const update=(ev)=>{
   if(!joystickActiveRef.current)return;
   const r=el.getBoundingClientRect();
   const cx=r.left+r.width/2,cy=r.top+r.height/2;
   const max=r.width*.34;
   const x=Math.max(-1,Math.min(1,(ev.clientX-cx)/max));
   const y=Math.max(-1,Math.min(1,(ev.clientY-cy)/max));
   joystickVectorRef.current={x,y};
   setJoystick({x,y});
   joystickCommand(x,y);
  };
  el._navigateUpdate=update;
  update(e);
  clearInterval(joystickTimerRef.current);
  joystickTimerRef.current=setInterval(()=>{
   if(joystickActiveRef.current)joystickCommand(joystickVectorRef.current.x,joystickVectorRef.current.y);
  },100);
 }
 function moveJoystick(e){
  if(!joystickActiveRef.current)return;
  const el=joystickRef.current;
  const r=el.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;
  const x=Math.max(-1,Math.min(1,(e.clientX-cx)/max));
  const y=Math.max(-1,Math.min(1,(e.clientY-cy)/max));
  el._x=x;el._y=y;setJoystick({x,y});joystickCommand(x,y);
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

 return <div className="phone-controller">
  <div className="remote-header"><div><h1>NAVIGATE-X</h1><p>PHONE → MAIN FLIGHT CONTROLLER</p></div><span className={connected?"ok":"danger"}>● {connected?"LINKED":"OFFLINE"}</span></div>

  <div className="remote-card live-card">
   <div className="remote-status"><b>{telemetry.status}</b><span className={telemetry.gps==="CONNECTED"?"ok":"danger"}>GPS {telemetry.gps}</span></div>
   <div className="mode-live">MODE <b>{telemetry.mode||"MANUAL"}</b></div>
   <div className="remote-telemetry">
    <div>X<b>{Number(telemetry.x||0).toFixed(1)}</b></div><div>Z<b>{Number(telemetry.z||0).toFixed(1)}</b></div><div>SPD<b>{Number(telemetry.speed||0).toFixed(1)}</b></div><div>HDG<b>{Number(telemetry.heading||0).toFixed(0)}°</b></div>
   </div>
   <div className="remote-telemetry extra"><div>DIST<b>{Number(telemetry.distanceToTarget||0).toFixed(1)}m</b></div><div>SENSOR<b>{Number(telemetry.sensorDistance||0).toFixed(1)}m</b></div><div>PHASE<b>{telemetry.phase||"IDLE"}</b></div></div>
  </div>

  <div className="remote-card target-select"><h3>3 KM LIVE MAP · CHOOSE DESTINATION</h3>{confirmed?<div className="phone-radar"><div className="phone-radar-sweep"></div><div className="phone-radar-ring r1"></div><div className="phone-radar-ring r2"></div><div className="phone-radar-cross cx"></div><div className="phone-radar-cross cz"></div><div className="phone-radar-point phone-home-point" style={{left:"50%",top:"50%"}}>H</div><div className="phone-radar-point phone-drone-point" style={{left:`${50+Number(telemetry.x||0)/30}%`,top:`${50+Number(telemetry.z||0)/30}%`}}>D</div><div className="phone-radar-point phone-target-point" style={{left:`${50+Number(target.x||0)/30}%`,top:`${50+Number(target.z||0)/30}%`}}>T</div><div className="phone-radar-label">LIVE DRONE / TARGET TRACKER</div></div>:<div className="phone-map" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const x=Math.round(((e.clientX-r.left)/r.width-.5)*3000);const z=Math.round(((e.clientY-r.top)/r.height-.5)*3000);setTarget({x,y:60,z})}}><div className="phone-map-home">H</div><div className="phone-map-target" style={{left:`${50+target.x/30}%`,top:`${50+target.z/30}%`}}>◆</div><div className="phone-map-drone" style={{left:`${50+Number(telemetry.x||0)/30}%`,top:`${50+Number(telemetry.z||0)/30}%`}}>D</div></div>}<div className="map-readout">{telemetry.status!=="READY"&&telemetry.status!=="DESTINATION SELECTED"?"D DRONE · T TARGET · H HOME":"Target: "+Math.round(target.x)+" m / "+Math.round(target.z)+" m"}</div><button className="confirm-target" onClick={selectTarget} disabled={confirmed}>✓ {confirmed?"DESTINATION LOCKED":"CONFIRM DESTINATION"}</button><small>Tap anywhere on the 3 km map before confirmation.</small></div>

  <div className="remote-card controller-card">
   <h3>TOUCH FLIGHT CONTROLLER</h3>
   <div className="joystick-wrap">
    <div className="joystick" ref={joystickRef} onPointerDown={startJoystick} onPointerMove={moveJoystick} onPointerUp={endJoystick} onPointerCancel={endJoystick} onPointerLeave={()=>{}} >
     <div className="joystick-ring"></div>
     <div className="joystick-center" style={{transform:`translate(calc(-50% + ${joystick.x*34}px),calc(-50% + ${joystick.y*34}px))`}}></div>
    </div>
   </div>
   <div className="joystick-labels"><span>← LEFT</span><span>FORWARD ↑</span><span>RIGHT →</span></div>
   <small className="mode-note">Press and drag the joystick. Release to hover. No separate altitude or yaw controls.</small>
  </div>

  <div className="remote-actions">
   <button className="takeoff" onClick={()=>send("START")}>TAKE OFF</button>
   <button className="land-button" onClick={()=>send("LAND")}>LAND</button>
   <button className="danger-button" onClick={()=>send("EMERGENCY")}>EMERGENCY AUTOPILOT</button>
   <button onClick={()=>send("GPS_TOGGLE")}>{telemetry.gps==="CONNECTED"?"SIMULATE GPS LOSS":"RESTORE GPS"}</button>
  </div>

  <div className="last-command">LAST COMMAND <b>{last}</b></div>
  <p className="hint">Phone controller → Socket.IO → Main Flight Controller → 3D simulator.</p>
 </div>
}
