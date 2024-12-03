import dotenv from "dotenv";

import connectDb from "./db/db.js";
import { app } from "./app.js";
dotenv.config();

connectDb()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Server Listening on PORT: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log(`Connection MongoDB Failed: ${error}`);
  });
