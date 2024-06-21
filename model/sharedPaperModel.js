const mongoose = require("mongoose");

const googleDriveLinkSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  link: { type: String, required: true },
}, { _id: false });

const uniqueSymbolsSchema = new mongoose.Schema({
  symbolVisible: { type: String, required: true },
  symbolHidden: { type: String, required: true }
}, { _id: false });

const sharedPaperSchema = new mongoose.Schema(
  {
    paperCode: { type: String, required: true },
    pdfS3PathSymbolised: { type: [String], required: true },
    center: { type: String, required: true },
    emailId: { type: String, required: true },
    uniqueSymbols: { type: uniqueSymbolsSchema, required: true },
    dateCreated: { type: String, required: true },
    testDate: { type: String, required: true },
    googleDriveLinks: { type: [googleDriveLinkSchema], required: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true }
  },
  {
    versionKey: false,
  }
);

const SharedPaperModel = mongoose.model("sharedPaper", sharedPaperSchema);

module.exports = {
  SharedPaperModel,
};
