"use client";

import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import { localCalendarDate } from "@/lib/tasks";

const LocalDate = createContext<string | null>(null);

function getToday() { return localCalendarDate(new Date()); }
function getServerToday() { return null; }

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  function scheduleMidnight() {
    clearTimeout(timer);
    const now = new Date();
    // Calendar construction handles short/long days at daylight-saving transitions.
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(refresh, next.getTime() - now.getTime() + 50);
  }
  function refresh() { onChange(); scheduleMidnight(); }
  function onVisibilityChange() {
    if (document.visibilityState === "visible") refresh();
  }
  scheduleMidnight();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export default function LocalDateProvider({ children }: { children: ReactNode }) {
  // One clock per task list. No server clock or shared cache can decide the user's day.
  const today = useSyncExternalStore(subscribe, getToday, getServerToday);
  return <LocalDate.Provider value={today}>{children}</LocalDate.Provider>;
}

export function useLocalDate() { return useContext(LocalDate); }
