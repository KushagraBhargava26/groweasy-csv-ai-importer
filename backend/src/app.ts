import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import importRoutes from "./routes/import.route";
import { errorHandler } from "./middleware/error-handler";

dotenv.config();

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/import", importRoutes);

  // Error handler must be registered LAST, after all routes — Express
  // routes error-throwing requests through middleware in registration
  // order, and an error handler placed before routes would never see them.
  app.use(errorHandler);

  return app;
}