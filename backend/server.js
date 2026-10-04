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
const httpServer=createServer(app);
const io=new SocketIOServer(httpServer,{
  cors:{origin:"*",methods:["GET","POST","PATCH"]}
});

io.on("connection",socket=>{
  socket.emit("server-ready",{service:"NAVIGATE-X",connectedAt:Date.now()});
  socket.on("drone-command",data=>{
    if(typeof data==="string") io.emit("drone-command",data);
  });
  socket.on("phone-control",data=>{
    if(typeof data==="string") io.emit("drone-command",data);
  });
  socket.on("phone-telemetry",data=>{
    socket.broadcast.emit("phone-telemetry",data);
  });
  socket.on("disconnect",()=>{});
});

app.use(cors({origin:process.env.CLIENT_URL||"*"}));
app.use(express.json({limit:"1mb"}));

app.get("/api/health",(req,res)=>res.json({
  ok:true,
  service:"NAVIGATE-X",
  mongodb:mongoose.connection.readyState===1,
  time:new Date().toISOString()
}));

app.use("/api/missions",missionRoutes);
app.use("/api/routes",routeRoutes);
app.use("/api/telemetry",telemetryRoutes);
app.use("/api/obstacles",obstacleRoutes);

app.use((req,res)=>res.status(404).json({error:"API route not found"}));
app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:"Internal server error"});
});

const port=process.env.PORT||5000;

if(process.env.MONGODB_URI){
  mongoose.connect(process.env.MONGODB_URI)
    .then(()=>console.log("MongoDB connected"))
    .catch(e=>console.error("MongoDB:",e.message));
}else{
  console.log("MONGODB_URI not set — simulation can run without database persistence.");
}

httpServer.listen(port,"0.0.0.0",()=>console.log(`NAVIGATE-X backend running on port ${port} (LAN enabled)`));
