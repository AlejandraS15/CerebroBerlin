import { describe, it, expect } from "vitest";
import { abbreviate, formatHour, aqiTone } from "./format";

describe("format utils", () => {
  it("abrevia miles y millones", () => {
    expect(abbreviate(500)).toBe("500");
    expect(abbreviate(1500)).toBe("1.5k");
    expect(abbreviate(2_000_000)).toBe("2.0M");
  });

  it("formatea la hora a HH:00", () => {
    expect(formatHour(0)).toBe("00:00");
    expect(formatHour(9)).toBe("09:00");
    expect(formatHour(23)).toBe("23:00");
  });

  it("clasifica el AQI en categorías con color", () => {
    expect(aqiTone(30).label).toBe("Buena");
    expect(aqiTone(80).label).toBe("Moderada");
    expect(aqiTone(200).label).toBe("Dañina");
  });
});
