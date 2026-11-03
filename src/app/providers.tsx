"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCityStore } from "@/store/useCityStore";

export function Providers({ children }: { children: ReactNode }) {
  const theme = useCityStore((state) => state.theme);
  const [themeInitialized, setThemeInitialized] = useState(false);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos "en tiempo real": refresco periódico y caché razonable.
            staleTime: 60_000,
            refetchInterval: 120_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("berlin-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
      if (savedTheme !== theme) {
        useCityStore.getState().setTheme(savedTheme);
      }
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    setThemeInitialized(true);
  }, []);

  useEffect(() => {
    if (!themeInitialized) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("berlin-theme", theme);
  }, [theme, themeInitialized]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
