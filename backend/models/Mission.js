import mongoose from "mongoose";

const point=new mongoose.Schema({
  x:{type:Number,required:true},
  y:{type:Number,required:true},
  z:{type:Number,required:true}
},{_id:false});

const missionSchema=new mongoose.Schema({
  start:point,
  target:point,
  route:[point],
  gpsStatus:{type:String,enum:["CONNECTED","DENIED"],default:"CONNECTED"},
  status:{type:String,default:"READY"},
  phase:{type:String,default:"IDLE"},
  startedAt:Date,
  createdAt:{type:Date,default:Date.now},
  completedAt:Date
});

export default mongoose.model("Mission",missionSchema);
