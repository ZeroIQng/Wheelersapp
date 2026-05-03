import type { RideEstimateResponse } from "@/lib/api";

export function serializeRideEstimate(estimate: RideEstimateResponse): string {
  return encodeURIComponent(JSON.stringify(estimate));
}

export function parseRideEstimateParam(
  value: string | string[] | undefined,
): RideEstimateResponse | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<RideEstimateResponse>;
    if (
      typeof parsed.plannedDistanceKm !== "number" ||
      !Number.isFinite(parsed.plannedDistanceKm) ||
      typeof parsed.plannedDurationSeconds !== "number" ||
      !Number.isFinite(parsed.plannedDurationSeconds) ||
      typeof parsed.fareEstimateUsdt !== "number" ||
      !Number.isFinite(parsed.fareEstimateUsdt)
    ) {
      return null;
    }

    return {
      plannedDistanceKm: parsed.plannedDistanceKm,
      plannedDurationSeconds: parsed.plannedDurationSeconds,
      fareEstimateUsdt: parsed.fareEstimateUsdt,
    };
  } catch {
    return null;
  }
}
