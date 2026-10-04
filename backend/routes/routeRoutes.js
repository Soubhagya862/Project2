import {Router} from "express"; import {findPath} from "../utils/aStar3D.js";
const r=Router();
r.post("/calculate",(req,res)=>{const {start,goal,target,obstacles=[]}=req.body;const end=goal||target;const route=findPath(start,end,obstacles);res.json({success:route.length>0,route,waypoints:route.length})});
r.post("/replan",(req,res)=>{const {start,goal,target,obstacles=[]}=req.body;const end=goal||target;const route=findPath(start,end,obstacles);res.json({success:route.length>0,replanned:true,route,waypoints:route.length})});
export default r;
