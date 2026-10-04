export default function MissionMonitor({status,phase,gps,waypoints,missionId,phoneCommand,phoneConnected,sensor}){
  return <div className="panel">
    <h3>MISSION MONITOR</h3>
    <p><b>Status:</b> {status}</p>
    <p><b>Phase:</b> {phase}</p>
    <p><b>GPS:</b> <span className={gps?"ok":"danger"}>{gps?"CONNECTED":"DENIED"}</span></p>
    <p><b>Sensor:</b> <span className={sensor?"danger":"ok"}>{sensor?"OBSTACLE DETECTED":"CLEAR"}</span></p>
    <p><b>Phone:</b> <span className={phoneConnected?"ok":"danger"}>{phoneConnected?"LINKED":"OFFLINE"}</span></p>
    <p><b>Last phone command:</b> {phoneCommand}</p>
    <p><b>Route:</b> {waypoints} waypoints</p>
    <p><b>Mission:</b> {missionId||"Not created"}</p>
  </div>;
}
