import DashboardClient, { type Task as ClientTask } from '../components/DashboardClient';
import { getTasksFast } from '../lib/dashboardData';
import { cookies as nextCookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let userEmail = '';
  let userId: string | null = null;

  try {
    const supabase = createServerComponentClient({ cookies: nextCookies });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
      userEmail = user.email || '';
      userId = user.id;
    }
  } catch {
    // If auth lookup fails, treat as unauthenticated
  }

  let tasks = [] as ClientTask[];
  if (userId) {
    try {
      const t = await getTasksFast(userId, { limit: 50, concurrency: 12 });
      tasks = t as unknown as ClientTask[];
    } catch {
      tasks = [];
    }
  }

  return (
    <DashboardClient initialTasks={tasks} initialUserEmail={userEmail} />
  );
}