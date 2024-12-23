import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
dotenv.config();


const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.static("public"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));

// Routes Import
import userRouter from "./routes/user.routes.js";
import { configDotenv } from "dotenv";

app.use("/api/v1/users", userRouter);

export { app };
