import mongoose from "mongoose";
const telemetrySchema=new mongoose.Schema({
 missionId:{type:mongoose.Schema.Types.ObjectId,ref:"Mission"},position:{x:Number,y:Number,z:Number},
 altitude:Number,speed:Number,heading:Number,gpsStatus:String,obstacleDetected:Boolean,timestamp:{type:Date,default:Date.now}
});
export default mongoose.model("Telemetry",telemetrySchema);
