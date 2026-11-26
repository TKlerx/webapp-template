"use client";

import { MantineProvider } from "@mantine/core";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "LIGHT" | "DARK";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const [loadedTheme, setLoadedTheme] = useState(initialTheme);
  if (loadedTheme !== initialTheme) {
    setLoadedTheme(initialTheme);
    setTheme(initialTheme);
  }

  const colorScheme = theme === "DARK" ? "dark" : "light";
  useEffect(() => {
    document.documentElement.dataset.theme = colorScheme;
  }, [colorScheme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider
        defaultColorScheme={initialTheme === "DARK" ? "dark" : "light"}
        forceColorScheme={colorScheme}
      >
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
