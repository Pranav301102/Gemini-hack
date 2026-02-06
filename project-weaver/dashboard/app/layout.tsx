import type { Metadata } from "next";
import "./globals.css";
import "./style.css";

export const metadata: Metadata = {
  title: "Project Weaver - AI Software Agency Dashboard",
  description: "Observability dashboard for the Project Weaver AI Software Agency",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
