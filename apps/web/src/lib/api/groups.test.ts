import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import {
  approveRequest,
  canDeleteGroup,
  createGroup,
  createGroupPost,
  deleteGroup,
  getGroup,
  getInviteLink,
  joinGroup,
  leaveGroup,
  listRequests,
  removeMember,
  setMemberRole,
} from "./groups";
import type { CreateGroupInput } from "./types";

// Node has no window.location; the invite link reads the origin.
Object.assign(globalThis, { window: { location: { origin: "http://test" }, dispatchEvent: () => true } });

const admin = { uid: "admin_1" } as User;
const neighbour = { uid: "neighbour_1" } as User;
const HOOD = "hood_test";

const input = (name: string, privacy: CreateGroupInput["privacy"] = "private"): CreateGroupInput => ({
  name,
  description: "A group for testing the rules.",
  category: "estate",
  privacy,
  boundary: "neighbourhood",
});

describe("groups", () => {
  it("makes the creator the first admin", async () => {
    const g = await createGroup(admin, HOOD, input("Road 99 Residents"));
    expect(g).toMatchObject({ isAdmin: true, membership: "member", memberCount: 1, official: false });
  });

  it("rejects a duplicate name in the same neighbourhood", async () => {
    await expect(createGroup(admin, HOOD, input("road 99 residents"))).rejects.toMatchObject({ status: 409 });
  });

  it("limits how many groups one neighbour can create per day", async () => {
    await createGroup(admin, HOOD, input("Second group"));
    await createGroup(admin, HOOD, input("Third group")).catch(() => undefined);
    await expect(createGroup(admin, HOOD, input("One too many"))).rejects.toMatchObject({ status: 429 });
  });

  it("private groups need approval; an invite link skips it", async () => {
    const g = await createGroup({ uid: "admin_2" } as User, HOOD, input("Private test"));
    expect(await joinGroup(neighbour, g)).toBe("requested");
    expect((await listRequests({ uid: "admin_2" } as User, g._id)).map((r) => r.uid)).toEqual([neighbour.uid]);

    const other = { uid: "neighbour_2" } as User;
    const token = new URL(await getInviteLink({ uid: "admin_2" } as User, g._id)).searchParams.get("invite")!;
    expect(await joinGroup(other, g, token)).toBe("member");

    await approveRequest({ uid: "admin_2" } as User, g._id, neighbour.uid);
    expect((await getGroup(neighbour, g._id))?.membership).toBe("member");
    expect((await getGroup(neighbour, g._id))?.memberCount).toBe(3);
  });

  it("only admins can manage; the last admin can't step down or leave", async () => {
    const owner = { uid: "admin_3" } as User;
    const g = await createGroup(owner, HOOD, input("Open test", "open"));
    await joinGroup(neighbour, g);
    await expect(removeMember(neighbour, g._id, owner.uid)).rejects.toMatchObject({ status: 403 });
    await expect(setMemberRole(owner, g._id, owner.uid, "member")).rejects.toMatchObject({ status: 409 });
    await expect(leaveGroup(owner, g._id)).rejects.toMatchObject({ status: 409 });
    await setMemberRole(owner, g._id, neighbour.uid, "admin");
    await expect(leaveGroup(owner, g._id)).resolves.toBeUndefined();
  });

  it("can only be deleted while nobody else has posted", async () => {
    const owner = { uid: "admin_4" } as User;
    const g = await createGroup(owner, HOOD, input("Delete test", "open"));
    await createGroupPost(owner, g._id, "Welcome!");
    expect(canDeleteGroup(g._id, owner.uid)).toBe(true);
    await joinGroup(neighbour, g);
    await createGroupPost(neighbour, g._id, "Hello");
    expect(canDeleteGroup(g._id, owner.uid)).toBe(false);
    await expect(deleteGroup(owner, g._id)).rejects.toMatchObject({ status: 409 });
  });
});
