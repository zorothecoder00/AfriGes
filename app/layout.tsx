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
    <html lang="fr" className="overflow-x-hidden">
      <body
        // overflow-x-hidden (html + body) : garde-fou contre le débordement
        // horizontal (ex. les halos "aurora" décoratifs de
        // app/dashboard/layout.tsx, position:fixed + animés, positionnés
        // relativement à la racine — leur propre overflow-hidden ne suffit pas
        // à empêcher document.documentElement.scrollWidth de s'élargir sur
        // mobile ; il faut le garde-fou sur html ET body — cf. session
        // responsive agent terrain).
        className={`${inter.variable} antialiased overflow-x-hidden`}
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
