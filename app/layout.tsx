import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalHeader from "@/components/GlobalHeader";
import { ThemeProvider } from "@/components/builder/core/hooks/useThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boxstock — Mini-Z Track Builder",
  description: "Build, share, and import Mini-Z RC track layouts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ display: 'flex', flexDirection: 'column', height: '100vh', margin: 0, overflow: 'hidden' }}
      >
        <ThemeProvider>
          <GlobalHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
