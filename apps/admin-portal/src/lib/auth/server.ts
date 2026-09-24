import { createNeonAuth } from "@neondatabase/auth/next/server";

// NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET MUST be set in production
// (see .env.production.template). The hardcoded fallbacks below exist ONLY so
// that `next build` can compile without a preconfigured environment; they must
// be overridden by real secrets in any live deployment.
export const auth = createNeonAuth({
  baseUrl:
    process.env.NEON_AUTH_BASE_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3001"),
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ??
      "CHANGE_ME_NEON_AUTH_COOKIE_SECRET_AT_LEAST_64_CHARS_LONG",
  },
});