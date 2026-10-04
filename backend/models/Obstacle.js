import mongoose from "mongoose";
const obstacleSchema=new mongoose.Schema({
 missionId:{type:mongoose.Schema.Types.ObjectId,ref:"Mission"},position:{x:Number,y:Number,z:Number},
 size:{x:Number,y:Number,z:Number},type:{type:String,default:"STATIC"},detectedAt:{type:Date,default:Date.now}
});
export default mongoose.model("Obstacle",obstacleSchema);
