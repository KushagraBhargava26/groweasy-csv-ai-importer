import { Router } from "express";
import { fileUpload } from "../middleware/upload-limits";
import { processImport, getImportStatus, previewMapping, listXlsxSheets } from "../controllers/import.controller";

const router = Router();

router.post("/process", fileUpload.single("file"), processImport);
router.get("/status/:jobId", getImportStatus);
router.post("/preview-mapping", fileUpload.single("file"), previewMapping);
router.post("/xlsx-sheets", fileUpload.single("file"), listXlsxSheets);

export default router;