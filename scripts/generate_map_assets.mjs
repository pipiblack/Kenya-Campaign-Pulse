#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const [countySource, wardSource, hierarchySource, outputDirectory] = process.argv.slice(2);

if (!countySource || !wardSource || !hierarchySource || !outputDirectory) {
  console.error("Usage: node scripts/generate_map_assets.mjs <counties.geojson> <wards.geojson> <hierarchy.csv> <output-directory>");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows;
}

function normalize(value, removeAdministrativeTerms = false) {
  let normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/&/g, " AND ")
    .toUpperCase();
  if (removeAdministrativeTerms) {
    normalized = normalized
      .replace(/\bSUB\s*COUNTY\b/g, " ")
      .replace(/\bCONSTITUENCY\b/g, " ")
      .replace(/\bWARD\b/g, " ");
  }
  return normalized.replace(/[^A-Z0-9]/g, "");
}

function diceCoefficient(left, right) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      overlap += 1;
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function matchScore(feature, record) {
  const ward = normalize(feature.properties.ward, true);
  const recordWard = normalize(record.wardName, true);
  const subcounty = normalize(feature.properties.subcounty, true);
  const constituency = normalize(record.constituencyName, true);

  let wardScore = diceCoefficient(ward, recordWard) * 70;
  if (ward === recordWard) wardScore = 100;
  else if (ward.endsWith(recordWard) || recordWard.endsWith(ward)) wardScore = 84;

  let constituencyScore = diceCoefficient(subcounty, constituency) * 25;
  if (subcounty === constituency) constituencyScore = 30;
  else if (subcounty.includes(constituency) || constituency.includes(subcounty)) constituencyScore = 24;

  return wardScore + constituencyScore;
}

function perpendicularDistance(point, start, end) {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  if (deltaX === 0 && deltaY === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const numerator = Math.abs(deltaY * point[0] - deltaX * point[1] + end[0] * start[1] - end[1] * start[0]);
  return numerator / Math.hypot(deltaX, deltaY);
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let splitIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points.at(-1)];
  const left = simplifyLine(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyLine(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function simplifyRing(points, tolerance) {
  if (points.length <= 5) return points.map(roundPoint);
  const closed = points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
  const ring = closed ? points.slice(0, -1) : [...points];
  let farthestIndex = 1;
  let farthestDistance = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const distance = Math.hypot(ring[index][0] - ring[0][0], ring[index][1] - ring[0][1]);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  const firstHalf = simplifyLine(ring.slice(0, farthestIndex + 1), tolerance);
  const secondHalf = simplifyLine([...ring.slice(farthestIndex), ring[0]], tolerance);
  const simplified = [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)];
  const usable = simplified.length >= 3 ? simplified : ring;
  const rounded = usable.map(roundPoint);
  return [...rounded, rounded[0]];
}

function roundPoint(point) {
  return [Number(point[0].toFixed(4)), Number(point[1].toFixed(4))];
}

function simplifyGeometry(geometry, tolerance) {
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tolerance)) };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => simplifyRing(ring, tolerance))),
    };
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

const [countyGeoJson, wardGeoJson, hierarchyCsv] = await Promise.all([
  readFile(resolve(countySource), "utf8").then(JSON.parse),
  readFile(resolve(wardSource), "utf8").then(JSON.parse),
  readFile(resolve(hierarchySource), "utf8"),
]);

const hierarchyRows = parseCsv(hierarchyCsv.replace(/^\uFEFF/, ""));
const geography = hierarchyRows.slice(1).map((row) => ({
  countyCode: Number(row[0]),
  countyName: row[1],
  constituencyCode: Number(row[2]),
  constituencyName: row[3],
  wardCode: Number(row[4]),
  wardName: row[5],
}));

if (countyGeoJson.features.length !== 47 || wardGeoJson.features.length !== 1450 || geography.length !== 1450) {
  throw new Error(`Unexpected geography counts: counties=${countyGeoJson.features.length}, ward-shapes=${wardGeoJson.features.length}, hierarchy=${geography.length}`);
}

const countyCodeByName = new Map(geography.map((row) => [normalize(row.countyName), row.countyCode]));
const recordsByCounty = groupBy(geography, (row) => row.countyCode);
const featuresByCounty = groupBy(wardGeoJson.features, (feature) => {
  const code = countyCodeByName.get(normalize(feature.properties.county));
  if (!code) throw new Error(`Could not match county: ${feature.properties.county}`);
  return code;
});

const matchedWards = [];
const lowConfidenceMatches = [];

for (const [countyCode, countyFeatures] of featuresByCounty) {
  const countyRecords = recordsByCounty.get(countyCode) ?? [];
  if (countyFeatures.length !== countyRecords.length) {
    throw new Error(`Ward count mismatch for county ${countyCode}: shapes=${countyFeatures.length}, hierarchy=${countyRecords.length}`);
  }

  const candidates = countyFeatures.flatMap((feature, featureIndex) => countyRecords.map((record) => ({
    feature,
    featureIndex,
    record,
    score: matchScore(feature, record),
  }))).sort((left, right) => right.score - left.score);

  const assignedFeatures = new Set();
  const assignedWardCodes = new Set();
  for (const candidate of candidates) {
    if (assignedFeatures.has(candidate.featureIndex) || assignedWardCodes.has(candidate.record.wardCode)) continue;
    assignedFeatures.add(candidate.featureIndex);
    assignedWardCodes.add(candidate.record.wardCode);
    matchedWards.push(candidate);
    if (candidate.score < 70) {
      lowConfidenceMatches.push({
        county: candidate.record.countyName,
        shape: candidate.feature.properties.ward,
        ward: candidate.record.wardName,
        constituency: candidate.record.constituencyName,
        score: Number(candidate.score.toFixed(1)),
      });
    }
  }

  if (assignedFeatures.size !== countyFeatures.length || assignedWardCodes.size !== countyRecords.length) {
    throw new Error(`Incomplete ward assignment for county ${countyCode}`);
  }
}

const duplicateWardCodes = matchedWards
  .map((match) => match.record.wardCode)
  .filter((code, index, codes) => codes.indexOf(code) !== index);
if (matchedWards.length !== 1450 || duplicateWardCodes.length) {
  throw new Error(`Invalid ward assignments: matched=${matchedWards.length}, duplicates=${duplicateWardCodes.join(",")}`);
}

const nationalFeatures = countyGeoJson.features.map((feature) => {
  const countyCode = Number(feature.properties.county_code);
  const countyName = geography.find((row) => row.countyCode === countyCode)?.countyName ?? feature.properties.county_name;
  return {
    type: "Feature",
    properties: { county_code: countyCode, county_name: countyName },
    geometry: simplifyGeometry(feature.geometry, 0.008),
  };
});

await mkdir(resolve(outputDirectory), { recursive: true });
await writeFile(
  resolve(outputDirectory, "counties.json"),
  JSON.stringify({ type: "FeatureCollection", features: nationalFeatures }),
);

const wardMatchesByCounty = groupBy(matchedWards, (match) => match.record.countyCode);
for (let countyCode = 1; countyCode <= 47; countyCode += 1) {
  const matches = wardMatchesByCounty.get(countyCode) ?? [];
  const features = matches
    .sort((left, right) => left.record.wardCode - right.record.wardCode)
    .map(({ feature, record }) => ({
      type: "Feature",
      properties: {
        ward_code: record.wardCode,
        ward_name: record.wardName,
        constituency_code: record.constituencyCode,
        constituency_name: record.constituencyName,
        population_2009: feature.properties.pop2009 ?? null,
      },
      geometry: simplifyGeometry(feature.geometry, 0.0015),
    }));
  await writeFile(
    resolve(outputDirectory, `wards-${String(countyCode).padStart(2, "0")}.json`),
    JSON.stringify({ type: "FeatureCollection", features }),
  );
}

const report = {
  sourceFiles: [basename(countySource), basename(wardSource), basename(hierarchySource)],
  counties: nationalFeatures.length,
  wards: matchedWards.length,
  lowConfidenceMatches,
};
await writeFile(resolve(outputDirectory, "generation-report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  counties: nationalFeatures.length,
  wards: matchedWards.length,
  lowConfidenceMatches: lowConfidenceMatches.length,
  outputDirectory: resolve(outputDirectory),
}, null, 2));
