import { LEGAL_VERSIONS } from "../../../../../packages/api-contract/src/legal";
import { CURRENT_LEGAL } from "./legal";

describe("legal versions", () => {
  it("the API asks for the newest material version of each document the clients know", () => {
    for (const doc of ["terms", "privacy"] as const) {
      expect(CURRENT_LEGAL[doc]).toBe(LEGAL_VERSIONS[doc].find((v) => v.material)!.version);
    }
  });

  it("versions are dates, newest first, with no duplicates", () => {
    for (const doc of ["terms", "privacy"] as const) {
      const ids = LEGAL_VERSIONS[doc].map((v) => v.version);
      for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect([...ids].sort().reverse()).toEqual(ids);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
