import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";
import { logger } from "./utils/logger";

const PORT = process.env.PORT ?? 5000;

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
