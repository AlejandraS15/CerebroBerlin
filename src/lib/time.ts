/**
 * Hora local de Berlín, independiente de la zona horaria del navegador o del
 * proceso (Requirement 16). Sin dependencias de React.
 */

/** Indicación de zona horaria mostrada junto a la hora en la línea de tiempo. */
export const BERLIN_TZ_LABEL = "hora de Berlín";

// Zona explícita: el resultado no depende de `process.env.TZ` ni del navegador.
const FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Hora 0–23 en Europe/Berlin, independiente de la zona del navegador. */
export function berlinHour(date: Date = new Date()): number {
  const h = Number(FMT.formatToParts(date).find((p) => p.type === "hour")?.value);
  // `% 24` cubre motores que devuelven "24" a medianoche; respaldo si Intl no tiene datos de zona.
  return Number.isFinite(h) ? h % 24 : date.getUTCHours();
}
