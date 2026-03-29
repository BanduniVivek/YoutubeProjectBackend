import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            `${process.env.MONOGODB_URI}/${DB_NAME}`
        );
        console.log("MONGO DB connected!! ");
    } catch (error) {
        console.log("MONGO DB connection error : ", error);
        process.exit(1);
    }
};

export default connectDB;
