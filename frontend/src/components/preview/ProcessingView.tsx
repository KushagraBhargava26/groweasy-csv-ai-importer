"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Purely cosmetic status messages that cycle while we wait — we don't have
// real batch-by-batch progress from the backend (that would require
// Server-Sent Events or WebSockets, a bigger architectural change). This
// gives the user a sense of motion and what's happening conceptually,
// without claiming false precision about actual backend progress.
const STATUS_MESSAGES = [
  "Reading your CSV rows…",
  "Batching records for AI processing…",
  "Gemini is mapping fields to CRM format…",
  "Validating extracted records…",
  "Almost done…",
];

const MESSAGE_INTERVAL_MS = 2200;

interface ProcessingViewProps {
  fileName: string;
  rowCount: number;
}

export function ProcessingView({ fileName, rowCount }: ProcessingViewProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center text-center">
      <Loader2 size={40} className="text-indigo-600 animate-spin mb-5" />
      <h3 className="font-medium text-gray-900">Processing {fileName}</h3>
      <p className="text-sm text-gray-500 mt-1">{rowCount} rows being mapped to GrowEasy CRM format</p>
      <p className="text-sm text-indigo-600 font-medium mt-6 transition-opacity duration-300">
        {STATUS_MESSAGES[messageIndex]}
      </p>
    </div>
  );
}