import { MAX_EDGE, resizeFor } from "../media";

jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("@/core/api/client", () => ({ apiFetch: jest.fn() }));

describe("resizeFor", () => {
  it("leaves photos that are small enough alone", () => {
    expect(resizeFor({ width: 1600, height: 1200 })).toBeNull();
    expect(resizeFor({ width: MAX_EDGE, height: 1000 })).toBeNull();
  });

  it("shrinks the long edge to the limit, keeping the shape", () => {
    expect(resizeFor({ width: 4032, height: 3024 })).toEqual({ width: MAX_EDGE });
    expect(resizeFor({ width: 3024, height: 4032 })).toEqual({ height: MAX_EDGE });
  });
});
