import { describe, it, expect } from "vitest";
import { abbreviate, formatHour, aqiTone, formatNullable, NO_DATA, NO_VALUE } from "./format";
import { EAQI_BANDS } from "./eaqi";

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
});

describe("aqiTone (bandas EAQI)", () => {
  it("clasifica cada banda EAQI con su etiqueta", () => {
    expect(aqiTone(0).label).toBe("Buena");
    expect(aqiTone(19).label).toBe("Buena");
    expect(aqiTone(20).label).toBe("Razonable");
    expect(aqiTone(39).label).toBe("Razonable");
    expect(aqiTone(40).label).toBe("Moderada");
    expect(aqiTone(44).label).toBe("Moderada");
    expect(aqiTone(60).label).toBe("Mala");
    expect(aqiTone(80).label).toBe("Muy mala");
    expect(aqiTone(100).label).toBe("Muy mala");
    expect(aqiTone(101).label).toBe("Extremadamente mala");
    expect(aqiTone(200).label).toBe("Extremadamente mala");
  });

  it("usa el color de la banda EEA y expone la banda de origen", () => {
    for (const b of EAQI_BANDS) {
      const t = aqiTone(b.min);
      expect(t.band).toBe(b);
      expect(t.color).toBe(b.color);
    }
  });

  it("devuelve un tono neutro 'sin datos' para null o no finito", () => {
    for (const v of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const t = aqiTone(v);
      expect(t.label).toBe(NO_DATA);
      expect(t.label).toBe("sin datos");
      expect(t.band).toBeNull();
    }
  });
});

describe("formatNullable", () => {
  it("formatea 0 como '0', no como ausente", () => {
    expect(formatNullable(0)).toBe("0");
    expect(formatNullable(0, { digits: 1, unit: "µg/m³" })).toBe("0.0 µg/m³");
  });

  it("usa 'sin datos' por defecto y 'sin dato' para valores individuales", () => {
    expect(formatNullable(null)).toBe("sin datos");
    expect(formatNullable(undefined)).toBe(NO_DATA);
    expect(formatNullable(Number.NaN)).toBe(NO_DATA);
    expect(formatNullable(null, { empty: NO_VALUE })).toBe("sin dato");
  });

  it("aplica decimales y unidad", () => {
    expect(formatNullable(12.345, { digits: 1 })).toBe("12.3");
    expect(formatNullable(7, { unit: "µg/m³" })).toBe("7 µg/m³");
  });
});
