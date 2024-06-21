const pool = require("../db");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const AWS = require("aws-sdk");
const { PaperModel } = require("../model/paperModel");
const { dateConstructor, formatDate } = require("./dateController");
const { SharedPaperModel } = require("../model/sharedPaperModel");

// Sanitize filename function
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

// {"paperCode":"0000APF400118025"}
const paperDetails = async (req, res) => {
  const { paperCode } = req.body;
  try {
    const [results, fields] = await pool.query(
      "SELECT * FROM paper_info WHERE paper_code = ?",
      [paperCode]
    );
    res.status(200).send({ paperDetails: results[0] });
  } catch (error) {
    console.error("Error executing query at paperDetails:", error.stack);
    res.status(500).send({ error: "Internal server error" });
  }
};

const adminDashboardData = async (req, res) => {
  const { adminEmployeeId } = req.body;
  try {
    if (!adminEmployeeId) {
      return res
        .status(400)
        .send({ msg: "adminEmployeeId is missing in req.body." });
    }

    const [results, fields] = await pool.query("SELECT * FROM center_info;");

    const papers = await PaperModel.find({ adminEmployeeId: adminEmployeeId });

    res.status(200).send({ centers: results, papers });
  } catch (err) {
    console.error("Error executing query at adminDashboardData:", err.stack);
    res.status(500).send({ error: "Internal server error" });
  }
};

//---------------------------------------------- multer-------------

function fileFilter(req, file, cb) {
  if (file.mimetype !== "application/pdf") {
    cb(new Error("Only PDF files are allowed"), false);
  } else {
    cb(null, true);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const originalFileName = sanitizeFilename(file.originalname.replace(/\s+/g, "-"));
    cb(
      null,
      `${originalFileName.split(".")[0]}${path.extname(originalFileName)}`
    );
  },
});

const upload = multer({ storage: storage, fileFilter: fileFilter });

//------------------------------------------------------------------------------

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
});

const uploadToS3 = async (file, paperCode, ts) => {
  const fileStream = fs.createReadStream(file.path);

  
  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `QbOps/source/${paperCode+"_"+ts}/${file.filename}`,
    Body: fileStream,
  };

  return new Promise((resolve, reject) => {
    s3.upload(uploadParams, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
};

//--------------------------------------------------------------- delete files from uploads folder

const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
};

const paperUpload = async (req, res) => {
  const { centers, paperCode, testPlan, employeeId } = req.body;
  // console.log("centers", typeof (centers), centers);
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    if (!centers || !paperCode || !testPlan || !employeeId) {
      return res.status(400).send({
        msg: "centers or paperCode or testPlan or employeeId is missing in request body",
      });
    }

    const [results, fields] = await pool.query(
      "SELECT * FROM paper_info WHERE paper_code = ?",
      [paperCode]
    );
    const testDate = results[0].test_date;

    const fileNames = req.files.map((file) => file.originalname);

    const ts = Date.now();

    const uploads = req.files.map(async (file) => {
      const uploadedFile = await uploadToS3(file, paperCode,ts);
      return uploadedFile.Key; // Ensure this is correct and matches your S3 response
    });

    const uploadedFilesKeys = await Promise.all(uploads);

    

    let lowerCaseCenters;
    if (typeof (centers) == "object") {
      lowerCaseCenters = centers?.map((center) => center.toLowerCase());
    }
    if (typeof (centers) == "string") {
      lowerCaseCenters = centers.toLowerCase();
    }

    const timestamp = dateConstructor();
    const formattedDate = formatDate(timestamp);

    const paper = new PaperModel({
      paperCode: paperCode,
      centers: lowerCaseCenters,
      testPlan,
      adminEmployeeId: Number(employeeId),
      pdfS3Path: uploadedFilesKeys,
      dateCreated: formattedDate,
      testDate,
      fileNames: fileNames,
    });

    await paper.save();

    const filesToDelete = fs.readdirSync("./uploads");

    for (const file of filesToDelete) {
      const filePath = path.join("./uploads", file);
      await deleteFile(filePath);
    }

    res.status(200).send({ msg: "Paper has been created", paper, status: 200 });
  } catch (error) {
    console.error("Error uploading files to S3:", error);
    res.status(500).send({ error: error.message });
  }
};

const sharedPaperDetails = async (req,res) => {
  
  try {
    const sharedPaper = await SharedPaperModel.find();
    res.status(200).send(sharedPaper);
  } catch (error) {
    
    res.status(500).send({ error: error.message });
  }
}

module.exports = {
  paperDetails,
  adminDashboardData,
  paperUpload,
  upload,
  sharedPaperDetails
};
