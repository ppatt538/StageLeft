import { Router, type IRouter } from "express";
import healthRouter from "./health";
import objectsRouter from "./objects";
import chatRouter from "./chat";
import messagesRouter from "./messages";
import rolloverRouter from "./rollover";
import uploadRouter from "./upload";
import undoRouter from "./undo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(objectsRouter);
router.use(chatRouter);
router.use(messagesRouter);
router.use(rolloverRouter);
router.use(uploadRouter);
router.use(undoRouter);

export default router;
