const express = require("express");
const { sentOTP, verifyOTP, employeeDetails, userDashboard, sharePaper } = require("../controllers/userController");

const userRouter = express.Router();

userRouter.post("/send_mobile_otp", sentOTP);
userRouter.post("/verify-otp", verifyOTP);
userRouter.post("/userdetails",employeeDetails)
userRouter.post("/userdashboard",userDashboard )
userRouter.post("/sharepaper",sharePaper)

module.exports = {
  userRouter,
};
