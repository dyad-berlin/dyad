-- Backfill slots left without neighbourhood coordinates by the retired
-- free-text (manual) location path.
--
-- Manual locations carried lat/lng = 0,0; deriveGeneralArea reverse-geocoded
-- (0,0), Nominatim answered "Unable to geocode", parseFloat produced NaN, and
-- JSON serialization turned NaN into null — so the slot saved with
-- general_area (the region label) but NULL coordinates, making its
-- conversation permanently pinless on the discover map.
--
-- The path is closed (LocationSearch no longer offers free text and
-- validateRegion rejects the manual marker), so this backfill clears the
-- existing stock: give affected slots their region's center as the
-- neighbourhood centroid. The label already reads as the city, and pin
-- positions are privacy-fuzzed anyway, so a city-center centroid is exactly
-- as honest as the "Berlin" label it sits under.
--
-- Region centers mirror the REGIONS registry in src/lib/services/location.ts.

UPDATE time_slots ts
SET
	general_area_lat = CASE p.region WHEN 'amsterdam' THEN 52.37 ELSE 52.52 END,
	general_area_lng = CASE p.region WHEN 'amsterdam' THEN 4.895 ELSE 13.405 END
FROM prompts p
WHERE p.id = ts.prompt_id
	AND (ts.general_area_lat IS NULL OR ts.general_area_lng IS NULL);
