import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import {createServer} from "http";
import {Server as SocketIOServer} from "socket.io";
import missionRoutes from "./routes/missionRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import telemetryRoutes from "./routes/telemetryRoutes.js";
import obstacleRoutes from "./routes/obstacleRoutes.js";

dotenv.config();
const app=express();
app.use(cors({origin:process.env.CLIENT_URL||"http://localhost:5173"}));
app.use(express.json());
app.get("/api/health",(req,res)=>res.json({ok:true,service:"NAVIGATE-X"}));
app.use("/api/missions",missionRoutes);
app.use("/api/routes",routeRoutes);
app.use("/api/telemetry",telemetryRoutes);
app.use("/api/obstacles",obstacleRoutes);

const port=process.env.PORT||5000;
if(process.env.MONGODB_URI){
 mongoose.connect(process.env.MONGODB_URI).then(()=>console.log("MongoDB connected")).catch(e=>console.error("MongoDB:",e.message));
}
app.listen(port,()=>console.log(`NAVIGATE-X backend running on http://localhost:${port}`));
