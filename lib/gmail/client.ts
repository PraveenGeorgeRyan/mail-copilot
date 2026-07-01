import { google, type gmail_v1 } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export class GmailAuthError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "GmailAuthError";
  }
}

/**
 * Builds a Gmail client for the signed-in user's current request.
 * The access token comes from the session cookie (see auth.ts) —
 * this module never stores credentials itself.
 */
export async function getGmail(): Promise<gmail_v1.Gmail> {
  const session = await auth();
  if (!session?.accessToken || session.error === "RefreshTokenError") {
    throw new GmailAuthError();
  }
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: session.accessToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}

/** Maps service-layer failures to HTTP responses for the API routes. */
export function mailErrorResponse(error: unknown): NextResponse {
  if (error instanceof GmailAuthError) {
    return NextResponse.json(
      { error: "Session expired — please sign in again." },
      { status: 401 }
    );
  }
  const apiError = error as { code?: number; message?: string };
  const status = typeof apiError.code === "number" && apiError.code >= 400 ? apiError.code : 500;
  console.error("[mail] Gmail API error:", apiError.message ?? error);
  return NextResponse.json(
    { error: apiError.message ?? "Mail service error" },
    { status }
  );
}
