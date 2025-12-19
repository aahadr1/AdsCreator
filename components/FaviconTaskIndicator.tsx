'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../lib/supabaseClient';

type FaviconState = 'idle' | 'running' | 'success';

const RUNNING_COLOR = '#fb923c'; // orange
const SUCCESS_COLOR = '#22c55e'; // green
const POLL_INTERVAL_MS = 6000;
const SUCCESS_FLASH_MS = 8000;

export function FaviconTaskIndicator() {
  const [userId, setUserId] = useState<string | null>(null);
  const stateRef = useRef<FaviconState>('idle');
  const hadRunningRef = useRef(false);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);
  const baseIconRef = useRef<HTMLImageElement | null>(null);
  const iconCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mountedRef.current) setUserId(user?.id ?? null);
      } catch {
        if (mountedRef.current) setUserId(null);
      }
    };
    void loadUser();
    return () => {
      mountedRef.current = false;
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setFaviconState('idle');
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/tasks/list?user_id=${encodeURIComponent(userId)}&limit=15`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { tasks?: Array<{ status?: string | null }> };
        const tasks = Array.isArray(json.tasks) ? json.tasks : [];
        const running = tasks.some((task) =>
          Boolean(task?.status && /running|processing|queued/i.test(task.status)),
        );
        const hasRecent = tasks.some((task) =>
          Boolean(task?.status && /finished|completed|succeeded/i.test(task.status)),
        );

        if (running) {
          hadRunningRef.current = true;
          setFaviconState('running');
        } else if (hadRunningRef.current && hasRecent) {
          hadRunningRef.current = false;
          setFaviconState('success');
          if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = setTimeout(() => setFaviconState('idle'), SUCCESS_FLASH_MS);
        } else if (!hadRunningRef.current) {
          setFaviconState('idle');
        }
      } catch {
        if (!cancelled) setFaviconState('idle');
      }
    };

    void poll();
    const interval = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  const generateIcon = useMemo(() => {
    const ensureBaseImage = async (): Promise<HTMLImageElement | null> => {
      if (baseIconRef.current) return baseIconRef.current;
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = '/icon.png';
        img.onload = () => {
          baseIconRef.current = img;
          resolve(img);
        };
        img.onerror = () => resolve(null);
      });
    };

    return async (color: string): Promise<string> => {
      const cache = iconCacheRef.current;
      if (cache.has(color)) return cache.get(color)!;

      const base = await ensureBaseImage();
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 32;
        fallbackCanvas.height = 32;
        const fallbackCtx = fallbackCanvas.getContext('2d');
        if (fallbackCtx) {
          fallbackCtx.clearRect(0, 0, 32, 32);
          fallbackCtx.fillStyle = color;
          fallbackCtx.beginPath();
          fallbackCtx.arc(16, 16, 10, 0, Math.PI * 2);
          fallbackCtx.fill();
        }
        const url = fallbackCanvas.toDataURL('image/png');
        cache.set(color, url);
        return url;
      }

      if (base) {
        ctx.drawImage(base, 0, 0, size, size);
      } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AC', size / 2, size / 2);
      }

      const centerX = size / 2;
      const centerY = size - 12;
      ctx.fillStyle = '#0f0f0fd4';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 9, 0, Math.PI * 2);
      ctx.fill();

      const dataUrl = canvas.toDataURL('image/png');
      cache.set(color, dataUrl);
      return dataUrl;
    };
  }, []);

  const setFaviconState = (next: FaviconState) => {
    if (stateRef.current === next) return;
    stateRef.current = next;

    if (next === 'idle') {
      removeDynamicFavicon();
      return;
    }

    const color = next === 'running' ? RUNNING_COLOR : SUCCESS_COLOR;
    void generateIcon(color).then((dataUrl) => applyDynamicFavicon(dataUrl));
  };

  return null;
}

function applyDynamicFavicon(href: string) {
  const head = document.head;
  if (!head) return;
  let link = document.getElementById('favicon-status-indicator') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'favicon-status-indicator';
    link.rel = 'icon';
    link.type = 'image/png';
    head.appendChild(link);
  }
  link.href = href;
}

function removeDynamicFavicon() {
  const link = document.getElementById('favicon-status-indicator');
  if (link && link.parentNode) {
    link.parentNode.removeChild(link);
  }
}
