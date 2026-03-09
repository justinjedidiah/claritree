import { useState, useEffect, useRef, useCallback } from "react";
import FinanceGraph from "../components/FinanceGraph";
import ChatPanel from "../components/ChatPanel";
import TopContainer from "../components/TopContainer";
import { useFocusStore } from "../stores/useFocusStore";
import { fetchFilterOptions } from "../engine/graph";

export interface DashboardProps {
  period: string;
  report: string | null;
}

// desktop (because chat is on the right, we resize only the width)
const MIN_WIDTH = 20;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

// mobile (since on mobile its on the bottom, we resize the height)
const MIN_HEIGHT = 40;
const MAX_HEIGHT_RATIO = 0.85; // 85% of screen height
const DEFAULT_HEIGHT = 340;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function Dashboard() {
  const isMobile = useIsMobile();
  const clearFocus = useFocusStore((s) => s.clearCurrentFocus);

  const [pendingFilters, setPendingFilters] = useState<DashboardProps>({ period: "latest", report: null });
  const [appliedFilters, setAppliedFilters] = useState<DashboardProps>(pendingFilters);
  const [filterOptions, setFilterOptions] = useState<Record<string, any>>({ period: null });
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applied'>('idle');

   // desktop drag state
  const [chatWidth, setChatWidth] = useState(DEFAULT_WIDTH);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  // mobile drag state
  const [chatHeight, setChatHeight] = useState(DEFAULT_HEIGHT);
  const startY = useRef(0);
  const startHeight = useRef(DEFAULT_HEIGHT);

  // shared drag state
  const isDragging = useRef(false);

  useEffect(() => {
    const load = async () => setFilterOptions(await fetchFilterOptions());
    load();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: { key: string }) => { if (e.key === "Escape") clearFocus(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFocus]);

  const handleApply = () => {
    setAppliedFilters(pendingFilters);
    setApplyStatus('applied');
    setTimeout(() => setApplyStatus('idle'), 1500);
  };

  // ── desktop drag (horizontal) ──────────────────────────────────────────────
  const onDragStart = useCallback((clientX: number) => {
    isDragging.current = true;
    startX.current = clientX;
    startWidth.current = chatWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [chatWidth]);

  const onMouseDown = useCallback((e: React.MouseEvent) => onDragStart(e.clientX), [onDragStart]);
  const onTouchStartDesktop = useCallback((e: React.TouchEvent) => onDragStart(e.touches[0].clientX), [onDragStart]);

  // ── mobile drag (vertical) ─────────────────────────────────────────────────
  const onMobileDragStart = useCallback((clientY: number) => {
    isDragging.current = true;
    startY.current = clientY;
    startHeight.current = chatHeight;
    document.body.style.userSelect = "none";
  }, [chatHeight]);

  const onMobileMouseDown = useCallback((e: React.MouseEvent) => onMobileDragStart(e.clientY), [onMobileDragStart]);
  const onMobileTouchStart = useCallback((e: React.TouchEvent) => onMobileDragStart(e.touches[0].clientY), [onMobileDragStart]);
  

  // ── global move/end listeners ──────────────────────────────────────────────
  useEffect(() => {
    const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      if (isMobile) {
        // dragging up = taller (invert delta)
        const delta = startY.current - e.clientY;
        setChatHeight(Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeight.current + delta)));
      } else {
        const delta = startX.current - e.clientX;
        setChatWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();  // stops pull-to-refresh
      if (isMobile) {
        const delta = startY.current - e.touches[0].clientY;
        setChatHeight(Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeight.current + delta)));
      } else {
        const delta = startX.current - e.touches[0].clientX;
        setChatWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
      }
    };

    const onEnd = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isMobile]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 relative">
      {/* graph takes full width — chat overlays on top */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopContainer
          filters={pendingFilters}
          setFilters={setPendingFilters}
          onApply={handleApply}
          filterOptions={filterOptions}
          applyStatus={applyStatus}
        />
        <div
          className="flex-1 relative overflow-hidden"
          // on mobile, shrink graph area so it's not hidden behind the chat sheet
          style={isMobile ? { paddingBottom: chatHeight } : undefined}
        >
          <FinanceGraph filters={appliedFilters} isMobile={isMobile} />
        </div>
      </div>

      {!isMobile && (
        /* spacer to make top container not be overlapped by chat even though graph is*/
        <div style={{ width: chatWidth }} className="shrink-0" />
      )}

      {isMobile ? (
        /* ── MOBILE — bottom sheet ──────────────────────────────────────── */
        <div
          style={{ height: chatHeight }}
          className="absolute bottom-0 left-0 right-0 flex flex-col z-20 pointer-events-none"
        >
          {/* drag handle bar */}
          <div
            onMouseDown={onMobileMouseDown}
            onTouchStart={onMobileTouchStart}
            className="w-full h-5 flex items-center justify-center cursor-row-resize pointer-events-auto bg-white border-t border-gray-200 shrink-0"
          >
            <div className="w-70 h-1 rounded-full bg-gray-300" />
          </div>

          {/* chat panel */}
          <div className="flex-1 pointer-events-auto overflow-hidden shadow-2xl">
            <ChatPanel />
          </div>
        </div>
      ) : (
        /* ── DESKTOP — right overlay ────────────────────────────────────── */
        <div
          style={{ width: chatWidth }}
          className="absolute top-0 right-0 h-full flex z-20 pointer-events-none overflow-hidden"
        >
          {/* drag handle */}
          <div
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStartDesktop}
            className="w-2 h-full cursor-col-resize pointer-events-auto group flex items-center justify-center"
          >
            <div className="w-2 h-16 rounded-full bg-gray-200 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors duration-150" />
          </div>

          {/* chat panel */}
          <div className="flex-1 h-full pointer-events-auto shadow-2xl">
            <ChatPanel />
          </div>
        </div>
      )}
    </div>
  );
}
