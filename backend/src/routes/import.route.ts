import { Router } from "express";
import { csvUpload } from "../middleware/upload-limits";
import { processImport, getImportStatus } from "../controllers/import.controller";

const router = Router();

// csvUpload.single("file") — the field name "file" must match exactly
// what the frontend's FormData key is set to when it sends the request.
router.post("/process", csvUpload.single("file"), processImport);
router.get("/status/:jobId", getImportStatus);

export default router;