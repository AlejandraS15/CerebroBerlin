import { describe, expect, it, vi } from "vitest";

const safeFetchJson = vi.fn();

vi.mock("@/lib/http", () => ({ safeFetchJson }));

describe("fetchTrafficReports", () => {
  it("normaliza eventos live y descarta coordenadas fuera de Berlín", async () => {
    safeFetchJson.mockResolvedValueOnce({
      data: {
        observed_at: "2026-11-03T16:16:17Z",
        payload: {
          events: [
            {
              id: "work-1",
              type: "MaintenanceWorks",
              comment: "Vollsperrung wegen Leitungsbau",
              latitude: 52.52,
              longitude: 13.38,
            },
            {
              id: "outside",
              type: "Accident",
              comment: "outside",
              latitude: 48.14,
              longitude: 11.58,
            },
          ],
        },
      },
    });

    const { fetchTrafficReports } = await import("./trafficReports");
    const result = await fetchTrafficReports();

    expect(result.origin).toBe("live");
    expect(result.fetchedAt).toBe("2026-11-03T16:16:17Z");
    expect(result.data).toEqual([
      {
        id: "work-1",
        type: "obra",
        title: "Obra o mantenimiento: Vollsperrung wegen Leitungsbau",
        district: "Berlín",
        position: [13.38, 52.52],
        severity: 3,
        reportedAt: "2026-11-03T16:16:17Z",
      },
    ]);
  });

  it("devuelve unavailable y no inventa eventos cuando la API falla", async () => {
    safeFetchJson.mockResolvedValueOnce(null);

    const { fetchTrafficReports } = await import("./trafficReports");
    const result = await fetchTrafficReports();

    expect(result).toEqual({ data: [], origin: "unavailable", fetchedAt: null });
  });
});
