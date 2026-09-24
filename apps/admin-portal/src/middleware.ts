import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  // Protect every app page except the public auth/account surfaces and static assets.
  matcher: ["/((?!auth|account|_next|api|favicon.ico).*)"],
};
