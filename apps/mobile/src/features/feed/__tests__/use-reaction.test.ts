import type { ApiPost } from "@myhoodora/api-contract/types";
import { nextToSend } from "../reactions";

const post = (myReaction: ApiPost["myReaction"]) => ({ _id: "p", myReaction }) as ApiPost;

describe("nextToSend", () => {
  it("sends nothing while a request is out: the next tap waits for it", () => {
    expect(nextToSend({ wanted: null, confirmed: post("like"), sending: true })).toBeNull();
  });

  it("sends only the latest choice once the API is back", () => {
    expect(nextToSend({ wanted: null, confirmed: post("like"), sending: false })).toEqual({ type: null });
    expect(nextToSend({ wanted: "wow", confirmed: post("like"), sending: false })).toEqual({ type: "wow" });
  });

  it("sends nothing when like, unlike ended where the API already is", () => {
    expect(nextToSend({ wanted: "like", confirmed: post("like"), sending: false })).toBeNull();
    expect(nextToSend({ wanted: null, confirmed: post(null), sending: false })).toBeNull();
  });
});
