import {Router} from "express"; import Telemetry from "../models/Telemetry.js";
const r=Router();
r.post("/",async(req,res)=>{try{res.status(201).json(await Telemetry.create(req.body))}catch(e){res.status(500).json({error:e.message})}});
r.get("/:missionId",async(req,res)=>{try{res.json(await Telemetry.find({missionId:req.params.missionId}).sort({timestamp:-1}).limit(500))}catch(e){res.status(500).json({error:e.message})}});
export default r;
