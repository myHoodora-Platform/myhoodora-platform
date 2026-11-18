import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { rememberInviteRef } from "@/core/invites/invite-ref";
import { BrandedLoading } from "@/shared/ui/branded-loading";

/**
 * myhoodora://i/<code> (and, once app links ship, https://myhoodora.com/i/<code>): a neighbour's
 * invite. Keeps the code until they've signed up, then carries on to wherever this session belongs.
 */
export default function InviteLink() {
  const { code, src } = useLocalSearchParams<{ code: string; src?: string }>();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void rememberInviteRef(code, src === "qr" ? "qr" : "link").finally(() => setSaved(true));
  }, [code, src]);
  if (!saved) return <BrandedLoading message="Opening your invite…" />;
  return <Redirect href="/" />;
}
