"use client";

import { Check } from "lucide-react";

export type FlowStep = "upload" | "preview" | "mapping" | "review" | "results";

const STEPS: { key: FlowStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "mapping", label: "AI Mapping" },
  { key: "review", label: "Review & Confirm" },
  { key: "results", label: "Results" },
];

interface StepIndicatorProps {
  currentStep: FlowStep;
}

/**
 * The "processing" state (the actual background job running) doesn't get
 * its own circle — it's visually treated as still being on the "review"
 * step, since from the user's perspective they already confirmed the
 * import; processing is what happens as a result of that confirmation,
 * not a distinct decision point of its own.
 */
function resolveActiveIndex(currentStep: FlowStep): number {
  if (currentStep === "review") return 3;
  return STEPS.findIndex((s) => s.key === currentStep);
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const activeIndex = resolveActiveIndex(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, i) => {
        const isComplete = i < activeIndex;
        const isActive = i === activeIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isComplete
                    ? "bg-indigo-600 text-white"
                    : isActive
                      ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border-2 border-indigo-600"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500"
                }`}>
                {isComplete ? <Check size={14} /> : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive ? "text-indigo-600 dark:text-indigo-300 font-medium" : "text-gray-400 dark:text-slate-500"
                }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-10 h-0.5 mx-1 mb-5 transition-colors ${
                  isComplete ? "bg-indigo-600" : "bg-gray-200 dark:bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}