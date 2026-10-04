import { sendPasswordResetEmail, type Auth } from "firebase/auth";
import { applicationErrorMessage, diagnosticErrorCode } from "./applicationErrors.ts";
const resetMessage = "If an account exists for that email address, a password-reset email will be sent. Check your inbox and spam folder.";
/** Preserve account privacy without falsely claiming delivery on service failures. */
export async function requestPasswordReset(auth: Auth, email: string, area: string): Promise<{ message: string; error: string }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { message: resetMessage, error: "" };
  } catch (error) {
    if (diagnosticErrorCode(error) === "auth/user-not-found") return { message: resetMessage, error: "" };
    return { message: "", error: applicationErrorMessage(error, "Unable to request a password reset.", area) };
  }
}
