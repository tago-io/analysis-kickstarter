/**
 * Temperature unit identifier used across widgets.
 * - `"F"` — Fahrenheit (native unit of the incoming TagoIO payload)
 * - `"C"` — Celsius
 */
type TempUnit = "F" | "C";

/**
 * Converts a Fahrenheit value to Celsius.
 *
 * @param f - Temperature in Fahrenheit.
 * @returns Equivalent temperature in Celsius.
 */
function _fahrenheitToCelsius(f: number): number {
  return (f - 32) * (5 / 9);
}

/**
 * Resolves the temperature unit configured for the current TagoIO Run user.
 *
 * The unit key inside `customPreferences` is admin-defined and unpredictable
 * (TagoIO returns the field id and value rather than the field name), so we
 * ignore the keys and scan every entry's value. Recognized values:
 * - Celsius:    `"c"`, `"°c"`, `"celsius"`
 * - Fahrenheit: `"f"`, `"°f"`, `"fahrenheit"`
 *
 * Defaults to `"F"` when no recognizable preference is found — that matches
 * the native unit of the incoming payload.
 *
 * @param customPreferences - `customPreferences` map from `useUserInformation()`.
 * @returns The resolved {@link TempUnit}.
 */
export function resolveTempUnit(customPreferences: Record<string, string>): TempUnit {
  for (const [_, value] of Object.entries(customPreferences)) {
    const v = String(value).trim().toLowerCase();
    if (v === "c" || v === "°c" || v === "celsius") {
      return "C";
    }
    if (v === "f" || v === "°f" || v === "fahrenheit") {
      return "F";
    }
  }
  return "F";
}

/**
 * A temperature value paired with its display unit symbol.
 */
export interface NormalizedTemp {
  value: number;
  unit: "°F" | "°C";
}

/**
 * Converts a raw temperature reading to the target unit, regardless of the
 * unit the device originally reported.
 *
 * The source unit is inferred from `rawUnit` (case-insensitive — any string
 * containing "c" is treated as Celsius; everything else as Fahrenheit). The
 * result includes the unit symbol (`"°C"` or `"°F"`) suitable for direct
 * rendering.
 *
 * @param rawValue - Raw numeric value from the TagoIO record.
 * @param rawUnit  - Unit string from the TagoIO record (`record.unit`). Optional.
 * @param target   - Desired output unit.
 * @returns Normalized value plus its display unit symbol.
 */
export function normalizeTemperature(rawValue: number, rawUnit: string | undefined, target: TempUnit): NormalizedTemp {
  const sourceIsCelsius = (rawUnit ?? "").trim().toLowerCase().includes("c");
  const sourceInF = sourceIsCelsius ? rawValue * (9 / 5) + 32 : rawValue;
  if (target === "C") {
    return { value: _fahrenheitToCelsius(sourceInF), unit: "°C" };
  }
  return { value: sourceInF, unit: "°F" };
}

/**
 * Returns the `{ min, max }` range used to size a temperature gauge axis,
 * adjusted to the requested unit.
 *
 * Ranges are tuned for cold-room monitoring:
 * - Fahrenheit: `-40` to `60`
 * - Celsius:    `-40` to `16`
 *
 * @param unit - Unit of the value that will be rendered on the gauge.
 * @returns Gauge range with `min` and `max` in the requested unit.
 */
export function gaugeRange(unit: TempUnit): { min: number; max: number } {
  if (unit === "C") {
    return { min: -40, max: 16 };
  }
  return { min: -40, max: 60 };
}

/**
 * Maps a Fahrenheit temperature to a semantic color tone for status UI.
 *
 * Thresholds (inclusive upper bounds, in °F):
 * - `<= 0`  → `"blue"`   (frozen)
 * - `<= 20` → `"green"`  (cold-room target)
 * - `<= 40` → `"orange"` (warming)
 * - `> 40`  → `"red"`    (out of range)
 *
 * Always pass the value in Fahrenheit — convert with {@link normalizeTemperature}
 * first if your source data is in Celsius.
 *
 * @param valueInF - Temperature in Fahrenheit.
 * @returns A color tone token to drive UI styling.
 */
export function tempTone(valueInF: number): "blue" | "green" | "orange" | "red" {
  if (valueInF <= 0) {
    return "blue";
  }
  if (valueInF <= 20) {
    return "green";
  }
  if (valueInF <= 40) {
    return "orange";
  }
  return "red";
}
