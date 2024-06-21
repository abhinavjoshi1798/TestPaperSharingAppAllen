const axios = require("axios");
const pool = require("../db");
const { PaperModel } = require("../model/paperModel");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const { generateSymbol } = require("./randomSymbolGeneratorController");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const nodemailer = require("nodemailer");
const { SharedPaperModel } = require("../model/sharedPaperModel");
const { dateConstructor, formatDate } = require("./dateController");
const { google } = require("googleapis");
const apikeys = require("./apikey.json");

// { mobile: mobileNumber }
const sentOTP = async (req, res) => {
  try {
    const { mobile } = req.body;
    const url = process.env.Sent_Otp_Url;
    const userId = process.env.Sent_Otp_UserId;
    const password = process.env.Sent_Otp_Password;
    const params = {
      v: "1.1",
      userid: userId,
      password: password,
      mask: "ALENQB",
      auth_scheme: "plain",
      msg_type: "text",
      format: "text",
      method: "TWO_FACTOR_AUTH",
      phone_no: mobile,
      msg: "Your OTP for Allen QB-Stats Password Change is %code%. Please enter OTP in the provided field. ALLEN",
      otpCodeLength: "4",
      otpCodeType: "NUMERIC",
    };
    const smsResponse = await axios.get(url, { params });

    const responseParts = smsResponse.data.split("|");
    if (smsResponse.data.includes("success")) {
      const response = { success: responseParts[0], message: responseParts[3] };
      return res.status(200).json(response);
    } else {
      const response = { error: responseParts[0], message: responseParts[2] };
      return res.status(500).json(response);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// { mobile: mobileNumber, otp: otp }
const verifyOTP = async (req, res) => {
  const { otp, mobile } = req.body;
  try {
    // const mobile = parseInt(mobile);
    const url = "http://enterprise.smsgupshup.com/GatewayAPI/rest";
    const userid = "2000210830";
    const password = "Allen$webtech2022";
    const params = {
      v: "1.1",
      userid: userid,
      password: password,
      method: "TWO_FACTOR_AUTH",
      phone_no: mobile,
      otp_code: otp,
    };
    const smsResponse = await axios.get(url, { params });
    const responseParts = smsResponse.data.split("|");
    if (smsResponse.data.includes("success")) {
      const response = { success: responseParts[0], message: responseParts[3] };

      return res.status(200).json(response);
    } else {
      const response = { error: responseParts[0], message: responseParts[2] };
      return res.status(500).json(response);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

//req -> {"employeeId":"15820"} res -> { "role": "superuser" }
//req -> {"employeeId":"15868"} res -> { "role": "moderator" }
const employeeDetails = async (req, res) => {
  const { employeeId } = req.body;
  try {
    if (!employeeId) {
      return res
        .status(400)
        .send({ err: "EmployeeId is required in request body" });
    }
    const [results, fields] = await pool.query(
      "SELECT * FROM user_info WHERE user_id = ?",
      [employeeId]
    );
    if (!results[0]) {
      return res
        .status(200)
        .send({ role: "role for the given employeeId is not present" });
    }

    if (results[0].third_party_user_role == 1) {
      return res.status(200).send({
        role: "superuser",
        center_info_id: results[0].center_info_id,
      });
    } else if (results[0].third_party_user_role == 2) {
      return res.status(200).send({
        role: "moderator",
        center_info_id: results[0].center_info_id,
      });
    } else {
      return res.status(200).send({
        role: "Not allowed on QB",
        center_info_id: results[0].center_info_id,
      });
    }
  } catch (error) {
    console.error("Error executing query at paperDetails:", error.stack);
    res.status(500).send({ error: "Internal server error" });
  }
};

const userDashboard = async (req, res) => {
  const { center_info_id } = req.body;
  try {
    if (!center_info_id) {
      return res
        .status(400)
        .send({ msg: "center info id is missing in request body." });
    }

    const [results, fields] = await pool.query("SELECT * FROM center_info;");

    const center = results.filter((el) => el.id == center_info_id);

    const centerName = center[0].name.toLowerCase();

    const papers = await PaperModel.find();

    const filterData = papers.filter((el) => el.centers.includes(centerName));

    const paperDetailsPromises = filterData.map(async (el) => {
      const [paperResults, paperFields] = await pool.query(
        "SELECT * FROM paper_info WHERE paper_code = ?",
        [el.paperCode]
      );
      return paperResults[0];
    });

    const paperDetails = await Promise.all(paperDetailsPromises);

    const transformedData = filterData.map((el, index) => ({
      docs: el._doc,
      paperDetails: paperDetails[index],
    }));

    res.status(200).send({ data: transformedData });
  } catch (error) {
    console.error("Error in userDashboard", error.message);
    res.status(500).send({ error: "Internal server error" });
  }
};

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
});

// Configure Google Drive API
const CREDENTIALS_PATH = path.join(__dirname, "apikey.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: "v3", auth });

const applySymbolOnPdf = async (symbolVisible, symbolHidden, inputPdfBytes) => {
  const pdfDoc = await PDFDocument.load(inputPdfBytes);
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    if (pdfDoc.getPageCount() == 1) {
      // Coordinates for the visible symbol
      const xVisible = width - 33;
      const yVisible = height - 65;
      page.drawText(symbolVisible, {
        x: xVisible,
        y: yVisible,
        size: 3,
      });
    }

    if (i == 1) {
      // Coordinates for the visible symbol
      const xVisible = width - 33;
      const yVisible = height - 65;
      page.drawText(symbolVisible, {
        x: xVisible,
        y: yVisible,
        size: 3,
      });
    }

    // Coordinates for the hidden symbol (bottom center)
    const textWidth = font.widthOfTextAtSize(symbolHidden, 6);
    const xHidden = (width - textWidth) / 2;
    const yHidden = 30; // 20 units from the bottom edge
    page.drawText(symbolHidden, {
      x: xHidden,
      y: yHidden,
      size: 6,
      font: font,
      opacity: 0,
    });
  }
  console.log("Symbols applied on file");
  return await pdfDoc.save();
};

const cleanupFolders = (folderPath, outputFolderPath) => {
  try {
    [folderPath, outputFolderPath].forEach((folder) => {
      if (fs.existsSync(folder)) {
        fs.readdirSync(folder).forEach((file) => {
          fs.unlinkSync(path.join(folder, file));
        });
        console.log(`Files deleted from ${folder}`);
      }
    });
  } catch (cleanupError) {
    console.error("Error during cleanup:", cleanupError);
  }
};

const createDriveFolder = async (folderName) => {
  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: [process.env.Google_Drive_Parent_Folder_ID], // Adjust the parent folder ID as needed
  };
  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: "id, webViewLink",
  });
  return { id: folder.data.id, link: folder.data.webViewLink };
};

const uploadToGoogleDrive = async (filePath, folderId, newFileName) => {
  const fileMetadata = {
    name: newFileName,
    parents: [folderId],
  };
  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(filePath),
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id",
  });
  return file.data.id;
};

const createDriveFileLink = (fileId) => {
  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
};

const extractNewFileName = (oldFileName) => {
  const regex = /^(.*?)(-\d+)?\.pdf$/;
  const match = oldFileName.match(regex);
  return match ? `${match[1]}.pdf` : oldFileName;
};

const sharePaper = async (req, res) => {
  const {
    center_info_id,
    emailId,
    paperCode,
    paperDate,
    pdfS3Path,
    employeeId,
    employeeName,
  } = req.body;
  if (
    !center_info_id ||
    !emailId ||
    !paperCode ||
    !paperDate ||
    !pdfS3Path ||
    !employeeId ||
    !employeeName
  ) {
    return res.status(400).send({
      msg: "center_info_id or emailId or paperCode or paperDate or pdfS3Path or employeeId or employeeName is missing from req.body.",
    });
  }

  let responseSent = false;

  const timeoutId = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      res.status(200).send({
        message: "Mail sending in process",
        status: 200,
      });
    }
  }, 55000);

  try {
    const [results] = await pool.query("SELECT * FROM center_info;");
    const center = results.find((el) => el.id == center_info_id);
    if (!center) {
      clearTimeout(timeoutId);
      return res.status(400).send({ msg: "Invalid center_info_id" });
    }

    const centerName = center.name.toLowerCase();
    const objectKeys = pdfS3Path;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.Email_Id, pass: process.env.Email_Password },
    });

    const bucketName = process.env.AWS_BUCKET_NAME;
    const folderPath = path.join(__dirname, "..", "sharePaperFolder");
    const outputFolderPath = path.join(
      __dirname,
      "..",
      "symbolizedSharedFiles"
    );
    cleanupFolders(folderPath, outputFolderPath);

    const signedUrls = await Promise.all(
      objectKeys.map((key) =>
        s3
          .getSignedUrlPromise("getObject", {
            Bucket: bucketName,
            Key: key,
            Expires: 3600,
          })
          .then((url) => ({ url, key }))
      )
    );

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
    const symbol = await generateSymbol();
    const symbolVisible = symbol.split("")[0];
    const symbolHidden = symbol.slice(1);

    if (!fs.existsSync(outputFolderPath)) fs.mkdirSync(outputFolderPath);

    const processedFiles = await Promise.all(
      signedUrls.map(async ({ url, key }) => {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        console.log(`Downloaded file from S3: ${key}`);
        const modifiedPdfBytes = await applySymbolOnPdf(
          symbolVisible,
          symbolHidden,
          response.data
        );
        const newFileName = extractNewFileName(path.basename(key));
        const outputFilePath = path.join(outputFolderPath, newFileName);
        fs.writeFileSync(outputFilePath, modifiedPdfBytes);
        return { filename: newFileName, path: outputFilePath };
      })
    );

    const folderName = `${paperCode}_${centerName}_${Date.now()}`;
    const { id: folderId, link: folderLink } = await createDriveFolder(
      folderName
    );

    const googleDriveUploadPromises = processedFiles.map(async (file) => {
      try {
        const fileId = await uploadToGoogleDrive(
          file.path,
          folderId,
          file.filename
        );
        console.log(`Uploaded ${file.filename} to Google Drive`);
        return { filename: file.filename, link: createDriveFileLink(fileId) }; // Return an object with filename and Google Drive link
      } catch (uploadError) {
        console.error(
          `Error uploading ${file.filename} to Google Drive:`,
          uploadError
        );
        return null;
      }
    });

    const googleDriveLinks = (
      await Promise.all(googleDriveUploadPromises)
    ).filter((link) => link !== null);

    const mailOptions = {
      from: "qbops@allen.in",
      to: emailId,
      subject: "Test Papers",
      text: `Please find the test paper files in the following Google Drive folder: ${folderLink}`,
    };

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        if (!responseSent) {
          responseSent = true;
          clearTimeout(timeoutId);
          return res.status(500).send({ error: "Error sending email" });
        }
      }
      console.log("Email sent successfully");

      const ts = Date.now();
      const uploadPromises = processedFiles.map(async (file) => {
        const fileStream = fs.createReadStream(file.path);
        const uploadParams = {
          Bucket: bucketName,
          Key: `QbOps/destination/${paperCode + "_" + ts}/${file.filename}`,
          Body: fileStream,
        };
        try {
          const data = await s3.upload(uploadParams).promise();
          console.log(`Uploaded ${file.filename} to S3`);
          return data.Key; // Return the S3 key
        } catch (uploadError) {
          console.error(`Error uploading ${file.filename} to S3:`, uploadError);
          return null;
        }
      });

      const uploadedKeys = await Promise.all(uploadPromises);

      const validUploadedKeys = uploadedKeys.filter((key) => key !== null);
      const timestamp = dateConstructor();
      const formattedDate = formatDate(timestamp);

      const sharePaperData = new SharedPaperModel({
        paperCode,
        pdfS3PathSymbolised: validUploadedKeys, // Add the S3 keys of symbolized files
        center: centerName,
        emailId,
        uniqueSymbols: { symbolVisible, symbolHidden },
        dateCreated: formattedDate,
        testDate: paperDate,
        googleDriveLinks, // Add the array of objects with Google Drive filenames and links
        employeeId,
        employeeName,
      });

      await sharePaperData.save();
      console.log("sharePaper data saved in the database");
      cleanupFolders(folderPath, outputFolderPath);

      if (!responseSent) {
        responseSent = true;
        clearTimeout(timeoutId);
        return res.status(200).send({
          message:
            "Files processed, emailed, and uploaded to S3 and Google Drive successfully",
          status: 200,
        });
      }
    });
  } catch (err) {
    console.error("Error in sharePaper", err.message);
    if (!responseSent) {
      responseSent = true;
      clearTimeout(timeoutId);
      return res.status(500).send({ error: err.message });
    }
  }
};

module.exports = {
  sentOTP,
  verifyOTP,
  employeeDetails,
  userDashboard,
  sharePaper,
};
