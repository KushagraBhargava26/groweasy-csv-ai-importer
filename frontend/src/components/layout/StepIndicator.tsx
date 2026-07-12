"use client";

import { Check } from "lucide-react";

export type FlowStep = "upload" | "preview" | "mapping" | "review" | "results";

const STEPS: { key: FlowStep; label: string }[] = [
  { key: "upload", label: "Upload CSV" },
  { key: "preview", label: "Preview CSV" },
  { key: "mapping", label: "AI Mapping" },
  { key: "review", label: "Review & Confirm" },
  { key: "results", label: "Import Results" },
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
    <div className="flex items-center justify-center gap-2 py-8">
      {STEPS.map((step, i) => {
        const isComplete = i < activeIndex;
        const isActive = i === activeIndex;
        const isFilled = isComplete || isActive;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isFilled
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-slate-900 text-gray-400 dark:text-slate-500 border-2 border-gray-200 dark:border-slate-700"
                }`}>
                {isComplete ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive || isComplete
                    ? "text-gray-900 dark:text-white font-medium"
                    : "text-gray-400 dark:text-slate-500"
                }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-16 h-0 mx-2 mb-6 border-t-2 border-dashed transition-colors ${
                  isComplete ? "border-indigo-600" : "border-gray-200 dark:border-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}