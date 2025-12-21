import './globals.css'
import { LayoutWrapper } from '../components/LayoutWrapper';
import { AuthGate } from '../components/AuthGate';
import { SubscriptionGate } from '../components/SubscriptionGate';
import { CreditProvider } from '../lib/creditContext';
import { TaskStateProvider } from '../components/TaskStateProvider';

export const metadata = {
  title: "AdzCreator - AI-Powered Content Creation Platform",
  description: "Create studio-quality ads and content with AI lipsync, video generation, auto-editing, and 15+ powerful tools. No experience required.",
  icons: {
    icon: [
      { url: "/api/favicon", sizes: "16x16", type: "image/png" },
      { url: "/api/favicon", sizes: "32x32", type: "image/png" },
      { url: "/api/favicon", sizes: "192x192", type: "image/png" },
      { url: "/api/favicon", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" }
    ],
    shortcut: ["/api/favicon", "/icon.png"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <TaskStateProvider>
          <AuthGate>
            <SubscriptionGate>
              <CreditProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
              </CreditProvider>
            </SubscriptionGate>
          </AuthGate>
        </TaskStateProvider>
      </body>
    </html>
  );
}
