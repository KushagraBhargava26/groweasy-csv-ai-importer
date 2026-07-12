import { Router } from "express";
import { csvUpload } from "../middleware/upload-limits";
import { processImport, getImportStatus, previewMapping } from "../controllers/import.controller";

const router = Router();

router.post("/process", csvUpload.single("file"), processImport);
router.get("/status/:jobId", getImportStatus);
router.post("/preview-mapping", csvUpload.single("file"), previewMapping);

export default router;
