export function browserIssue(text: string): string | null {
  if (
    /captcha|verify (?:that )?you are human|unusual traffic|checking your browser/i.test(
      text,
    )
  )
    return "The site requires human verification. Use the Computer tab to complete it, then continue.";
  if (
    /session (?:has )?expired|sign in to continue|log in to continue|authentication required/i.test(
      text,
    )
  )
    return "The site's login expired or is required. Sign in using the Computer tab, then continue.";
  if (
    /net::ERR_|Target (?:page|browser|closed)|Timeout.*exceeded|strict mode violation|No element|element.*not found/i.test(
      text,
    )
  )
    return "The page changed, disconnected or could not locate the requested control. Inspect the Computer tab before continuing.";
  return null;
}
