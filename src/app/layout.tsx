import type { Metadata } from "next";
import "./globals.css";
import { PrmProvider } from "@/context/PrmContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "R-PRM | Partner Relationship Management Cloud",
  description: "Full-featured Blue R-PRM platform cloned from Kiflo PRM specification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PrmProvider>
          <AppShell>{children}</AppShell>
        </PrmProvider>
      </body>
    </html>
  );
}
