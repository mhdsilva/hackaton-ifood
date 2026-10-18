import type { Metadata } from "next";
import { SplashIntro } from "@/components/party/splash-intro";
import "./globals.css";

export const metadata: Metadata = {
  title: "iFood Party",
  description: "Experiências compartilhadas entre amigos em endereços diferentes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><SplashIntro>{children}</SplashIntro></body>
    </html>
  );
}
