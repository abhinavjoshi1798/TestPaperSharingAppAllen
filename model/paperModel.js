const mongoose = require("mongoose");
const paperSchema = mongoose.Schema(
  {
    paperCode: { type: String, required: true },
    centers:{type:[String],required:true},
    adminEmployeeId: { type: Number, required: true },
    pdfS3Path: { type: [String], required: true },
    testPlan: { type: String, required: true },
    dateCreated: { type: String, required: true },
    testDate:{type:String,required:true},
    fileNames:{type:[String],required:true}
  },
  {
    versionKey: false,
  }
);

const PaperModel = mongoose.model("paper", paperSchema);

module.exports = {
  PaperModel,
};
