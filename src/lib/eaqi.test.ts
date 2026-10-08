import { describe, it, expect } from "vitest";
import { eaqi, eaqiRaw, eaqiBand, subIndex, EAQI_BANDS } from "./eaqi";

describe("EAQI: ejemplos", () => {
  // Requirement 10.4: caso obligatorio.
  it("PM2.5 19,5 + O3 104 → 44", () => {
    // PM2.5: (2 + 4,5/35) × 20 ≈ 42,57; O3: (2 + 4/20) × 20 = 44 → máximo 44.
    expect(subIndex("pm25", 19.5)).toBeCloseTo(42.571, 3);
    expect(subIndex("o3", 104)).toBeCloseTo(44, 10);
    expect(eaqi({ pm25: 19.5, o3: 104 })).toBe(44);
  });

  // Requirement 10.6: sin contaminantes → ausencia de valor.
  it("objeto vacío y todos null → null", () => {
    expect(eaqiRaw({})).toBeNull();
    expect(eaqi({})).toBeNull();
    expect(eaqi({ pm25: null, pm10: null, no2: null, o3: null })).toBeNull();
  });

  it("ignora contaminantes ausentes y usa los disponibles", () => {
    expect(eaqi({ pm25: null, o3: 104 })).toBe(44);
  });
});

describe("EAQI: límites de banda (Requirement 10.5)", () => {
  const cases: Array<[number, string, string]> = [
    [19, "good", "Buena"],
    [20, "fair", "Razonable"],
    [39, "fair", "Razonable"],
    [40, "moderate", "Moderada"],
    [59, "moderate", "Moderada"],
    [60, "poor", "Mala"],
    [79, "poor", "Mala"],
    [80, "veryPoor", "Muy mala"],
    [100, "veryPoor", "Muy mala"],
    [101, "extreme", "Extremadamente mala"],
  ];

  it.each(cases)("%d → %s (%s)", (v, id, label) => {
    const band = eaqiBand(v);
    expect(band?.id).toBe(id);
    expect(band?.label).toBe(label);
  });

  it("0 es Buena y valores negativos también", () => {
    expect(eaqiBand(0)?.id).toBe("good");
    expect(eaqiBand(-5)?.id).toBe("good");
  });

  it("la banda se calcula sobre el entero mostrado", () => {
    expect(eaqiBand(19.4)?.id).toBe("good");
    expect(eaqiBand(19.5)?.id).toBe("fair");
    expect(eaqiBand(100.4)?.id).toBe("veryPoor");
    expect(eaqiBand(100.5)?.id).toBe("extreme");
  });

  it("null o no finito → null", () => {
    expect(eaqiBand(null)).toBeNull();
    expect(eaqiBand(Number.NaN)).toBeNull();
    expect(eaqiBand(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("hay seis bandas con la última abierta por arriba", () => {
    expect(EAQI_BANDS).toHaveLength(6);
    expect(EAQI_BANDS[EAQI_BANDS.length - 1].max).toBeNull();
  });
});
