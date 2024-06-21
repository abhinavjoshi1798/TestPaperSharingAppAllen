const express = require("express");
const {
  paperDetails,
  adminDashboardData,
  paperUpload,
  upload,
  sharedPaperDetails,
} = require("../controllers/adminController");

const adminRouter = express.Router();

adminRouter.post("/paperdetails", paperDetails);

adminRouter.post("/admindashboard", adminDashboardData);

adminRouter.post("/paperupload", upload.array("paper", 5), paperUpload);

adminRouter.get("/sharedpaperdata", sharedPaperDetails);

module.exports = {
  adminRouter,
};
