import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseInstallReferrer } from "../install-referrer";

beforeEach(() => AsyncStorage.clear());

describe("the Play Store install referrer", () => {
  it("reads our invite code, and whether it came from a poster", () => {
    expect(parseInstallReferrer("ref=ADA7K")).toEqual({ code: "ADA7K", via: "link" });
    expect(parseInstallReferrer("ref%3DADA7K%26src%3Dqr")).toEqual({ code: "ADA7K", via: "qr" });
    expect(parseInstallReferrer("utm_source=google-play&utm_medium=organic")).toBeNull();
    expect(parseInstallReferrer("")).toBeNull();
    expect(parseInstallReferrer("%E0%A4%A")).toBeNull();
  });
});

