import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs, { access } from "fs";

const generateAccessAndRefreshToken = async (userid) => {
  try {
    const user = await User.findById(userid);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // { validateBeforeSave: false } Else it will again check for password
    //  and here only we are manipulating by userid and password not here so it will give error
    user.refreshToken = refreshToken; // Encrypted refresh Token saved in user model
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access And Refresh token"
    );
  }
};

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
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // utils cloudinary file return entire response
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar File is Required");
  }

  //  6. Create user Object - Create Entry in Db

  const user = await User.create({
    //Here Error is Not defined as it is a subpart of asyncHandler function
    //and it will automatically generate the error if it occurs
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

const loginUser = asyncHandler(async (req, res) => {
  //  req.body -> data
  //  username/email
  //  check Password
  //  Access & Refresh Token
  //  send cookie

  //  1. req.body -> data
  const { username, email, password } = req.body;
  //  2. username/email
  if (!username && !email) {
    throw new ApiError(400, "Username or email is Required");
  }
  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password is Required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User Doesn't Exist");
  }

  //  3. check Password
  //  Our Methods from user model are in "user" Not "User"
  //  "User" ==> Monggose Methods
  //  "user" ==> Our Defined Methods form user.smodel.j
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user Credentials");
  }

  //  4. Access & Refresh Token (Create a method above)
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //  5. Send Cookie
  const options = {
    httpOnly: true, //  Only Server Modifiable
    secure: true,
  };
  //  Sending Cookie
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      // ApiResponse(statusCode,data,message)
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In SuccessFully"
      )
    );
});

//  Before Logout Create auth.middleware.js
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      //Makes a new return response having new updated value otherwise return Old Value
      new: true,
    }
  );

  const options = {
    httpOnly: true, //  Only Server Modifiable
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logout Successfully"));
});

//  Validate Access Token by refreshToken
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(
      401,
      "Unauthorised Request (Invalid incoming Refresh Token)"
    );
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
 