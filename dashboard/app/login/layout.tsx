import type { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060a0d]">
      {/* 배경 그리드 패턴 */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(170,186,202,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(170,186,202,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* 오로라 밴드 1 */}
      <div
        className="login-aurora absolute -top-1/4 left-0 h-[60%] w-[150%] opacity-30"
        style={{
          background:
            "linear-gradient(135deg, transparent 20%, rgba(10,74,110,0.4) 35%, rgba(74,158,206,0.2) 50%, rgba(26,58,92,0.3) 65%, transparent 80%)",
          filter: "blur(80px)",
        }}
      />

      {/* 오로라 밴드 2 */}
      <div
        className="login-aurora-2 absolute -bottom-1/4 right-0 h-[50%] w-[130%] opacity-20"
        style={{
          background:
            "linear-gradient(225deg, transparent 25%, rgba(20,100,160,0.3) 40%, rgba(100,180,230,0.15) 50%, rgba(10,50,80,0.25) 60%, transparent 75%)",
          filter: "blur(60px)",
        }}
      />

      {/* 글로우 오브 — 상단 좌측 */}
      <div className="login-pulse absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-[#0a4a6e] opacity-20 blur-[120px]" />

      {/* 글로우 오브 — 하단 우측 */}
      <div className="login-pulse-delayed absolute -right-32 -bottom-32 h-[400px] w-[400px] rounded-full bg-[#1a3a5c] opacity-15 blur-[100px]" />

      {/* 중앙 미묘한 글로우 */}
      <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0d2847] opacity-20 blur-[150px]" />

      {/* 떠다니는 파티클 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
      </div>

      {/* 비네트 효과 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#060a0d_70%)]" />

      {/* 콘텐츠 */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
