import type { Metadata, Viewport } from "next";
import { SplashIntro } from "@/components/party/splash-intro";
import "./globals.css";

export const metadata: Metadata = {
  title: "iFood Party",
  description: "Experiências compartilhadas entre amigos em endereços diferentes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c1c1c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><SplashIntro>{children}</SplashIntro></body>
    </html>
  );
}
