import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import { response } from "express";

const options = {
    httpOnly: true,
    secure: true,
};

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        console.log(error);
        throw new ApiError(500, "Token not generated");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;
    if (
        fullName?.trim() === "" ||
        email?.trim() === "" ||
        username?.trim() === "" ||
        password?.trim() === ""
    ) {
        throw new ApiError(400, "All feilds are required");
    }

    const existing = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existing) {
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    //uploading to cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    let coverImage = "";
    if (coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }

    if (!avatar) {
        throw new ApiError(400, "Failed to upload avatar");
    }

    const user = await User.create({
        username,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        email,
        password,
        fullName,
    });

    const savedUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!savedUser) {
        throw new ApiError(500, "Failed to register");
    }
    console.log("user registered successfully");
    return res
        .status(201)
        .json(new ApiResponse(200, savedUser, "user registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const user = await User.findOne({
        $or: [{ username, email }],
    });

    if (!user) {
        throw new ApiError(404, "User is not registered");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged In Successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            },
        },
        {
            returnDocument: "after",
        }
    );

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, "User Logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken._id);

        if (!user) {
            throw new ApiError(401, "Invalid request token");
        }

        if (incomingRefreshToken == user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used");
        }

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshToken(user_id);

        res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(404, error?.message || "Failed to refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(400, "User not logged in");
    }

    const isPasswordCorrect = await User.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Password");
    }

    user.password = password;

    await user.save({ validateBeforeSave: false });

    return response
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return response
        .status(200)
        .json(new ApiResponse(200, req.user, "user fetched successfully"));
});

const changeAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All feilds are required");
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    changeAccountDetails,
};
