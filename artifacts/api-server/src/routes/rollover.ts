import { Router, type IRouter } from "express";
import { runRollover } from "../lib/rollover";
import { RunRolloverResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/rollover", async (_req, res): Promise<void> => {
  const result = runRollover();
  res.json(RunRolloverResponse.parse(result));
});

export default router;
