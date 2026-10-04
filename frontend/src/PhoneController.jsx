import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";

const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";

export default function PhoneController(){
  const socketRef=useRef(null);
  const [connected,setConnected]=useState(false);
  const [last,setLast]=useState("STOP");
  const [telemetry,setTelemetry]=useState({
    x:0,y:0,z:0,speed:0,heading:0,gps:"CONNECTED",status:"WAITING"
  });

  useEffect(()=>{
    const socket=io(SOCKET_URL);
    socketRef.current=socket;
    socket.on("connect",()=>setConnected(true));
    socket.on("disconnect",()=>setConnected(false));
    socket.on("phone-telemetry",data=>setTelemetry(data||{}));
    return()=>socket.disconnect();
  },[]);

  function send(command){
    setLast(command);
    socketRef.current?.emit("phone-control",command);
  }

  return <div className="phone-controller">
    <h1>NAVIGATE-X</h1>
    <p>REMOTE MISSION CONTROLLER</p>
    <div className={connected?"ok":"danger"}>● {connected?"CONNECTED":"DISCONNECTED"}</div>

    <div className="phone-status">
      <b>{telemetry.status}</b>
      <span className={telemetry.gps==="CONNECTED"?"ok":"danger"}>
        GPS {telemetry.gps||"UNKNOWN"}
      </span>
    </div>

    <div className="phone-telemetry">
      <div>X <b>{Number(telemetry.x||0).toFixed(1)}</b></div>
      <div>Y <b>{Number(telemetry.y||0).toFixed(1)}</b></div>
      <div>Z <b>{Number(telemetry.z||0).toFixed(1)}</b></div>
      <div>SPD <b>{Number(telemetry.speed||0).toFixed(1)}</b></div>
      <div>HDG <b>{Number(telemetry.heading||0).toFixed(0)}°</b></div>
    </div>

    <div className="joystick">
      <button onClick={()=>send("UP")}>▲</button>
      <div>
        <button onClick={()=>send("LEFT")}>◀</button>
        <button className="stop" onClick={()=>send("STOP")}>■</button>
        <button onClick={()=>send("RIGHT")}>▶</button>
      </div>
      <button onClick={()=>send("DOWN")}>▼</button>
    </div>

    <div className="phone-actions">
      <button onClick={()=>send("START")}>START MISSION</button>
      <button className="danger-button" onClick={()=>send("EMERGENCY")}>EMERGENCY AUTOPILOT</button>
      <button onClick={()=>send("GPS_TOGGLE")}>GPS ON / OFF</button>
    </div>

    <p>Last command: <b>{last}</b></p>
    <p className="hint">Keep the phone and computer on the same Wi-Fi network.</p>
  </div>;
}
