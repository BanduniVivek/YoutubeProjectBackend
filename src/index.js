import dotenv from 'dotenv'
import connectDB from "./db/index.js";
import { app } from './app.js';

dotenv.config({
        path : "./.env"
})

// console.log(process.env.PORT)


connectDB()
.then(()=>{
    const server = app.listen(process.env.PORT||1000, ()=>{
        console.log(`Server is listening at ${process.env.PORT}`)
    })

    server.on("error", (err)=>{
        console.log("Server error:", err);
    });
})
.catch((err)=>{
    console.log("MONGO DB Connection failed")
})





