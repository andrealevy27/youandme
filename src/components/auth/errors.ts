/** Map Better Auth client errors to calm, human copy. */
export function friendlyAuthError(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Check them and try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try signing in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 10 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long — keep it under 128 characters.";
    case "INVALID_EMAIL":
      return "That doesn't look like a valid email address.";
    case "INVALID_TOKEN":
      return "This reset link is invalid or has expired. Request a new one.";
    case "EMAIL_NOT_VERIFIED":
      return "Please confirm your email first — check your inbox for the link.";
  }
  // Server-side hooks (invite-only, suspended accounts) already return human-readable messages.
  if (error.status === 403 && error.message) return error.message;
  return error.message && error.message.length < 160 ? error.message : "Something went wrong. Please try again.";
}
