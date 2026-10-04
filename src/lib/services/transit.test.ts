import { describe, it, expect } from "vitest";
import { classifyMode, mapDepartures } from "./transit";

describe("classifyMode", () => {
  it("clasifica por producto de transporte", () => {
    expect(classifyMode({ subway: true })).toBe("u");
    expect(classifyMode({ suburban: true })).toBe("s");
    expect(classifyMode({ tram: true })).toBe("tram");
    expect(classifyMode({ bus: true })).toBe("bus");
    expect(classifyMode(undefined)).toBe("u");
  });
});

describe("mapDepartures", () => {
  it("normaliza salidas de VBB (delay en minutos, límite aplicado)", () => {
    const raw = [
      { when: "2026-01-01T10:00:00Z", delay: 120, direction: "Pankow", line: { name: "U2" } },
      { when: null, plannedWhen: "2026-01-01T10:05:00Z", delay: null, direction: "Ruhleben", line: { name: "U2" } },
      { when: "x", delay: -60, direction: "A", line: { name: "S7" } },
      { when: "y", delay: 0, direction: "B", line: { name: "S5" } },
      { when: "z", delay: 300, direction: "C", line: { name: "M10" } },
    ];
    const out = mapDepartures(raw, 4);

    expect(out).toHaveLength(4); // respeta el límite
    expect(out[0]).toEqual({
      line: "U2",
      direction: "Pankow",
      when: "2026-01-01T10:00:00Z",
      delayMin: 2,
    });
    // Usa plannedWhen cuando when es null
    expect(out[1].when).toBe("2026-01-01T10:05:00Z");
    expect(out[1].delayMin).toBeNull();
    // Retraso negativo (adelantado) → -1 min
    expect(out[2].delayMin).toBe(-1);
  });

  it("usa valores por defecto cuando faltan campos", () => {
    const out = mapDepartures([{}], 4);
    expect(out[0]).toEqual({
      line: "—",
      direction: "—",
      when: null,
      delayMin: null,
    });
  });
});
