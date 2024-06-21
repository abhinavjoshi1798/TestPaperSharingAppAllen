const express = require("express");
const { userRouter } = require("./routes/userRoutes");
const { adminRouter } = require("./routes/adminRoutes");
const { connection } = require("./db2");

const cors = require('cors');
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", userRouter);
app.use("/api/admin",adminRouter);

app.listen(process.env.PORT, async  () => {try{
  await connection;
  console.log("connected to mongoDB");
}catch(err){
  console.log("Cannot connect to the mongoDB",err);
}
  console.log(`server is running at ${process.env.PORT}`);
});
