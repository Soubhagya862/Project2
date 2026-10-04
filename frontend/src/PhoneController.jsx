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
 const [connected,setConnected]=useState(false);
 const [last,setLast]=useState("STOP");
 const [confirmed,setConfirmed]=useState(false);
 const [target,setTarget]=useState({x:700,y:60,z:450});
 const [telemetry,setTelemetry]=useState({x:0,y:12,z:0,speed:0,heading:0,gps:"CONNECTED",status:"READY",phase:"IDLE",mode:"MANUAL",target:{x:65,y:16,z:0},distanceToTarget:0,sensorDistance:18});

 useEffect(()=>{
  const s=io(SOCKET_URL);socketRef.current=s;
  s.on("connect",()=>setConnected(true));
  s.on("disconnect",()=>setConnected(false));
  s.on("phone-telemetry",d=>{if(!d)return;setTelemetry(d);if(d.target){setTarget(d.target);if(d.status&&d.status!=="READY")setConfirmed(true)}});
  return()=>s.disconnect();
 },[]);

 function send(command){
  setLast(command);
  if(socketRef.current?.connected){socketRef.current.emit("drone-command",command)}else{setLast("OFFLINE")}
}

 function selectTarget(){
  const safe={x:Number(target.x)||0,y:Math.max(5,Number(target.y)||30),z:Number(target.z)||0};
  setTarget(safe);setConfirmed(true);setLast("TARGET");
  socketRef.current?.emit("target-sync",safe);
  socketRef.current?.emit("phone-control","TARGET:"+JSON.stringify(safe));
 }

 return <div className="phone-controller">
  <div className="remote-header"><div><h1>NAVIGATE-X</h1><p>PHONE → MAIN FLIGHT CONTROLLER</p></div><span className={connected?"ok":"danger"}>● {connected?"LINKED":"OFFLINE"}</span></div>

  <div className="remote-card live-card">
   <div className="remote-status"><b>{telemetry.status}</b><span className={telemetry.gps==="CONNECTED"?"ok":"danger"}>GPS {telemetry.gps}</span></div>
   <div className="mode-live">MODE <b>{telemetry.mode||"MANUAL"}</b></div>
   <div className="remote-telemetry">
    <div>X<b>{Number(telemetry.x||0).toFixed(1)}</b></div><div>ALT<b>{Number(telemetry.y||0).toFixed(1)}m</b></div><div>Z<b>{Number(telemetry.z||0).toFixed(1)}</b></div><div>SPD<b>{Number(telemetry.speed||0).toFixed(1)}</b></div><div>HDG<b>{Number(telemetry.heading||0).toFixed(0)}°</b></div>
   </div>
   <div className="remote-telemetry extra"><div>DIST<b>{Number(telemetry.distanceToTarget||0).toFixed(1)}m</b></div><div>SENSOR<b>{Number(telemetry.sensorDistance||0).toFixed(1)}m</b></div><div>PHASE<b>{telemetry.phase||"IDLE"}</b></div></div>
  </div>

  <div className="remote-card target-select"><h3>3 KM LIVE MAP · CHOOSE DESTINATION</h3>{confirmed?<div className="phone-radar"><div className="phone-radar-sweep"></div><div className="phone-radar-ring r1"></div><div className="phone-radar-ring r2"></div><div className="phone-radar-cross cx"></div><div className="phone-radar-cross cz"></div><div className="phone-radar-point phone-home-point" style={{left:"50%",top:"50%"}}>H</div><div className="phone-radar-point phone-drone-point" style={{left:`${50+Number(telemetry.x||0)/30}%`,top:`${50+Number(telemetry.z||0)/30}%`}}>D</div><div className="phone-radar-point phone-target-point" style={{left:`${50+Number(target.x||0)/30}%`,top:`${50+Number(target.z||0)/30}%`}}>T</div><div className="phone-radar-label">LIVE DRONE / TARGET TRACKER</div></div>:<div className="phone-map" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const x=Math.round(((e.clientX-r.left)/r.width-.5)*3000);const z=Math.round(((e.clientY-r.top)/r.height-.5)*3000);setTarget({x,y:60,z})}}><div className="phone-map-home">H</div><div className="phone-map-target" style={{left:`${50+target.x/30}%`,top:`${50+target.z/30}%`}}>◆</div><div className="phone-map-drone" style={{left:`${50+Number(telemetry.x||0)/30}%`,top:`${50+Number(telemetry.z||0)/30}%`}}>D</div></div>}<div className="map-readout">{telemetry.status!=="READY"&&telemetry.status!=="DESTINATION SELECTED"?"D DRONE · T TARGET · H HOME":"Target: "+Math.round(target.x)+" m / "+Math.round(target.z)+" m"}</div><button className="takeoff" onClick={selectTarget} disabled={confirmed}>✓ {confirmed?"DESTINATION LOCKED":"CONFIRM DESTINATION"}</button><small>Tap anywhere on the 3 km map before confirmation. After confirmation it becomes a live radar tracker.</small></div>
  <div className="remote-card">
   <h3>FULL FLIGHT CONTROL</h3>
   <div className="remote-dpad"><button onClick={()=>send("UP_LEFT")}>↖</button><button onClick={()=>send("UP")}>↑ FWD</button><button onClick={()=>send("UP_RIGHT")}>↗</button><button onClick={()=>send("LEFT")}>←</button><button className="stop" onClick={()=>send("STOP")}>■ STOP</button><button onClick={()=>send("RIGHT")}>→</button><button onClick={()=>send("DOWN_LEFT")}>↙</button><button onClick={()=>send("DOWN")}>↓ BACK</button><button onClick={()=>send("DOWN_RIGHT")}>↘</button></div>
   <div className="alt-controls"><button onClick={()=>send("ASCEND")}>▲ ALTITUDE</button><button onClick={()=>send("YAW_LEFT")}>↶ YAW LEFT</button><button onClick={()=>send("YAW_RIGHT")}>YAW RIGHT ↷</button><button onClick={()=>send("DESCEND")}>▼ ALTITUDE</button></div>
   <small className="mode-note">Every button sends a real-time command to the 3D simulator. TAKE OFF first, then fly with direction, altitude and yaw controls.</small>
  </div>

  <div className="remote-actions">
   <button className="takeoff" onClick={()=>send("START")}>TAKE OFF</button>
   <button className="danger-button" onClick={()=>send("EMERGENCY")}>EMERGENCY AUTOPILOT</button>
   <button onClick={()=>send("GPS_TOGGLE")}>{telemetry.gps==="CONNECTED"?"SIMULATE GPS LOSS":"RESTORE GPS"}</button>
   <button onClick={()=>send("LAND")}>LAND</button>
  </div>

  <div className="last-command">LAST COMMAND <b>{last}</b></div>
  <p className="hint">The phone monitor receives live telemetry from the simulator through Socket.IO.</p>
 </div>
}
