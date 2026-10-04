import {useRef,useState} from "react";
import {useFrame} from "@react-three/fiber";
import {Line} from "@react-three/drei";

const DIRECTIONS=[
  {name:"FRONT",v:{x:1,y:0,z:0}},
  {name:"BACK",v:{x:-1,y:0,z:0}},
  {name:"LEFT",v:{x:0,y:0,z:-1}},
  {name:"RIGHT",v:{x:0,y:0,z:1}},
  {name:"UP",v:{x:0,y:1,z:0}},
  {name:"DOWN",v:{x:0,y:-1,z:0}}
];

function rayBox(origin,dir,o,maxDistance){
  const min={x:o.position.x-o.size.x/2,y:o.position.y-o.size.y/2,z:o.position.z-o.size.z/2};
  const max={x:o.position.x+o.size.x/2,y:o.position.y+o.size.y/2,z:o.position.z+o.size.z/2};
  let tMin=0,tMax=maxDistance;

  for(const axis of ["x","y","z"]){
    if(Math.abs(dir[axis])<1e-9){
      if(origin[axis]<min[axis]||origin[axis]>max[axis]) return null;
      continue;
    }
    const a=(min[axis]-origin[axis])/dir[axis];
    const b=(max[axis]-origin[axis])/dir[axis];
    const near=Math.min(a,b),far=Math.max(a,b);
    tMin=Math.max(tMin,near);
    tMax=Math.min(tMax,far);
    if(tMin>tMax) return null;
  }
  return tMin>=0&&tMin<=maxDistance?tMin:null;
}

export default function DroneSensors({position,obstacles=[],range=12,onDetection}){
  const [hits,setHits]=useState({});
  const lastReport=useRef(0);
  const scan=useRef({});
  
  useFrame((state)=>{
    const next={};
    for(const sensor of DIRECTIONS){
      let nearest=range;
      for(const obstacle of obstacles){
        const hit=rayBox(position,sensor.v,obstacle,range);
        if(hit!==null) nearest=Math.min(nearest,hit);
      }
      next[sensor.name]=nearest;
    }
    scan.current=next;
    if(state.clock.elapsedTime-lastReport.current>0.2){
      lastReport.current=state.clock.elapsedTime;
      setHits({...next});
      const front=next.FRONT;
      const detected=Object.values(next).some(v=>v<4);
      onDetection?.({detected,distance:front,readings:next});
    }
  });

  return <group position={[position.x,position.y,position.z]}>
    {lines.map((line,i)=>{
      const sensor=DIRECTIONS[i];
      const hit=hits[sensor.name]??range;
      const length=Math.max(0.5,Math.min(range,hit));
      return <Line
        key={sensor.name}
        points={[[0,0,0],[sensor.v.x*length,sensor.v.y*length,sensor.v.z*length]]}
        lineWidth={hit<4?4:1.5}
      />;
    })}
  </group>;
}
