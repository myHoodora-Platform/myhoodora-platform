import { SettingsLayout } from "@/features/settings/settings-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
