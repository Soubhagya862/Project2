import {Router} from "express"; import Mission from "../models/Mission.js";
const r=Router();
r.post("/",async(req,res)=>{try{const m=await Mission.create(req.body);res.status(201).json(m)}catch(e){res.status(500).json({error:e.message})}});
r.get("/",async(req,res)=>{try{res.json(await Mission.find().sort({createdAt:-1}).limit(50))}catch(e){res.status(500).json({error:e.message})}});
r.get("/:id",async(req,res)=>{try{res.json(await Mission.findById(req.params.id))}catch(e){res.status(404).json({error:e.message})}});
r.patch("/:id",async(req,res)=>{try{res.json(await Mission.findByIdAndUpdate(req.params.id,req.body,{new:true}))}catch(e){res.status(500).json({error:e.message})}});
export default r;
