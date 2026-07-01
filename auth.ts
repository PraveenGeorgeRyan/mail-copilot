import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
// Imported for the module augmentation below — TS can only extend a module it has seen.
import type { JWT as _JWT } from "next-auth/jwt";

/**
 * Auth.js v5 configuration.
 *
 * The app authenticates with "Sign in with Google" (OAuth). Google returns:
 *  - an access token (valid ~1h) used to call the Gmail API
 *  - a refresh token used to mint new access tokens silently
 * Both live inside the encrypted JWT session cookie — no database needed.
 *
 * Scopes: gmail.modify covers reading, searching (q=), and marking
 * read/unread; gmail.send covers sending. Requested up-front on first
 * login (access_type=offline + prompt=consent guarantees a refresh token).
 */
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Unix seconds when the access token expires */
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: SCOPES,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: persist the tokens Google just issued.
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      // Access token still valid (with a 60s safety margin)? Keep it.
      if (token.expiresAt && Date.now() < (token.expiresAt - 60) * 1000) {
        return token;
      }

      // Expired: exchange the refresh token for a new access token.
      if (!token.refreshToken) {
        return { ...token, error: "RefreshTokenError" as const };
      }
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        });
        const refreshed = await response.json();
        if (!response.ok) throw refreshed;

        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Math.floor(Date.now() / 1000 + refreshed.expires_in),
          // Google often omits the refresh token on renewal — keep the old one.
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
          error: undefined,
        };
      } catch {
        // invalid_grant etc. is non-retryable: surface it so the UI forces re-login.
        return { ...token, error: "RefreshTokenError" as const };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
