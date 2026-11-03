import { ExpoPushAdapter } from "./expo-push.adapter";

const TOKEN = "ExponentPushToken[abc123]";

function expo(reply: (body: unknown[]) => Response | Promise<Response>) {
  const calls: { body: unknown[]; headers: Record<string, string> }[] = [];
  const fetchImpl = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as unknown[];
    calls.push({ body, headers: init?.headers as Record<string, string> });
    return reply(body);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("ExpoPushAdapter", () => {
  it("accepts Expo push tokens only", () => {
    const adapter = new ExpoPushAdapter();
    expect(adapter.accepts(TOKEN)).toBe(true);
    expect(adapter.accepts("ExpoPushToken[x-Y_9]")).toBe(true);
    for (const t of ["", "fcm-token", "ExponentPushToken[]", "ExponentPushToken[a b]"]) expect(adapter.accepts(t)).toBe(false);
  });

  it("sends in batches of 100 and maps each ticket, flagging dead devices", async () => {
    const { calls, fetchImpl } = expo((body) =>
      Response.json({ data: body.map((_, i) => (i === 1 ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: `t${i}` })) }),
    );
    const adapter = new ExpoPushAdapter("secret", fetchImpl);
    const messages = Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[t${i}]`, title: "Hi", data: { href: "/p/1" } }));
    const outcomes = await adapter.send(messages);

    expect(calls.map((c) => c.body.length)).toEqual([100, 50]);
    expect(calls[0]!.headers.Authorization).toBe("Bearer secret");
    expect(calls[0]!.body[0]).toMatchObject({ to: "ExponentPushToken[t0]", title: "Hi", data: { href: "/p/1" } });
    expect(outcomes).toHaveLength(150);
    expect(outcomes[1]).toEqual({ ok: false, unregistered: true, error: "DeviceNotRegistered" });
    expect(outcomes[101]).toEqual({ ok: false, unregistered: true, error: "DeviceNotRegistered" });
    expect(outcomes[0]).toEqual({ ok: true });
  });

  it("without an access token sends no Authorization header", async () => {
    const { calls, fetchImpl } = expo((body) => Response.json({ data: body.map(() => ({ status: "ok" })) }));
    await new ExpoPushAdapter(undefined, fetchImpl).send([{ token: TOKEN, title: "Hi" }]);
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it("an HTTP error or a network failure fails the batch without calling the tokens dead", async () => {
    for (const reply of [() => new Response("busy", { status: 503 }), () => Promise.reject(new Error("ECONNRESET"))]) {
      const { fetchImpl } = expo(reply);
      const [outcome] = await new ExpoPushAdapter(undefined, fetchImpl).send([{ token: TOKEN, title: "Hi" }]);
      expect(outcome).toMatchObject({ ok: false, unregistered: false });
    }
  });
});
