import {Router} from "express";
import mongoose from "mongoose";
import Obstacle from "../models/Obstacle.js";

const r=Router();

r.post("/",async(req,res)=>{
  try{
    if(req.body.missionId && !mongoose.isValidObjectId(req.body.missionId)) return res.status(400).json({error:"Invalid missionId"});
    const o=await Obstacle.create(req.body);
    res.status(201).json(o);
  }catch(e){res.status(400).json({error:e.message});}
});

r.get("/:missionId",async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.missionId)) return res.status(400).json({error:"Invalid missionId"});
    res.json(await Obstacle.find({missionId:req.params.missionId}).sort({detectedAt:1}));
  }catch(e){res.status(500).json({error:e.message});}
});

export default r;
