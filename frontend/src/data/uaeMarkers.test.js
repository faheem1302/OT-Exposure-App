import uaeMarkers from "./uaeMarkers";

test("has exactly 50 markers", () => {
  expect(uaeMarkers).toHaveLength(50);
});

test("all markers have required fields", () => {
  uaeMarkers.forEach(m => {
    expect(m).toHaveProperty("id");
    expect(m).toHaveProperty("name");
    expect(m).toHaveProperty("lat");
    expect(m).toHaveProperty("lng");
    expect(m).toHaveProperty("city");
    expect(m).toHaveProperty("category");
    expect(m).toHaveProperty("description");
  });
});

test("all IDs are unique", () => {
  const ids = uaeMarkers.map(m => m.id);
  expect(new Set(ids).size).toBe(uaeMarkers.length);
});

test("all coordinates are within UAE bounds", () => {
  uaeMarkers.forEach(m => {
    expect(m.lat).toBeGreaterThan(22.0);
    expect(m.lat).toBeLessThan(26.5);
    expect(m.lng).toBeGreaterThan(51.0);
    expect(m.lng).toBeLessThan(57.0);
  });
});

test("all cities are valid UAE emirates", () => {
  const validCities = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
  uaeMarkers.forEach(m => {
    expect(validCities).toContain(m.city);
  });
});
