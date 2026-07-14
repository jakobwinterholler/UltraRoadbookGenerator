/** Map Supabase/PostgREST errors to user-friendly sync messages. */

export function isSchemaNotReadyError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("pgrst205") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table")
  );
}

export function isPermissionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("permission denied") || normalized.includes("42501");
}

export function normalizeSyncListError(message: string): string | null {
  if (isSchemaNotReadyError(message)) {
    // Backend tables not provisioned yet — show empty state instead of raw SQL errors.
    return null;
  }
  if (isPermissionError(message)) {
    return "Could not load your races. Try signing out and back in.";
  }
  return "Could not load your races right now. Pull to refresh in a moment.";
}
