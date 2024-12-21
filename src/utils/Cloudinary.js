import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
//This configuration will tell what account logins and give permissions

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

//  Upload an image
//  localFilePath ==> it is the file path of avatar or coverImage
//  /public/temp/sampleImage.jpeg
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    fs.unlinkSync(localFilePath);
    return response;
    // console.log("Cloudinary Upload Successful:", response.url);
  } catch (error) {
    console.error("Cloudinary Upload Failed:", error.message);
    fs.unlinkSync(localFilePath);
    return null;
  }
};

export { uploadOnCloudinary };
