const key=p=>`${p.x},${p.y},${p.z}`;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

const dirs=[];
for(let x=-1;x<=1;x++){
  for(let y=-1;y<=1;y++){
    for(let z=-1;z<=1;z++){
      if(x||y||z) dirs.push([x,y,z]);
    }
  }
}

export function findPath(
  start,
  goal,
  obstacles=[],
  bounds={minX:-1500,maxX:1500,minY:5,maxY:300,minZ:-1500,maxZ:1500},
  margin=25,
  step=30
){
  const blocked=p=>obstacles.some(o=>{
    const pos=o.position||{x:0,y:0,z:0};
    const size=o.size||{x:1,y:1,z:1};
    return Math.abs(p.x-pos.x)<=size.x/2+margin &&
           Math.abs(p.y-pos.y)<=size.y/2+margin &&
           Math.abs(p.z-pos.z)<=size.z/2+margin;
  });

  const s={
    x:Math.min(bounds.maxX,Math.max(bounds.minX,Math.round(Number(start.x)||0))),
    y:Math.min(bounds.maxY,Math.max(bounds.minY,Math.round(Number(start.y)||0))),
    z:Math.min(bounds.maxZ,Math.max(bounds.minZ,Math.round(Number(start.z)||0)))
  };
  const g={
    x:Math.min(bounds.maxX,Math.max(bounds.minX,Math.round(Number(goal.x)||0))),
    y:Math.min(bounds.maxY,Math.max(bounds.minY,Math.round(Number(goal.y)||0))),
    z:Math.min(bounds.maxZ,Math.max(bounds.minZ,Math.round(Number(goal.z)||0)))
  };

  if(blocked(s)||blocked(g)) return [];

  const stepSize=Math.max(1,Number(step)||20);
  const open=[s];
  const openKeys=new Set([key(s)]);
  const came=new Map();
  const gScore=new Map([[key(s),0]]);
  const fScore=new Map([[key(s),distance(s,g)]]);
  const maxIterations=120000;
  let iterations=0;

  while(open.length && iterations++<maxIterations){
    open.sort((a,b)=>(fScore.get(key(a))??Infinity)-(fScore.get(key(b))??Infinity));
    const cur=open.shift();
    openKeys.delete(key(cur));

    if(key(cur)===key(g)){
      const path=[cur];
      let k=key(cur);
      while(came.has(k)){
        const p=came.get(k);
        path.push(p);
        k=key(p);
      }
      return path.reverse();
    }

    for(const [dx,dy,dz] of dirs){
      const n={x:cur.x+dx*stepSize,y:cur.y+dy*stepSize,z:cur.z+dz*stepSize};
      if(
        n.x<bounds.minX||n.x>bounds.maxX||
        n.y<bounds.minY||n.y>bounds.maxY||
        n.z<bounds.minZ||n.z>bounds.maxZ||
        blocked(n)
      ) continue;

      const nk=key(n);
      const stepCost=stepSize*Math.hypot(dx,dy,dz);
      const tentative=(gScore.get(key(cur))??Infinity)+stepCost;

      if(tentative<(gScore.get(nk)??Infinity)){
        came.set(nk,cur);
        gScore.set(nk,tentative);
        fScore.set(nk,tentative+distance(n,g));
        if(!openKeys.has(nk)){
          open.push(n);
          openKeys.add(nk);
        }
      }
    }
  }

  return [];
}
