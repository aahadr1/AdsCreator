import './globals.css'
import { LayoutWrapper } from '../components/LayoutWrapper';
import { AuthGate } from '../components/AuthGate';
import { SubscriptionGate } from '../components/SubscriptionGate';
import { CreditProvider } from '../lib/creditContext';

export const metadata = {
  title: "AdzCreator - AI-Powered Content Creation Platform",
  description: "Create studio-quality ads and content with AI lipsync, video generation, auto-editing, and 15+ powerful tools. No experience required.",
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
            <CreditProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </CreditProvider>
          </SubscriptionGate>
        </AuthGate>
      </body>
    </html>
  );
}
