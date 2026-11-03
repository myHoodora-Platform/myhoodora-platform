import type { Persistence } from "@firebase/auth";

/**
 * @firebase/auth's React Native build (dist/rn, picked by Metro through the package's "react-native"
 * export condition) exports getReactNativePersistence, but the package's top-level "types" entry,
 * which TypeScript reads first, leaves it out. This declares that one function, as dist/rn/index.rn.d.ts does.
 */
declare module "@firebase/auth" {
  interface ReactNativeAsyncStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
