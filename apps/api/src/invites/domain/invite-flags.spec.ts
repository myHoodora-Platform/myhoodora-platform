import { inviteFlags } from "./invite-flags";

describe("invite flags", () => {
  it("flags sign-ups from the inviter's own phone, several from one phone, and crowds on one network", () => {
    const invitees = [
      { uid: "a", inviterUid: "ada", deviceHash: "ADA-PHONE" },
      { uid: "b", inviterUid: "ada", deviceHash: "P2" },
      { uid: "c", inviterUid: "ada", deviceHash: "P2" },
      ...Array.from({ length: 5 }, (_, i) => ({ uid: `n${i}`, inviterUid: "tunde", deviceHash: `D${i}`, ipHash: "ESTATE-WIFI" })),
      ...Array.from({ length: 4 }, (_, i) => ({ uid: `m${i}`, inviterUid: "kemi", deviceHash: `K${i}`, ipHash: "MTN" })),
      { uid: "z", inviterUid: "bayo", deviceHash: "P2" }, // same phone, different inviter: counted per inviter
    ];
    const flags = inviteFlags(invitees, new Map([["ada", "ADA-PHONE"]]));
    expect(flags.get("a")).toEqual(["same_device_as_inviter"]);
    expect(flags.get("b")).toEqual(["shared_device"]);
    expect(flags.get("c")).toEqual(["shared_device"]);
    expect(flags.get("n0")).toEqual(["shared_network"]);
    expect(flags.has("m0")).toBe(false); // 4 on a carrier network: normal
    expect(flags.has("z")).toBe(false);
  });
});
