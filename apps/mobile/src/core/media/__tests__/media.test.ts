import { ApiError } from "@myhoodora/api-contract/errors";
import { MAX_EDGE, resizeFor, UPLOAD_RETRY_DELAY_MS, uploadWithRetry } from "../media";

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

describe("uploadWithRetry", () => {
  const uploaded = { id: "m1", url: "https://res.cloudinary.com/x/photo.jpg" };
  const wait = jest.fn(async () => undefined);
  beforeEach(() => wait.mockClear());

  it.each([
    ["the connection dropped", new ApiError("We can't reach myHoodora right now. Try again in a moment.", 0, "network")],
    ["the API restarting", new ApiError("Something went wrong on our side.", 503, "server")],
  ])("tries once more, after a pause, when %s", async (_why, blip) => {
    const send = jest.fn().mockRejectedValueOnce(blip).mockResolvedValueOnce(uploaded);
    await expect(uploadWithRetry(send, wait)).resolves.toEqual(uploaded);
    expect(send).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(UPLOAD_RETRY_DELAY_MS);
  });

  it("gives up after the second try, with that try's error", async () => {
    const again = new ApiError("We can't reach myHoodora right now. Try again in a moment.", 0, "network");
    const send = jest.fn().mockRejectedValue(again);
    await expect(uploadWithRetry(send, wait)).rejects.toBe(again);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["the API said no", new ApiError("That file is too big.", 413, "client")],
    ["a timeout (they've already waited)", new ApiError("This is taking longer than usual.", 0, "timeout")],
    ["being offline", new ApiError("You're offline.", 0, "offline")],
    ["something that isn't an API error", new Error("Could not read the photo")],
  ])("doesn't try again after %s", async (_why, failure) => {
    const send = jest.fn().mockRejectedValue(failure);
    await expect(uploadWithRetry(send, wait)).rejects.toBe(failure);
    expect(send).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
