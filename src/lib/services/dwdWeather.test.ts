import { describe, expect, it, vi } from "vitest";
import { buildDwdWeatherUrl, parseDwdObservation } from "./dwdWeather";

const row =
  "03.11.26;16:00;88;---;---;1,1;---;---;---;6,6;---;---;---;7790;36,6;---;---;---;13;---;---;17;40;8;---;---;---;---;---;---;---;---;---;0;---;4;1033,1;68;---;1,7;0;---;---";

describe("DWD weather", () => {
  it("construye el recurso BEOB de una estación", () => {
    expect(buildDwdWeatherUrl("10384")).toContain("/10384-BEOB.csv");
  });

  it("parsea la observación más reciente del CSV DWD", () => {
    const csv = [
      "surface observations;Parameter description",
      "10384;Unit",
      "Datum;Uhrzeit (UTC)",
      row,
    ].join("\n");
    expect(parseDwdObservation(csv, "10384")).toMatchObject({
      stationId: "10384",
      temperature: 6.6,
      humidity: 68,
      windSpeed: 8,
      weatherCode: 4,
    });
  });

  it("rechaza CSV que no tiene cabecera DWD", () => {
    expect(parseDwdObservation("invalid", "10384")).toBeNull();
  });
});
