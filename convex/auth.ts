import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
// @ts-expect-error Injected by a0 Convex sync.
import { A0Social } from "./a0Social";

declare const process: { env: Record<string, string | undefined> };

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, A0Social],
});