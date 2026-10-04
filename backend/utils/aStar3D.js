const key=p=>`${p.x},${p.y},${p.z}`;
const h=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z);
const dirs=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
export function findPath(start,goal,obstacles=[],bounds={minX:0,maxX:80,minY:0,maxY:40,minZ:-40,maxZ:40},margin=2){
 const blocked=p=>obstacles.some(o=>Math.abs(p.x-o.position.x)<=o.size.x/2+margin&&Math.abs(p.y-o.position.y)<=o.size.y/2+margin&&Math.abs(p.z-o.position.z)<=o.size.z/2+margin);
 const s={x:Math.round(start.x),y:Math.round(start.y),z:Math.round(start.z)},g={x:Math.round(goal.x),y:Math.round(goal.y),z:Math.round(goal.z)};
 const open=[s],came=new Map(),gScore=new Map([[key(s),0]]),fScore=new Map([[key(s),h(s,g)]]);
 while(open.length){
  open.sort((a,b)=>(fScore.get(key(a))??Infinity)-(fScore.get(key(b))??Infinity));
  const cur=open.shift(); if(key(cur)===key(g)){const path=[cur];let k=key(cur);while(came.has(k)){const p=came.get(k);path.push(p);k=key(p)}return path.reverse()}
  for(const d of dirs){const n={x:cur.x+d[0],y:cur.y+d[1],z:cur.z+d[2]};
   if(n.x<bounds.minX||n.x>bounds.maxX||n.y<bounds.minY||n.y>bounds.maxY||n.z<bounds.minZ||n.z>bounds.maxZ||blocked(n))continue;
   const nk=key(n),tent=(gScore.get(key(cur))??Infinity)+1;
   if(tent<(gScore.get(nk)??Infinity)){came.set(nk,cur);gScore.set(nk,tent);fScore.set(nk,tent+h(n,g));if(!open.some(p=>key(p)===nk))open.push(n)}
  }
 }
 return [];
}