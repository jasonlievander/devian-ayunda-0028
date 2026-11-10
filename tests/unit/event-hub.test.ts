import { describe, expect, it } from "vitest";
import { EventHub } from "../../src/http/event-hub";

describe("event hub", () => {
  it("mengirim event ke semua subscriber dan berhenti setelah unsubscribe", () => {
    const hub = new EventHub();
    const first: string[] = [];
    const second: string[] = [];
    const unsubscribeFirst = hub.subscribe((event) => {
      first.push(`${event.type}:${event.data.businessId}`);
    });
    hub.subscribe((event) => {
      second.push(event.type);
    });

    hub.publish("reservation-created", { businessId: "IDB-1" });
    unsubscribeFirst();
    hub.publish("reservation-updated", { businessId: "IDB-1" });

    expect(first).toEqual(["reservation-created:IDB-1"]);
    expect(second).toEqual([
      "reservation-created",
      "reservation-updated",
    ]);
    expect(hub.size).toBe(1);
  });

  it("mengabaikan listener yang gagal agar mutasi tetap berhasil", () => {
    const hub = new EventHub();
    const received: string[] = [];
    hub.subscribe(() => {
      throw new Error("client putus");
    });
    hub.subscribe((event) => received.push(event.type));

    expect(() => hub.publish("reservation-created")).not.toThrow();
    expect(received).toEqual(["reservation-created"]);
  });
});
