import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { gaugeRange, normalizeTemperature, resolveTempUnit, tempTone } from "./temperature.ts";

describe("resolveTempUnit function", () => {
  it("should default to Fahrenheit when preferences are empty", () => {
    assertEquals(resolveTempUnit({}), "F");
  });

  it("should default to Fahrenheit when no temp-related key exists", () => {
    assertEquals(resolveTempUnit({ language: "en", theme: "dark" }), "F");
  });

  it("should resolve Celsius from value 'c'", () => {
    assertEquals(resolveTempUnit({ temperature: "c" }), "C");
  });

  it("should resolve Celsius from value '°C' (case-insensitive)", () => {
    assertEquals(resolveTempUnit({ temperature: "°C" }), "C");
  });

  it("should resolve Celsius from value 'Celsius'", () => {
    assertEquals(resolveTempUnit({ temperature: "Celsius" }), "C");
  });

  it("should resolve Fahrenheit from value 'f'", () => {
    assertEquals(resolveTempUnit({ temperature: "f" }), "F");
  });

  it("should resolve Fahrenheit from value 'Fahrenheit'", () => {
    assertEquals(resolveTempUnit({ temp_unit: "Fahrenheit" }), "F");
  });

  it("should match any key containing 'temp' (case-insensitive)", () => {
    assertEquals(resolveTempUnit({ TempUnit: "c" }), "C");
  });

  it("should default to Fahrenheit when temp value is unrecognized", () => {
    assertEquals(resolveTempUnit({ temperature: "kelvin" }), "F");
  });
});

describe("normalizeTemperature function", () => {
  it("should keep value when source and target are both Fahrenheit", () => {
    assertEquals(normalizeTemperature(70, "°F", "F"), { value: 70, unit: "°F" });
  });

  it("should convert Fahrenheit to Celsius", () => {
    assertEquals(normalizeTemperature(32, "°F", "C"), { value: 0, unit: "°C" });
  });

  it("should convert Celsius to Fahrenheit", () => {
    assertEquals(normalizeTemperature(0, "°C", "F"), { value: 32, unit: "°F" });
  });

  it("should keep value when source and target are both Celsius", () => {
    assertEquals(normalizeTemperature(20, "°C", "C"), { value: 20, unit: "°C" });
  });

  it("should treat missing rawUnit as Fahrenheit (payload default)", () => {
    assertEquals(normalizeTemperature(50, undefined, "F"), { value: 50, unit: "°F" });
  });

  it("should detect Celsius source from any unit string containing 'c'", () => {
    assertEquals(normalizeTemperature(100, "celsius", "F"), { value: 212, unit: "°F" });
  });

  it("should be case-insensitive when detecting source unit", () => {
    assertEquals(normalizeTemperature(0, "C", "F"), { value: 32, unit: "°F" });
  });
});

describe("gaugeRange function", () => {
  it("should return Fahrenheit range for unit 'F'", () => {
    assertEquals(gaugeRange("F"), { min: -40, max: 60 });
  });

  it("should return Celsius range for unit 'C'", () => {
    assertEquals(gaugeRange("C"), { min: -40, max: 16 });
  });
});

describe("tempTone function", () => {
  it("should return 'blue' for sub-zero Fahrenheit", () => {
    assertEquals(tempTone(-10), "blue");
  });

  it("should return 'blue' at the 0°F boundary", () => {
    assertEquals(tempTone(0), "blue");
  });

  it("should return 'green' between 0°F and 20°F", () => {
    assertEquals(tempTone(15), "green");
  });

  it("should return 'green' at the 20°F boundary", () => {
    assertEquals(tempTone(20), "green");
  });

  it("should return 'orange' between 20°F and 40°F", () => {
    assertEquals(tempTone(30), "orange");
  });

  it("should return 'orange' at the 40°F boundary", () => {
    assertEquals(tempTone(40), "orange");
  });

  it("should return 'red' above 40°F", () => {
    assertEquals(tempTone(50), "red");
  });
});
