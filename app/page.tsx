import DashboardClient, { type Task as ClientTask } from '../components/DashboardClient';
import { cookies as nextCookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let userEmail = '';
  let userId: string | null = null;
  let tasks = [] as ClientTask[];

  try {
    const supabase = createServerComponentClient({ cookies: nextCookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userEmail = user.email || '';
      userId = user.id;
      
      // Fetch tasks directly from Supabase with timeout
      try {
        const tasksPromise = supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1500)
        );
        
        const result = await Promise.race([tasksPromise, timeoutPromise]);
        if ('data' in result && result.data) {
          tasks = result.data.map(t => ({
            id: t.id,
            status: t.status || 'unknown',
            created_at: t.created_at,
            backend: t.backend || t.model_id || null,
            video_url: t.video_url || null,
            audio_url: t.audio_url || null,
            output_url: t.output_url || null,
            user_id: t.user_id || null
          }));
        }
      } catch {
        // Timeout or error, continue with empty tasks
      }
    }
  } catch {
    // If auth lookup fails, treat as unauthenticated
  }

  return (
    <DashboardClient initialTasks={tasks} initialUserEmail={userEmail} />
  );
}