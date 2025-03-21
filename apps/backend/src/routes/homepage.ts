import { Router } from "express";

const homeRouter = Router();

homeRouter.get("/", (_req, res) => {
  res.json("hi");
});

export default homeRouter;
