import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import { ColorSchemeContext } from "@/shared/theme/theme";

/**
 * How the app looks, chosen per phone in Settings:
 * - surface: the floating chrome (header, tab bar). "glass" shows the content through it, blurred;
 *   "plain" is solid.
 * - theme: follow the phone ("system"), or always light or dark. Our colours come from the resolved
 *   scheme provided here (useTheme), so they change in one render; it is also set on React Native's
 *   Appearance so native pieces (the keyboard, alerts, switches) follow, a moment later on Android.
 */
export type Surface = "glass" | "plain";
export type ThemeChoice = "system" | "light" | "dark";

const SURFACE_KEY = "appearance.surface";
const THEME_KEY = "appearance.theme";
const SURFACES: readonly Surface[] = ["glass", "plain"];
const THEMES: readonly ThemeChoice[] = ["system", "light", "dark"];

interface AppearanceValue {
  surface: Surface;
  setSurface: (s: Surface) => void;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
}

const AppearanceContext = createContext<AppearanceValue>({ surface: "glass", setSurface: () => undefined, theme: "system", setTheme: () => undefined });

function applyTheme(theme: ThemeChoice) {
  Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [surface, setSurfaceState] = useState<Surface>("glass");
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    void AsyncStorage.multiGet([SURFACE_KEY, THEME_KEY])
      .then(([[, s], [, th]]) => {
        if (SURFACES.includes(s as Surface)) setSurfaceState(s as Surface);
        if (THEMES.includes(th as ThemeChoice)) {
          setThemeState(th as ThemeChoice);
          applyTheme(th as ThemeChoice);
        }
      })
      .catch(() => undefined);
  }, []);

  const setSurface = useCallback((s: Surface) => {
    setSurfaceState(s);
    void AsyncStorage.setItem(SURFACE_KEY, s).catch(() => undefined);
  }, []);

  const setTheme = useCallback((th: ThemeChoice) => {
    setThemeState(th);
    applyTheme(th);
    void AsyncStorage.setItem(THEME_KEY, th).catch(() => undefined);
  }, []);

  // With "system" Appearance is unspecified, so this is the phone's own setting.
  const phone = useColorScheme();
  const scheme = theme === "system" ? (phone === "dark" ? "dark" : "light") : theme;

  const value = useMemo(() => ({ surface, setSurface, theme, setTheme }), [surface, setSurface, theme, setTheme]);
  return (
    <AppearanceContext.Provider value={value}>
      <ColorSchemeContext.Provider value={scheme}>{children}</ColorSchemeContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext);
}
