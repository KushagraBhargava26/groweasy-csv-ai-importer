import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — generous for a CSV, but not unbounded

// Memory storage, not disk storage: we only need the file's contents as a
// string for parsing, and it never needs to persist after the request
// finishes. Keeps the project stateless, per the spec's "no database
// required" note — nothing to clean up on disk afterward either.
const storage = multer.memoryStorage();

function csvFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  const isCsvMimeType = file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
  const isCsvExtension = file.originalname.toLowerCase().endsWith(".csv");

  // Check extension too, not just mimetype: browsers are inconsistent
  // about what mimetype they report for CSVs (some send
  // "application/octet-stream" for a perfectly valid .csv file).
  if (isCsvMimeType || isCsvExtension) {
    callback(null, true);
  } else {
    callback(new Error("Only .csv files are accepted"));
  }
}

export const csvUpload = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});