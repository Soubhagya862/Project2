import mongoose from "mongoose";
const point=new mongoose.Schema({x:Number,y:Number,z:Number},{_id:false});
const missionSchema=new mongoose.Schema({
 start:point,target:point,route:[point],gpsStatus:{type:String,default:"CONNECTED"},
 status:{type:String,default:"READY"},phase:{type:String,default:"IDLE"},
 createdAt:{type:Date,default:Date.now},completedAt:Date
});
export default mongoose.model("Mission",missionSchema);
