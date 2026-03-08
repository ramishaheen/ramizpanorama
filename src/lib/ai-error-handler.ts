import { toast } from "@/hooks/use-toast";

let lastCreditToastTime = 0;
const TOAST_COOLDOWN = 30_000; // Only show once per 30s

const CREDIT_ERROR_PATTERNS = [
  "AI credits exhausted",
  "Payment required",
  "PAYMENT_REQUIRED",
  "credits",
];

const RATE_LIMIT_PATTERNS = [
  "Rate limit exceeded",
  "rate limit",
  "RATE_LIMIT",
  "429",
];

export function isAICreditError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return CREDIT_ERROR_PATTERNS.some((p) =>
    msg.toLowerCase().includes(p.toLowerCase())
  );
}

export function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return RATE_LIMIT_PATTERNS.some((p) =>
    msg.toLowerCase().includes(p.toLowerCase())
  );
}

/**
 * Shows a user-friendly toast for AI errors. Returns true if it handled the error.
 */
export function handleAIError(error: unknown, context?: string): boolean {
  const now = Date.now();

  if (isAICreditError(error) || isRateLimitError(error)) {
    if (now - lastCreditToastTime > TOAST_COOLDOWN) {
      lastCreditToastTime = now;
      toast({
        title: "🔥 High Demand — You're Not the Only One Watching",
        description:
          "Our intelligence feeds are experiencing peak traffic right now. Hit refresh to grab the latest updates, or check back shortly — the situation is evolving fast and you won't want to miss what's next.",
        duration: 10000,
      });
    }
    return true;
  }

  return false;
}

/**
 * Check edge function response data for error field and handle gracefully.
 * Returns true if error was detected and handled.
 */
export function checkFnResponseError(fnData: any): boolean {
  if (!fnData?.error) return false;
  const errorStr = String(fnData.error);
  return handleAIError(new Error(errorStr));
}
