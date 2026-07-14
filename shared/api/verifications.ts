import { fetchWithAuth, getApiBaseUrl, parseApiError } from "./client";
import { submitCompanionVerificationsDirect } from "./cloudDirect";
import type { CompanionVerificationSubmission } from "../types/verification";

export async function submitCompanionVerifications(
  accessToken: string,
  submissions: CompanionVerificationSubmission[],
  userId?: string | null,
): Promise<{ accepted: string[] }> {
  if (submissions.length === 0) {
    return { accepted: [] };
  }
  if (!getApiBaseUrl()) {
    const raceId = submissions[0]?.raceId;
    if (!userId || !raceId) {
      throw new Error("User id required to sync verifications without API server.");
    }
    return submitCompanionVerificationsDirect(userId, raceId, submissions);
  }
  const response = await fetchWithAuth("/api/sync/verifications", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verifications: submissions }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to sync verifications."));
  }
  return response.json();
}

export async function fetchCompanionVerifications(
  accessToken: string,
  raceId: string,
  status: "pending" | "history" | "all" = "pending",
): Promise<CompanionVerificationSubmission[]> {
  if (!getApiBaseUrl()) {
    return [];
  }
  const response = await fetchWithAuth(
    `/api/sync/verifications?race_id=${encodeURIComponent(raceId)}&status=${encodeURIComponent(status)}`,
    accessToken,
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to load verifications."));
  }
  const payload = await response.json();
  return payload.verifications ?? [];
}

export async function reviewCompanionVerification(
  accessToken: string,
  raceId: string,
  verificationId: string,
  action: "accept" | "reject",
): Promise<void> {
  const response = await fetchWithAuth(
    `/api/sync/verifications/${encodeURIComponent(verificationId)}/review`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ race_id: raceId, action }),
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to review verification."));
  }
}
