import mongoose from "mongoose";

const telemetrySchema=new mongoose.Schema({
  missionId:{type:mongoose.Schema.Types.ObjectId,ref:"Mission",required:true,index:true},
  position:{
    x:{type:Number,required:true},
    y:{type:Number,required:true},
    z:{type:Number,required:true}
  },
  altitude:Number,
  speed:Number,
  heading:Number,
  gpsStatus:String,
  obstacleDetected:Boolean,
  sensorDistance:Number,
  timestamp:{type:Date,default:Date.now,index:true}
});

export default mongoose.model("Telemetry",telemetrySchema);
