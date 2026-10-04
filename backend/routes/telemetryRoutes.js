import {Router} from "express";
import mongoose from "mongoose";
import Telemetry from "../models/Telemetry.js";

const r=Router();

r.post("/",async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.body.missionId)) return res.status(400).json({error:"Invalid missionId"});
    const t=await Telemetry.create(req.body);
    res.status(201).json(t);
  }catch(e){res.status(400).json({error:e.message});}
});

r.get("/:missionId",async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.missionId)) return res.status(400).json({error:"Invalid missionId"});
    res.json(await Telemetry.find({missionId:req.params.missionId}).sort({timestamp:-1}).limit(500));
  }catch(e){res.status(500).json({error:e.message});}
});

export default r;
