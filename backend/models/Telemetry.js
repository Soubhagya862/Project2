import mongoose from "mongoose";

const point=new mongoose.Schema({
  x:{type:Number,required:true},
  y:{type:Number,required:true},
  z:{type:Number,required:true}
},{_id:false});

const telemetrySchema=new mongoose.Schema({
  missionId:{type:mongoose.Schema.Types.ObjectId,ref:"Mission",required:true,index:true},
  position:{type:point,required:true},
  estimatedPosition:{type:point},
  altitude:Number,
  speed:Number,
  heading:Number,
  gpsStatus:{type:String,enum:["CONNECTED","DENIED"]},
  obstacleDetected:Boolean,
  detectedObstacle:String,
  sensorDistance:Number,
  targetDistance:Number,
  missionProgress:Number,
  positionError:Number,
  phase:String,
  timestamp:{type:Date,default:Date.now,index:true}
});

export default mongoose.model("Telemetry",telemetrySchema);
