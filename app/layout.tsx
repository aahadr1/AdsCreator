import './globals.css'
import { LayoutWrapper } from '../components/LayoutWrapper';

export const metadata = {
  title: "Lipsync App",
  description: "Upload a video + audio and get back a lipsynced video using Sieve",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
