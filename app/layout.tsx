import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionWrapper } from "@/components/SessionWrapper";
import ToastProvider from "@/components/ToastProvider";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { appUrl } from "@/lib/email";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: "AfriGes",
  description: "AfriGes — Plateforme de gestion AfriSime",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${inter.variable} antialiased`}
      >
        <SessionWrapper>
          <AppSettingsProvider>

            <ToastProvider/>

            {children}
            
          </AppSettingsProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
