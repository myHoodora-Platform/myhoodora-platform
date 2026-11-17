import { describe, expect, it } from "vitest";
import { androidFingerprints, appleAppSiteAssociation, assetLinks } from "./app-links";

const FP = Array.from({ length: 32 }, () => "AB").join(":");

describe("app link files", () => {
  it("assetlinks names the app with valid fingerprints only, or nothing", () => {
    expect(androidFingerprints(` ${FP.toLowerCase()} , nonsense`)).toEqual([FP]);
    expect(assetLinks([])).toEqual([]);
    expect(assetLinks([FP])[0]).toMatchObject({ target: { namespace: "android_app", package_name: "com.myhoodora.app", sha256_cert_fingerprints: [FP] } });
  });

  it("apple-app-site-association covers the shared pages in both formats", () => {
    const aasa = appleAppSiteAssociation("P8TFVK9UYF");
    expect(aasa.applinks.details[0]).toMatchObject({ appIDs: ["P8TFVK9UYF.com.myhoodora.app"] });
    expect(aasa.applinks.details[1]).toMatchObject({ appID: "P8TFVK9UYF.com.myhoodora.app", paths: expect.arrayContaining(["/p/*", "/i/*"]) });
    expect(JSON.stringify(aasa).length).toBeLessThan(128 * 1024);
  });
});
