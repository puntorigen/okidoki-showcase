import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Okidoki Showcase",
  description: "Advanced usage examples for Okidoki AI Chat Widget",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 
          Okidoki Chat Widget - Load from CDN
          No app-id set here because each example will call reinitialize() with its own key
        */}
        <script 
          src="https://www.okidoki.chat/embed/okidoki.js"
          async
        />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
