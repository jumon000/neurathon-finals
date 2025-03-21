import express from "express";
import cors from "cors";
const app = express();
import homeRouter from "./routes/homepage";

app.use(express.json());
app.use(cors());
app.use("/", homeRouter);

export default app;
