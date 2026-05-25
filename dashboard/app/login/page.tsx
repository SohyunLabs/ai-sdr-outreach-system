import { signIn } from "@/auth";
import Image from "next/image";

const errorMessages: Record<string, string> = {
  AccessDenied: "Access denied. Your email is not authorized.",
  Configuration: "Server configuration error. Contact administrator.",
  Verification: "Verification link expired. Please try again.",
  Default: "Login error. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? errorMessages[error] ?? errorMessages.Default
    : null;

  return (
    <div className="w-[640px] max-w-[90vw] mx-6 login-card-enter">
      {/* Card -- glass + animated glow border */}
      <div className="login-glow-breathe login-shimmer relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-12 py-10 shadow-2xl backdrop-blur-xl">
        {/* Top border glow line */}
        <div className="absolute inset-x-0 -top-px mx-8 h-px bg-gradient-to-r from-transparent via-[#4a9ece]/60 to-transparent" />
        {/* Bottom border glow line */}
        <div className="absolute inset-x-0 -bottom-px mx-12 h-px bg-gradient-to-r from-transparent via-[#4a9ece]/20 to-transparent" />
        {/* Left border glow */}
        <div className="absolute inset-y-0 -left-px my-12 w-px bg-gradient-to-b from-transparent via-[#4a9ece]/15 to-transparent" />
        {/* Right border glow */}
        <div className="absolute inset-y-0 -right-px my-12 w-px bg-gradient-to-b from-transparent via-[#4a9ece]/15 to-transparent" />

        {/* Card inner corner glow */}
        <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-[#4a9ece]/[0.07] blur-[60px]" />
        <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-[#4a9ece]/[0.05] blur-[60px]" />

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Image
                src="/logo-white.svg"
                alt="AI SDR"
                width={150}
                height={38}
                priority
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-24 bg-[#4a9ece]/10 blur-[12px] rounded-full" />
            </div>
          </div>
          <p className="text-sm tracking-[0.25em] uppercase text-[#6b8ca8] font-medium">
            AI SDR Dashboard
          </p>
        </div>

        {/* Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-white/[0.06]" />
          <span className="text-[11px] text-[#5a8aaa] uppercase tracking-widest font-medium">
            Sign in
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/[0.08] to-white/[0.06]" />
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm">
            <p className="font-medium text-red-400">Login failed</p>
            <p className="mt-1 text-red-400/80">{errorMessage}</p>
            {error === "AccessDenied" && (
              <p className="mt-1 text-xs text-red-400/60">
                Please try again with a different Google account.
              </p>
            )}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="group relative w-full cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3.5 text-sm font-medium text-[#c8dae8] transition-all duration-300 hover:border-[#4a9ece]/40 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_40px_-5px_rgba(74,158,206,0.25)]"
          >
            <span className="absolute inset-x-0 -bottom-px mx-6 h-px bg-gradient-to-r from-transparent via-[#4a9ece]/0 to-transparent transition-all duration-300 group-hover:via-[#4a9ece]/50" />
            <span className="absolute inset-x-0 -top-px mx-6 h-px bg-gradient-to-r from-transparent via-[#4a9ece]/0 to-transparent transition-all duration-300 group-hover:via-[#4a9ece]/20" />
            <span className="flex items-center justify-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {error ? "Sign in with a different account" : "Sign in with Google"}
            </span>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-[#3a5a74]">
            AI SDR Dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
