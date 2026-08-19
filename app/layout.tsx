import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI Gateway",
  description: "OpenAI-compatible internal gateway for chat and embeddings",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
