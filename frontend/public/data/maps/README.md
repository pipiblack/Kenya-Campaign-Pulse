# Kenya map assets

These presentation-optimized GeoJSON files are generated locally by
`scripts/generate_map_assets.mjs`.

Sources:

- County boundaries: Survey of Kenya / Ministry of Lands data published by
  WWF-Kenya and mirrored by `tigawanna/kenya_wards_geojson_data`.
- Ward boundaries: Flow360ke Kenya ward GeoJSON (`ecovard/kenya_wards.geojson`).
- County, constituency, and ward identifiers: the IEBC hierarchy used by
  `database/kenya_geography_seed.sql`.

The generator rounds and simplifies geometry for screen rendering, matches all
1,450 ward shapes to the platform hierarchy, and splits ward files by county so
the browser downloads only the selected county.
