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
const ICON_SIZE = 64;
const DOT_RADIUS = 9;
const DOT_CENTER_Y = ICON_SIZE - 2; // place dot slightly below the base icon

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
      const size = ICON_SIZE;
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
      const centerY = DOT_CENTER_Y;
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

    const poll = async () => {
      try {
        const res = await fetch(`/api/tasks/list?user_id=${encodeURIComponent(userId)}&limit=15`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { tasks?: Array<{ status?: string | null }> };
        const tasks = Array.isArray(json.tasks) ? json.tasks : [];
        const running = tasks.some((task) =>
          Boolean(task?.status && /running|processing|queued/i.test(task.status)),
        );

        if (running) {
          hadRunningRef.current = true;
          setFaviconState('running');
        } else if (hadRunningRef.current) {
          hadRunningRef.current = false;
          setFaviconState('success');
          if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = setTimeout(() => setFaviconState('idle'), SUCCESS_FLASH_MS);
        } else {
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
