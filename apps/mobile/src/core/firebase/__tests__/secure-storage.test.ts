import { secureKey } from "../secure-storage";

describe("secureKey", () => {
  it("turns Firebase's keys into ones SecureStore accepts, without collisions", () => {
    const key = secureKey("firebase:authUser:AIzaKey:[DEFAULT]");
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(secureKey("a:b")).not.toBe(secureKey("a_b"));
    expect(secureKey("plain.key-1_x")).toBe("plain.key-1_x");
  });
});
