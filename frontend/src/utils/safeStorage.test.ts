import { describe, test, expect } from "vitest";
import { safeStorage } from "./safeStorage";

describe("SafeStorage utility", () => {
  test("persists string data correctly", () => {
    safeStorage.setItem("myKey", "myValue");
    const data = safeStorage.getItem("myKey");
    expect(data).toBe("myValue");
  });

  test("handles numeric data persistence", () => {
    safeStorage.setItem("numberKey", 123);
    const num = safeStorage.getItem<number>("numberKey");
    expect(num).toBe(123);
  });

  test("correctly saves boolean flags", () => {
    safeStorage.setItem("flagKey", true);
    const flag = safeStorage.getItem<boolean>("flagKey");
    expect(flag).toBe(true);
  });

  test("serializes objects properly", () => {
    const petData = { species: "dog", name: "Buddy" };
    safeStorage.setItem("petInfo", petData);
    const retrieved = safeStorage.getItem<typeof petData>("petInfo");
    expect(retrieved?.species).toBe("dog");
    expect(retrieved?.name).toBe("Buddy");
  });

  test("gives null for missing keys", () => {
    const missing = safeStorage.getItem("doesNotExist123");
    expect(missing).toBeNull();
  });

  test("deletion works properly", () => {
    safeStorage.setItem("tempData", "temporary");
    safeStorage.removeItem("tempData");
    expect(safeStorage.getItem("tempData")).toBeNull();
  });

  test("wipe operation removes everything", () => {
    safeStorage.setItem("item1", "a");
    safeStorage.setItem("item2", "b");
    safeStorage.clear();
    expect(safeStorage.getItem("item1")).toBeNull();
    expect(safeStorage.getItem("item2")).toBeNull();
  });

  test("availability check returns boolean", () => {
    const available = safeStorage.isAvailable();
    expect(typeof available).toBe("boolean");
  });

  test("empty string storage", () => {
    safeStorage.setItem("emptyStr", "");
    expect(safeStorage.getItem("emptyStr")).toBe("");
  });

  test("zero number handling", () => {
    safeStorage.setItem("zeroNum", 0);
    expect(safeStorage.getItem<number>("zeroNum")).toBe(0);
  });

  test("false boolean handling", () => {
    safeStorage.setItem("falseBool", false);
    expect(safeStorage.getItem<boolean>("falseBool")).toBe(false);
  });

  test("array storage functionality", () => {
    const items = ["apple", "banana", "cherry"];
    safeStorage.setItem("fruits", items);
    const result = safeStorage.getItem<string[]>("fruits");
    expect(result?.length).toBe(3);
    expect(result?.[0]).toBe("apple");
  });

  test("nested structure persistence", () => {
    const booking = {
      client: { id: 1, name: "John" },
      dates: { start: "2024-01-01", end: "2024-01-05" }
    };
    safeStorage.setItem("bookingData", booking);
    const loaded = safeStorage.getItem<typeof booking>("bookingData");
    expect(loaded?.client.name).toBe("John");
    expect(loaded?.dates.start).toBe("2024-01-01");
  });
});
