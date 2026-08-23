import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion admin — Blac_Kaleta",
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafaf9] px-6 dark:bg-[#0a0a0a]">
      <div className="mb-8 text-center">
        <p className="text-lg font-bold tracking-wide dark:text-zinc-100">BLAC_KALETA</p>
        <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Tableau de bord admin
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
