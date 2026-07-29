"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

type BannerWork = {
  id: number;
  title: string;
  image: string | null;
};

const AUTO_SCROLL_PX_PER_FRAME = 0.5;

export function ScrollingWorksBanner({ works }: { works: BannerWork[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);

  const wrapScroll = useCallback((el: HTMLDivElement) => {
    const halfWidth = el.scrollWidth / 2;
    if (el.scrollLeft >= halfWidth) {
      el.scrollLeft -= halfWidth;
    } else if (el.scrollLeft <= 0) {
      el.scrollLeft += halfWidth;
    }
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || works.length === 0) return;

    let frameId: number;
    function tick() {
      if (!el) return;
      if (!pausedRef.current && !draggingRef.current) {
        el.scrollLeft += AUTO_SCROLL_PX_PER_FRAME;
        wrapScroll(el);
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [works.length, wrapScroll]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    draggingRef.current = true;
    dragStartXRef.current = event.clientX;
    dragStartScrollRef.current = el.scrollLeft;
    el.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = dragStartScrollRef.current - (event.clientX - dragStartXRef.current);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const el = trackRef.current;
    if (el) {
      wrapScroll(el);
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
    wrapScroll(el);
  }

  if (works.length === 0) return null;

  const loopedWorks = [...works, ...works];

  return (
    <div
      ref={trackRef}
      className="flex w-full cursor-grab touch-pan-x select-none gap-4 overflow-x-auto [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
    >
      {loopedWorks.map((work, index) => (
        <Link
          key={`${work.id}-${index}`}
          href={`/boutique/${work.id}`}
          draggable={false}
          className="h-[320px] flex-none sm:h-[420px] lg:h-[520px]"
        >
          {work.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={work.image}
              alt={work.title}
              draggable={false}
              className="h-full w-auto"
            />
          ) : (
            <div
              className="flex h-full w-[320px] items-center justify-center text-xs uppercase tracking-widest text-zinc-400 sm:w-[420px] lg:w-[520px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
              }}
            >
              {work.title}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
