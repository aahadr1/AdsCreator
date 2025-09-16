import './globals.css'
import { LayoutWrapper } from '../components/LayoutWrapper';
import { AuthGate } from '../components/AuthGate';
import { SubscriptionGate } from '../components/SubscriptionGate';

export const metadata = {
  title: "Lipsync App",
  description: "Upload a video + audio and get back a lipsynced video using Sieve",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthGate>
          <SubscriptionGate>
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
          </SubscriptionGate>
        </AuthGate>
      </body>
    </html>
  );
}
