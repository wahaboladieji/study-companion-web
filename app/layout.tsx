import type { Metadata } from "next";
import { DM_Sans, Open_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    template: "%s | AI Study Companion",
    default: "AI Study Companion",
  },
  description: "Upload courses and get AI study notes and flashcards instantly. Supercharge your study sessions with AI.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "AI Study Companion",
    title: "AI Study Companion",
    description: "Upload your course materials and let our AI generate comprehensive study notes and smart flashcards instantly.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Study Companion",
    description: "Upload your course materials and let our AI generate comprehensive study notes and smart flashcards instantly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${openSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
