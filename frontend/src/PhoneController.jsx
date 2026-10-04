import {useEffect,useRef,useState} from "react";
import {io} from "socket.io-client";

const SOCKET_URL=import.meta.env.VITE_SOCKET_URL||"http://localhost:5000";

export default function PhoneController(){
 const socketRef=useRef(null);
 const [connected,setConnected]=useState(false);
 const [last,setLast]=useState("STOP");

 useEffect(()=>{
  const socket=io(SOCKET_URL);
  socketRef.current=socket;
  socket.on("connect",()=>setConnected(true));
  socket.on("disconnect",()=>setConnected(false));
  return()=>socket.disconnect();
 },[]);

 function send(command){
  setLast(command);
  if(socketRef.current) socketRef.current.emit("phone-control",command);
 }

 return <div className="phone-controller"><h1>NAVIGATE-X</h1><p>PHONE CONTROLLER</p><div className={connected?"ok":"danger"}>● {connected?"CONNECTED":"DISCONNECTED"}</div><div className="joystick"><button onClick={()=>send("UP")}>▲</button><div><button onClick={()=>send("LEFT")}>◀</button><button className="stop" onClick={()=>send("STOP")}>■</button><button onClick={()=>send("RIGHT")}>▶</button></div><button onClick={()=>send("DOWN")}>▼</button></div><div className="phone-actions"><button onClick={()=>send("START")}>START</button><button onClick={()=>send("EMERGENCY")}>EMERGENCY</button><button onClick={()=>send("GPS_TOGGLE")}>GPS ON/OFF</button></div><p>Last command: <b>{last}</b></p></div>;
}