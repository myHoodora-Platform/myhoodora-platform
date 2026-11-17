/**
 * Spotting invite farming (plan WP-E): many sign-ups credited to one person from one phone, or
 * one network. Only hashes are compared, never the device id or IP address itself. Flags are for
 * staff to look at, not automatic punishment: an estate's shared Wi-Fi is normal.
 */
export type InviteFlagReason = "same_device_as_inviter" | "shared_device" | "shared_network";

/** Invitees on one phone (besides the first): almost certainly one person with several accounts. */
export const SHARED_DEVICE_AT = 2;
/** On one network: many Nigerian mobile users share an address (carrier NAT), so only a crowd counts. */
export const SHARED_NETWORK_AT = 5;

export interface FlagInput {
  uid: string;
  inviterUid: string;
  deviceHash?: string;
  ipHash?: string;
}

/** For each flagged invitee, why. `inviterDevices`: each inviter's own device hash, when known. */
export function inviteFlags(invitees: readonly FlagInput[], inviterDevices: ReadonlyMap<string, string | undefined>): Map<string, InviteFlagReason[]> {
  const count = (key: string, m: Map<string, number>) => m.set(key, (m.get(key) ?? 0) + 1);
  const byDevice = new Map<string, number>();
  const byNetwork = new Map<string, number>();
  for (const i of invitees) {
    if (i.deviceHash) count(`${i.inviterUid}|${i.deviceHash}`, byDevice);
    if (i.ipHash) count(`${i.inviterUid}|${i.ipHash}`, byNetwork);
  }
  const out = new Map<string, InviteFlagReason[]>();
  for (const i of invitees) {
    const reasons: InviteFlagReason[] = [];
    const own = inviterDevices.get(i.inviterUid);
    if (i.deviceHash && own && i.deviceHash === own) reasons.push("same_device_as_inviter");
    if (i.deviceHash && (byDevice.get(`${i.inviterUid}|${i.deviceHash}`) ?? 0) >= SHARED_DEVICE_AT) reasons.push("shared_device");
    if (i.ipHash && (byNetwork.get(`${i.inviterUid}|${i.ipHash}`) ?? 0) >= SHARED_NETWORK_AT) reasons.push("shared_network");
    if (reasons.length) out.set(i.uid, reasons);
  }
  return out;
}
