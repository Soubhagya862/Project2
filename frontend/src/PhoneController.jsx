import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";

const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";

export default function PhoneController(){
 const socketRef=useRef(null);
 const [connected,setConnected]=useState(false);
 const [last,setLast]=useState("STOP");
 const [telemetry,setTelemetry]=useState({x:0,y:2,z:0,speed:0,gps:"CONNECTED",status:"READY"});

 useEffect(()=>{
  const socket=io(SOCKET_URL);
  socketRef.current=socket;
  socket.on("connect",()=>setConnected(true));
  socket.on("disconnect",()=>setConnected(false));
  socket.on("phone-telemetry",data=>setTelemetry(t=>({...t,...data})));
  return()=>socket.disconnect();
 },[]);

 function send(command){
  setLast(command);
  socketRef.current?.emit("phone-control",command);
 }

 return <div className="phone-controller">
  <h1>NAVIGATE-X</h1>
  <p>PHONE CONTROLLER</p>
  <div className={connected?"ok":"danger"}>● {connected?"CONNECTED":"DISCONNECTED"}</div>

  <div className="panel">
   <h3>LIVE DEVICE</h3>
   <p>Position: {telemetry.x?.toFixed?.(1)??0}, {telemetry.y?.toFixed?.(1)??0}, {telemetry.z?.toFixed?.(1)??0}</p>
   <p>Speed: {telemetry.speed??0} m/s</p>
   <p>GPS: {telemetry.gps||"CONNECTED"}</p>
   <p>Status: {telemetry.status||"READY"}</p>
  </div>

  <div className="joystick">
   <button onClick={()=>send("UP")}>▲</button>
   <div><button onClick={()=>send("LEFT")}>◀</button><button className="stop" onClick={()=>send("STOP")}>■</button><button onClick={()=>send("RIGHT")}>▶</button></div>
   <button onClick={()=>send("DOWN")}>▼</button>
  </div>

  <div className="phone-actions">
   <button onClick={()=>send("START")}>START</button>
   <button className="warn" onClick={()=>send("EMERGENCY")}>EMERGENCY</button>
   <button onClick={()=>send("GPS_TOGGLE")}>GPS ON/OFF</button>
  </div>
  <p>Last command: <b>{last}</b></p>
 </div>;
}