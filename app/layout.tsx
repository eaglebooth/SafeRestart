import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";

export const metadata: Metadata = { title: "SafeRestart | Equipment Restart Permit", description: "AI-governed restart clearance on GenLayer" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
