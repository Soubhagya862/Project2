import {useState} from "react";
export default function PhoneController(){
 const [connected,setConnected]=useState(false);
 const [last,setLast]=useState("STOP");
 function send(command){setLast(command);if(window.opener)window.opener.postMessage({type:"NAVIGATE_X_PHONE",command},"*");}
 return <div className="phone-controller"><h1>NAVIGATE-X</h1><p>PHONE CONTROLLER</p><div className={connected?"ok":"danger"}>● {connected?"CONNECTED":"LOCAL CONTROL MODE"}</div><div className="joystick"><button onClick={()=>send("UP")}>▲</button><div><button onClick={()=>send("LEFT")}>◀</button><button className="stop" onClick={()=>send("STOP")}>■</button><button onClick={()=>send("RIGHT")}>▶</button></div><button onClick={()=>send("DOWN")}>▼</button></div><div className="phone-actions"><button onClick={()=>send("START")}>START</button><button onClick={()=>send("EMERGENCY")}>EMERGENCY</button><button onClick={()=>send("GPS_TOGGLE")}>GPS ON/OFF</button></div><p>Last command: <b>{last}</b></p></div>
}