'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { supabaseClient as supabase } from '../lib/supabaseClient';

type FaviconState = 'idle' | 'running' | 'success';

const RUNNING_COLOR = '#fb923c'; // orange
const SUCCESS_COLOR = '#22c55e'; // green
const POLL_INTERVAL_MS = 6000;
const SUCCESS_FLASH_MS = 8000;
const ICON_BASE_SIZE = 64;
const DOT_RADIUS = 9;
const DOT_VERTICAL_OFFSET = 14;
const CANVAS_HEIGHT = ICON_BASE_SIZE + DOT_RADIUS * 2 + DOT_VERTICAL_OFFSET;
const RECENT_TASK_WINDOW_MS = 10 * 60 * 1000;

export function FaviconTaskIndicator() {
  const [userId, setUserId] = useState<string | null>(null);
  const stateRef = useRef<FaviconState>('idle');
  const hadRunningRef = useRef(false);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);
  const baseIconRef = useRef<HTMLImageElement | null>(null);
const iconCacheRef = useRef<Map<string, string>>(new Map());
const iconElementsRef = useRef<Array<{ element: HTMLLinkElement; original: string }>>([]);

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
      const size = ICON_BASE_SIZE;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = size;
        fallbackCanvas.height = CANVAS_HEIGHT;
        const fallbackCtx = fallbackCanvas.getContext('2d');
        if (fallbackCtx) {
          fallbackCtx.clearRect(0, 0, size, CANVAS_HEIGHT);
          fallbackCtx.fillStyle = '#0a0a0a';
          fallbackCtx.fillRect(0, 0, size, size);
          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.font = 'bold 28px sans-serif';
          fallbackCtx.textAlign = 'center';
          fallbackCtx.textBaseline = 'middle';
          fallbackCtx.fillText('AC', size / 2, size / 2);
          fallbackCtx.fillStyle = color;
          fallbackCtx.beginPath();
          fallbackCtx.arc(size / 2, size + DOT_VERTICAL_OFFSET, DOT_RADIUS, 0, Math.PI * 2);
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
      const centerY = size + DOT_VERTICAL_OFFSET;
      ctx.fillStyle = '#0f0f0fd4';
      ctx.beginPath();
      ctx.arc(centerX, centerY, DOT_RADIUS + 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      const dataUrl = canvas.toDataURL('image/png');
      cache.set(color, dataUrl);
      return dataUrl;
    };
  }, []);

  const setFaviconState = useCallback((next: FaviconState) => {
    if (stateRef.current === next) return;
    stateRef.current = next;

    if (next === 'idle') {
      removeDynamicFavicon(iconElementsRef);
      return;
    }

    const color = next === 'running' ? RUNNING_COLOR : SUCCESS_COLOR;
    void generateIcon(color).then((dataUrl) => applyDynamicFavicon(dataUrl, iconElementsRef));
  }, [generateIcon]);

  useEffect(() => {
    if (!userId) {
      setFaviconState('idle');
      return;
    }

    let cancelled = false;
    let timeout: any = null;
    let backoffMs = POLL_INTERVAL_MS;

    const isTransientNetworkFailure = (e: unknown): boolean => {
      const msg = e instanceof Error ? e.message : String(e || '');
      return (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('ERR_NETWORK_CHANGED') ||
        msg.includes('ERR_HTTP2_PING_FAILED')
      );
    };

    const poll = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        const res = await fetch(`/api/tasks/list?user_id=${encodeURIComponent(userId)}&limit=all`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as {
          tasks?: Array<{ status?: string | null; created_at?: string | null; updated_at?: string | null }>;
        };
        const tasks = Array.isArray(json.tasks) ? json.tasks : [];
        const now = Date.now();
        const recentThreshold = now - RECENT_TASK_WINDOW_MS;

        const parseTime = (value?: string | null): number => {
          if (!value) return Number.NaN;
          const ts = new Date(value).getTime();
          return Number.isFinite(ts) ? ts : Number.NaN;
        };

        const running = tasks.some((task) => {
          const ts = parseTime(task.updated_at || task.created_at);
          const recentEnough = Number.isFinite(ts) ? ts >= recentThreshold : true;
          const status = String(task?.status || '').toLowerCase();
          return recentEnough && /running|processing|queued|pending|in_progress/.test(status);
        });

        const hasRecentSuccess = tasks.some((task) => {
          const ts = parseTime(task.updated_at || task.created_at);
          const recentEnough = Number.isFinite(ts) ? ts >= recentThreshold : true;
          const status = String(task?.status || '').toLowerCase();
          return recentEnough && /finished|completed|succeeded|success/.test(status);
        });

        if (running) {
          hadRunningRef.current = true;
          setFaviconState('running');
          return;
        }

        if (hadRunningRef.current || hasRecentSuccess) {
          hadRunningRef.current = false;
          setFaviconState('success');
          if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = setTimeout(() => setFaviconState('idle'), SUCCESS_FLASH_MS);
          return;
        }

        setFaviconState('idle');
      } catch (e) {
        // Don't thrash favicon state on transient network issues; just back off.
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn('[FaviconTaskIndicator] Poll failed; backing off');
        }
        throw e;
      }
    };

    const loop = async () => {
      if (cancelled) return;
      try {
        await poll();
        backoffMs = POLL_INTERVAL_MS;
      } catch (e) {
        if (isTransientNetworkFailure(e)) {
          backoffMs = Math.min(60_000, Math.floor(backoffMs * 1.7));
        } else {
          backoffMs = Math.min(60_000, Math.floor(backoffMs * 1.3));
        }
      } finally {
        timeout = setTimeout(loop, backoffMs);
      }
    };

    void loop();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [userId, setFaviconState]);

  return null;
}

function collectIconElements(cacheRef: MutableRefObject<Array<{ element: HTMLLinkElement; original: string }>>) {
  if (cacheRef.current.length > 0) return cacheRef.current;
  const nodes = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
  const collected: Array<{ element: HTMLLinkElement; original: string }> = [];
  nodes.forEach((el) => {
    const existing = collected.find((entry) => entry.element === el);
    if (existing) return;
    collected.push({ element: el, original: el.href });
  });
  cacheRef.current = collected;
  return cacheRef.current;
}

function applyDynamicFavicon(
  href: string,
  iconRef: MutableRefObject<Array<{ element: HTMLLinkElement; original: string }>>,
) {
  const icons = collectIconElements(iconRef);
  if (icons.length === 0) {
    const head = document.head;
    if (!head) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = href;
    head.appendChild(link);
    link.setAttribute('data-original-href', '__remove__');
    iconRef.current.push({ element: link, original: href });
    return;
  }
  icons.forEach(({ element, original }) => {
    if (!element.getAttribute('data-original-href')) {
      element.setAttribute('data-original-href', original);
    }
    element.type = 'image/png';
    element.href = href;
  });
}

function removeDynamicFavicon(
  iconRef: MutableRefObject<Array<{ element: HTMLLinkElement; original: string }>>,
) {
  const icons = iconRef.current;
  icons.forEach(({ element, original }) => {
    if (!element.parentNode) return;
    const originalHrefAttr = element.getAttribute('data-original-href');
    if (originalHrefAttr === '__remove__') {
      element.parentNode.removeChild(element);
      return;
    }
    if (originalHrefAttr) {
      element.href = original;
      element.removeAttribute('data-original-href');
    }
  });
}
