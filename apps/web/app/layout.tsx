import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SideQuest Party",
  description: "Experiências compartilhadas entre amigos em endereços diferentes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
