import {Router} from "express";
import mongoose from "mongoose";
import Mission from "../models/Mission.js";

const r=Router();

function validPoint(p){
  return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && Number.isFinite(Number(p.z));
}

r.post("/",async(req,res)=>{
  try{
    const {start,target,route=[]}=req.body;
    if(!validPoint(start)||!validPoint(target)) return res.status(400).json({error:"start and target must contain numeric x, y and z"});
    const m=await Mission.create({...req.body,start,target,route});
    res.status(201).json(m);
  }catch(e){res.status(400).json({error:e.message});}
});

r.get("/",async(req,res)=>{
  try{res.json(await Mission.find().sort({createdAt:-1}).limit(50));}
  catch(e){res.status(500).json({error:e.message});}
});

r.get("/:id",async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:"Invalid mission id"});
    const m=await Mission.findById(req.params.id);
    if(!m) return res.status(404).json({error:"Mission not found"});
    res.json(m);
  }catch(e){res.status(500).json({error:e.message});}
});

r.patch("/:id",async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:"Invalid mission id"});
    const m=await Mission.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});
    if(!m) return res.status(404).json({error:"Mission not found"});
    if(req.body.status==="MISSION COMPLETE" && !m.completedAt) m.completedAt=new Date();
    await m.save();
    res.json(m);
  }catch(e){res.status(400).json({error:e.message});}
});

r.post("/:id/start",async(req,res)=>{
  try{
    const m=await Mission.findByIdAndUpdate(req.params.id,
      {status:req.body?.status||"AUTONOMOUS",phase:req.body?.phase||"NAVIGATING",startedAt:new Date()},
      {new:true,runValidators:true});
    if(!m) return res.status(404).json({error:"Mission not found"});
    res.json(m);
  }catch(e){res.status(400).json({error:e.message});}
});

r.post("/:id/stop",async(req,res)=>{
  try{
    const m=await Mission.findByIdAndUpdate(req.params.id,
      {status:"STOPPED",phase:"MANUAL"},
      {new:true});
    if(!m) return res.status(404).json({error:"Mission not found"});
    res.json(m);
  }catch(e){res.status(400).json({error:e.message});}
});

r.post("/:id/gps/disconnect",async(req,res)=>{
  try{
    const m=await Mission.findByIdAndUpdate(req.params.id,
      {gpsStatus:"DENIED",status:"EMERGENCY AUTOPILOT",phase:"GPS DENIED"},
      {new:true});
    if(!m) return res.status(404).json({error:"Mission not found"});
    res.json(m);
  }catch(e){res.status(400).json({error:e.message});}
});

r.post("/:id/gps/restore",async(req,res)=>{
  try{
    const m=await Mission.findByIdAndUpdate(req.params.id,
      {gpsStatus:"CONNECTED",status:"READY",phase:"GPS RESTORED"},
      {new:true});
    if(!m) return res.status(404).json({error:"Mission not found"});
    res.json(m);
  }catch(e){res.status(400).json({error:e.message});}
});

export default r;
