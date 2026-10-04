export default function TelemetryPanel({data}){
  return <div className="panel">
    <h3>LIVE TELEMETRY</h3>
    <div className="telemetry-grid">
      <span>X <b>{data.x.toFixed(1)}</b></span>
      <span>Y <b>{data.y.toFixed(1)}</b></span>
      <span>Z <b>{data.z.toFixed(1)}</b></span>
      <span>ALT <b>{data.altitude.toFixed(1)} m</b></span>
      <span>SPEED <b>{data.speed.toFixed(1)} m/s</b></span>
      <span>HEADING <b>{data.heading.toFixed(0)}°</b></span>
      <span>DIST <b>{data.distance.toFixed(1)} m</b></span>
      <span>SENSOR <b>{data.sensorDistance.toFixed(1)} m</b></span>
    </div>
  </div>;
}
