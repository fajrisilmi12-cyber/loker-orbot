import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "lemparjaring",
  description: "Platform lempar jaring kerja multi-portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" richColors theme="system" />
      </body>
    </html>
  );
}
