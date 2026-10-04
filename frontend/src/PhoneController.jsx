import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";
import "./phone.css";
const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";
export default function PhoneController(){
 const socketRef=useRef(null);
 const [connected,setConnected]=useState(false),[last,setLast]=useState("STOP");
 const [target,setTarget]=useState({x:65,y:12,z:0});
 const [telemetry,setTelemetry]=useState({x:0,y:10,z:0,speed:0,heading:0,gps:"CONNECTED",status:"WAITING",target:{x:65,y:12,z:0}});
 useEffect(()=>{const s=io(SOCKET_URL);socketRef.current=s;s.on("connect",()=>setConnected(true));s.on("disconnect",()=>setConnected(false));s.on("phone-telemetry",d=>{setTelemetry(d||{});if(d?.target)setTarget(d.target)});return()=>s.disconnect()},[]);
 function send(c){setLast(c);socketRef.current?.emit("phone-control",c)}
 function selectTarget(e){const x=Number(e.target.value);setTarget(t=>({...t,x}))}
 return <div className="phone-controller">
  <div className="remote-header"><div><h1>NAVIGATE-X</h1><p>FLIGHT REMOTE</p></div><span className={connected?"ok":"danger"}>● {connected?"LINKED":"OFFLINE"}</span></div>
  <div className="remote-card"><div className="remote-status"><b>{telemetry.status}</b><span className={telemetry.gps==="CONNECTED"?"ok":"danger"}>GPS {telemetry.gps}</span></div><div className="remote-telemetry"><div>X<b>{Number(telemetry.x||0).toFixed(1)}</b></div><div>ALT<b>{Number(telemetry.y||0).toFixed(1)}</b></div><div>Z<b>{Number(telemetry.z||0).toFixed(1)}</b></div><div>SPD<b>{Number(telemetry.speed||0).toFixed(1)}</b></div><div>HDG<b>{Number(telemetry.heading||0).toFixed(0)}°</b></div></div></div>
  <div className="remote-card target-select"><h3>SELECT TARGET LOCATION</h3><div className="phone-coords"><label>X<input value={target.x} onChange={selectTarget}/></label><label>ALT<input type="number" value={target.y} onChange={e=>setTarget(t=>({...t,y:Number(e.target.value)}))}/></label><label>Z<input type="number" value={target.z} onChange={e=>setTarget(t=>({...t,z:Number(e.target.value)}))}/></label></div><button className="takeoff" onClick={()=>{setLast("DESTINATION_SELECTED");send("TARGET:"+JSON.stringify(target))}}>✓ CHOOSE DESTINATION</button><small>Target: {target.x}, {target.y}, {target.z}</small></div>
  <div className="remote-card"><h3>ADVANCED FLIGHT CONTROL</h3><div className="remote-dpad"><button onClick={()=>send("UP_LEFT")}>↖</button><button onClick={()=>send("UP")}>↑</button><button onClick={()=>send("UP_RIGHT")}>↗</button><button onClick={()=>send("LEFT")}>←</button><button className="stop" onClick={()=>send("STOP")}>■</button><button onClick={()=>send("RIGHT")}>→</button><button onClick={()=>send("DOWN_LEFT")}>↙</button><button onClick={()=>send("DOWN")}>↓</button><button onClick={()=>send("DOWN_RIGHT")}>↘</button></div></div>
  <div className="remote-card"><p className="hint">1. Choose destination above → 2. Start takeoff. The simulator will not launch before a destination is selected.</p></div><div className="remote-actions"><button className="takeoff" onClick={()=>send("START")}>TAKEOFF / START</button><button className="danger-button" onClick={()=>send("EMERGENCY")}>EMERGENCY AUTOPILOT</button><button onClick={()=>send("GPS_TOGGLE")}>GPS ON / OFF</button></div>
  <div className="last-command">LAST COMMAND <b>{last}</b></div><p className="hint">Keep phone and simulator on the same Wi-Fi network.</p>
 </div>
}
