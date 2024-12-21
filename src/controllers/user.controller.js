import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs";
const registerUser = asyncHandler(async (req, res) => {
  //  Get User Details
  //  Validate input Data - Not EMPTY
  //  Check if User Already Exists By:- (Username & Email)
  //  Get Images Path(avatar & coverImage) & Check For Avatar
  //  If Available Upload Them To Cloudinary, Avatar
  //  Create user Object - Create Entry in Db
  //  Remove password and refresh token field from response
  //  Check for user creation
  //  return res

  //  1. Get User Details
  const { fullName, email, username, password } = req.body; // Check From user Model
  console.log("Email: ", email);
  console.log(req.body);

  //  2.Validate input Data - Not EMPTY
  if (!fullName || fullName.trim() === "") {
    throw new ApiError(400, "fullName Required");
  }
  if (!email || email.trim() === "") {
    throw new ApiError(400, "email Required");
  }
  if (!username || username.trim() === "") {
    throw new ApiError(400, "username Required");
  }
  if (!password || password.trim() === "") {
    throw new ApiError(400, "password Required");
  }

  //  3. Check if User Already Exists By:- (Username & Email)
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  
  // ***BUG FIX*** Existing user if exist files were still on my localStorage(should have been Deleted)
  if (existedUser) {
    if (req.files?.avatar[0]?.path) {
      fs.unlinkSync(req.files.avatar[0].path);
    }
    if (req.files?.coverImage[0]?.path) {
      fs.unlinkSync(req.files.coverImage[0].path);
    }
    throw new ApiError(409, "User with Email or Username Already Exists");
  }

  // From Routes upload also gives Access for Images
  // 4. Get Images Path(avatar & coverImage) & Check For Avatar

  const avatarLocalPath = req.files?.avatar[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "AvatarLocalPath File is Required");
  }

  let coverImageLocalPath;
  if (req.files.coverImage) {
    //Only create Path if it exists
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }
  //  Since Avatar is Required in UserModel Mandate it by if Condition

  //  5. If Available Upload Them To Cloudinary, Avatar
  // Pass Path and upload
  const avatar = await uploadOnCloudinary(avatarLocalPath); // utils cloudinary file return entire response
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar File is Required");
  }

  //  6. Create user Object - Create Entry in Db

  const user = await User.create({
    //Here Error is Not defined as it is a subpart of asyncHandler function and it will automatically generate the error if it occurs
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "", // Since it is Not required by UserModel
    email,
    password,
    username: username.toLowerCase(),
    // WatchHistory By Default should be 0, refreshToken Shoul also be By default 0
    //Rest All the fields are covered
  });

  // **** 7. Remove password and refresh token field from response *****
  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken" //By Default all are selected
  );

  //  8. Check for user creation
  if (!userCreated) {
    throw new ApiError(500, "Something went wrong while registering User");
  }

  //  9. return res (ApiResponse.js)
  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "User Registered Successfully"));
});
export { registerUser };
