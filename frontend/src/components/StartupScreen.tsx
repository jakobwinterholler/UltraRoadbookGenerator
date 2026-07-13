import { useEffect, useState } from "react";
import { checkHealth, fetchAnalysisSteps } from "../api";
import {
  STARTUP_STEPS,
  createInitialSteps,
  markStepActive,
  markStepComplete,
  type ProgressStepState,
} from "../progress";
import ProgressSteps from "./ProgressSteps";

interface StartupScreenProps {
  onReady: () => void;
}

export default function StartupScreen({ onReady }: StartupScreenProps) {
  const [steps, setSteps] = useState<ProgressStepState[]>(() => createInitialSteps(STARTUP_STEPS));
  const [startedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setSteps((current) => markStepActive(current, "backend"));

      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) {
          return;
        }

        try {
          await checkHealth();
          break;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        if (attempt === maxAttempts - 1) {
          setError("Backend is not running. Use the Ultra Roadbook launcher on your Desktop.");
          return;
        }
      }

      if (cancelled) {
        return;
      }

      setSteps((current) => markStepComplete(current, "backend"));
      setSteps((current) => markStepActive(current, "frontend"));
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      setSteps((current) => markStepComplete(current, "frontend"));

      setSteps((current) => markStepActive(current, "application"));
      try {
        await fetchAnalysisSteps();
      } catch {
        // Non-fatal: the app can still run with built-in step definitions.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      setSteps((current) => markStepComplete(current, "application"));

      setSteps((current) => markStepActive(current, "ready"));
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setSteps((current) => markStepComplete(current, "ready"));

      if (!cancelled) {
        onReady();
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [onReady]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <ProgressSteps
        title="Ultra Roadbook Generator"
        subtitle="Starting local planning tools"
        steps={steps}
        startedAt={startedAt}
        totalSteps={STARTUP_STEPS.length}
      />
      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
