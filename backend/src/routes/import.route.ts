import { Router } from "express";
import { fileUpload } from "../middleware/upload-limits";
import { processImport, getImportStatus, previewMapping } from "../controllers/import.controller";

const router = Router();

router.post("/process", fileUpload.single("file"), processImport);
router.get("/status/:jobId", getImportStatus);
router.post("/preview-mapping", fileUpload.single("file"), previewMapping);

export default router;
