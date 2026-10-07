export function safeError(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status)
    return `Provider or service request failed (HTTP ${status}). Review connection settings.`;
  return (error instanceof Error ? error.message : String(error))
    .replace(/(?:sk-|Bearer\s+)[a-zA-Z0-9_\-.]{8,}/g, "[redacted credential]")
    .slice(0, 2000);
}
