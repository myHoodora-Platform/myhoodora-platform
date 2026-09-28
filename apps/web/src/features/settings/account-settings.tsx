"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Badge } from "@myhoodora/ui/badge";
import { cn } from "@myhoodora/ui/utils";
import { Field, fieldInputClass } from "@/components/shared/field";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { resetUserPassword } from "@/lib/firebase/auth";
import { DEACTIVATION_REASONS, deactivateAccount, type DeactivationReason } from "@/lib/api/settings";
import { SettingsRow, SettingsSection } from "./ui";

const PROVIDER_LABELS: Record<string, string> = {
  password: "Email & password",
  "google.com": "Google",
  "apple.com": "Apple",
};

function DeactivateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<DeactivationReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!user || !reason) return;
    setBusy(true);
    try {
      const done = await deactivateAccount(user, reason, details.trim() || undefined);
      if (done) {
        toast.success("Your account has been deactivated.");
        window.location.href = "/";
      } else {
        toast.info("Preview: account deactivation isn't connected yet, so nothing was changed.");
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't deactivate your account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Deactivate your account?"
      description="Your profile and posts will be hidden from neighbours. Log back in within 30 days to restore everything."
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Why are you leaving?</legend>
          {DEACTIVATION_REASONS.map((r) => (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-muted",
                reason === r.id && "border-primary bg-primary/5",
              )}
            >
              <input type="radio" name="deactivate-reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="size-4 accent-[var(--primary)]" />
              {r.label}
            </label>
          ))}
        </fieldset>
        <Field label="Anything we could do better?" htmlFor="deactivate-details" optional>
          <textarea id="deactivate-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} className={fieldInputClass} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep my account
          </Button>
          <Button onClick={confirm} loading={busy} disabled={!reason} className="bg-destructive shadow-none hover:bg-destructive/90">
            Deactivate
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

export function AccountSettings() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  if (!user) return null;

  const providers = user.providerData.map((p) => p.providerId);
  const hasPassword = providers.includes("password");

  const sendReset = async () => {
    if (!user.email) return;
    setSending(true);
    try {
      await resetUserPassword(user.email);
      toast.success(`We've emailed a password reset link to ${user.email}.`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send the reset email."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSection title="Account" description="How you sign in to myHoodora.">
        <SettingsRow label="Email" description={user.email ?? "No email on this account"}>
          {user.emailVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Not verified</Badge>}
        </SettingsRow>
        <SettingsRow
          label="Sign-in method"
          description={providers.map((p) => PROVIDER_LABELS[p] ?? p).join(" · ") || "Unknown"}
        />
        {hasPassword && (
          <SettingsRow label="Password" description="We'll email you a secure link to set a new password.">
            <Button variant="outline" size="sm" onClick={sendReset} loading={sending}>
              Change password
            </Button>
          </SettingsRow>
        )}
        <SettingsRow
          label="Phone number"
          description="Add a phone number to verify faster and secure your account."
        >
          <Badge variant="secondary">Coming soon</Badge>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Deactivate account" tone="danger">
        <SettingsRow label="Leave myHoodora" description="Hide your profile and posts. You can come back within 30 days.">
          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => setDeactivating(true)}>
            Deactivate
          </Button>
        </SettingsRow>
      </SettingsSection>
      <DeactivateDialog open={deactivating} onOpenChange={setDeactivating} />
    </div>
  );
}
