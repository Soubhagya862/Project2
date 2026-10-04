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

const connectedClients=new Map();
let latestFlightCommand={id:0,command:"HOVER",time:Date.now()};

io.on("connection",socket=>{
  connectedClients.set(socket.id,{role:"unknown"});

  socket.emit("server-ready",{service:"NAVIGATE-X",connectedAt:Date.now()});

  socket.on("register-client",({role}={})=>{
    if(role!=="phone"&&role!=="simulator")return;

    connectedClients.set(socket.id,{role});
    io.emit("client-status",{role,connected:true});
  });

  socket.on("phone-control",data=>{
    const sender=connectedClients.get(socket.id);
    if(sender?.role!=="phone"||typeof data!=="string"||!data.trim())return;
    latestFlightCommand={id:latestFlightCommand.id+1,command:data.trim(),time:Date.now()};
    for(const [id,client] of connectedClients){
      if(client.role==="simulator")io.to(id).emit("flight-control-command",latestFlightCommand);
    }
  });

  socket.on("phone-telemetry",data=>{
    socket.broadcast.emit("phone-telemetry",data);
  });

  socket.on("disconnect",()=>{
    const client=connectedClients.get(socket.id);

    if(client?.role&&client.role!=="unknown"){
      io.emit("client-status",{
        role:client.role,
        connected:false
      });
    }

    connectedClients.delete(socket.id);
  });
});

app.use(cors({origin:process.env.CLIENT_URL||"*"}));
app.use(express.json({limit:"1mb"}));

app.post("/api/flight-command",(req,res)=>{
  const command=typeof req.body?.command==="string"?req.body.command:"";
  if(!command)return res.status(400).json({ok:false,error:"command required"});
  latestFlightCommand={id:latestFlightCommand.id+1,command,time:Date.now()};
  io.emit("flight-control-command",latestFlightCommand);
  res.json({ok:true,...latestFlightCommand});
});

app.get("/api/flight-command",(req,res)=>res.json({ok:true,...latestFlightCommand}));

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

httpServer.listen(
  port,
  "0.0.0.0",
  ()=>console.log(`NAVIGATE-X backend running on port ${port} (LAN enabled)`)
);
