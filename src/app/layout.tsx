import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pledgeum Mon bureau des entreprises",
  description: "Gérez vos conventions de stage et PFMP simplement.",
};

import { AuthProvider } from "@/context/AuthContext";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { DemoUI } from "@/components/demo/DemoUI";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ProfileGuard>
            <DemoUI />
            {children}
          </ProfileGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
