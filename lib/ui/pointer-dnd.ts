'use client';

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export const DROP_TARGET_ATTR = 'data-drop-target';
const TOUCH_DRAG_THRESHOLD_PX = 10;

export type DragGhost = {
  label: string;
  high?: boolean;
  x: number;
  y: number;
};

export function findDropTargetKey(
  clientX: number,
  clientY: number,
  attr: string = DROP_TARGET_ATTR
): string | null {
  if (typeof document === 'undefined') return null;
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el?.closest(`[${attr}]`) as HTMLElement | null;
  return cell?.getAttribute(attr) || null;
}

type TouchDragRef = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  label: string;
  high: boolean;
};

/**
 * Shared board drag: HTML5 for mouse, pointer path for touch/pen (iOS/Android).
 * Targets must set data-drop-target="{key}".
 */
export function usePointerBoardDrag(opts: {
  onDrop: (id: string, targetKey: string) => void;
  /** Called when a drag starts (optional) */
  onDragBegin?: (id: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const touchRef = useRef<TouchDragRef | null>(null);
  const movedRef = useRef(false);
  const onDropRef = useRef(opts.onDrop);
  const onDragBeginRef = useRef(opts.onDragBegin);
  onDropRef.current = opts.onDrop;
  onDragBeginRef.current = opts.onDragBegin;

  const setTarget = useCallback((key: string | null) => {
    dropTargetRef.current = key;
    setDropTargetKey(key);
  }, []);

  const clearDragUi = useCallback(() => {
    setDraggingId(null);
    setTarget(null);
    setGhost(null);
    touchRef.current = null;
  }, [setTarget]);

  const commitDrop = useCallback(
    (id: string, targetKey: string | null) => {
      clearDragUi();
      if (!targetKey) return;
      movedRef.current = true;
      onDropRef.current(id, targetKey);
    },
    [clearDragUi]
  );

  function didJustDrag(): boolean {
    if (movedRef.current) {
      movedRef.current = false;
      return true;
    }
    return false;
  }

  function onHtml5DragStart(e: DragEvent, id: string, mime = 'text/plain') {
    movedRef.current = false;
    setDraggingId(id);
    onDragBeginRef.current?.(id);
    e.dataTransfer.setData(mime, id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onHtml5DragEnd() {
    clearDragUi();
  }

  function onHtml5DragOverTarget(e: DragEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetRef.current !== key) setTarget(key);
  }

  function onHtml5DragLeaveTarget(e: DragEvent, key: string) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    if (dropTargetRef.current === key) setTarget(null);
  }

  function onHtml5DropTarget(e: DragEvent, key: string, mime = 'text/plain') {
    e.preventDefault();
    e.stopPropagation();
    const id =
      e.dataTransfer.getData(mime) || e.dataTransfer.getData('text/plain');
    if (!id) {
      clearDragUi();
      return;
    }
    commitDrop(id, key);
  }

  function onPointerDownChip(
    e: ReactPointerEvent,
    id: string,
    meta: { label: string; high?: boolean }
  ) {
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    touchRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      label: meta.label,
      high: Boolean(meta.high),
    };
  }

  function onPointerMoveChip(e: ReactPointerEvent) {
    const pd = touchRef.current;
    if (!pd || pd.pointerId !== e.pointerId) return;
    const dx = e.clientX - pd.startX;
    const dy = e.clientY - pd.startY;
    if (!pd.active) {
      if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) return;
      pd.active = true;
      movedRef.current = false;
      setDraggingId(pd.id);
      onDragBeginRef.current?.(pd.id);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    e.preventDefault();
    setGhost({
      label: pd.label,
      high: pd.high,
      x: e.clientX,
      y: e.clientY,
    });
    setTarget(findDropTargetKey(e.clientX, e.clientY));
  }

  function onPointerUpChip(e: ReactPointerEvent): 'tap' | 'drop' | 'cancel' {
    const pd = touchRef.current;
    touchRef.current = null;
    setGhost(null);
    if (!pd || pd.pointerId !== e.pointerId) return 'cancel';
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!pd.active) {
      clearDragUi();
      return 'tap';
    }
    const key =
      dropTargetRef.current || findDropTargetKey(e.clientX, e.clientY);
    commitDrop(pd.id, key);
    return 'drop';
  }

  return {
    draggingId,
    dropTargetKey,
    ghost,
    didJustDrag,
    onHtml5DragStart,
    onHtml5DragEnd,
    onHtml5DragOverTarget,
    onHtml5DragLeaveTarget,
    onHtml5DropTarget,
    onPointerDownChip,
    onPointerMoveChip,
    onPointerUpChip,
    clearDragUi,
  };
}
