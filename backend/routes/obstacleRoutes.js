import {Router} from "express"; import Obstacle from "../models/Obstacle.js";
const r=Router();
r.post("/",async(req,res)=>{try{res.status(201).json(await Obstacle.create(req.body))}catch(e){res.status(500).json({error:e.message})}});
r.get("/:missionId",async(req,res)=>{try{res.json(await Obstacle.find({missionId:req.params.missionId}))}catch(e){res.status(500).json({error:e.message})}});
export default r;
