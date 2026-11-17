export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type MapGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface MapFeature<Properties> {
  type: "Feature";
  properties: Properties;
  geometry: MapGeometry;
}

export interface MapFeatureCollection<Properties> {
  type: "FeatureCollection";
  features: Array<MapFeature<Properties>>;
}

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Projection {
  x: (longitude: number) => number;
  y: (latitude: number) => number;
}

function visitPositions(geometry: MapGeometry, callback: (position: Position) => void): void {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const position of ring) callback(position);
    }
  }
}

export function boundsForFeatures<Properties>(features: Array<MapFeature<Properties>>): MapBounds {
  const bounds: MapBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const feature of features) {
    visitPositions(feature.geometry, ([longitude, latitude]) => {
      bounds.minX = Math.min(bounds.minX, longitude);
      bounds.minY = Math.min(bounds.minY, latitude);
      bounds.maxX = Math.max(bounds.maxX, longitude);
      bounds.maxY = Math.max(bounds.maxY, latitude);
    });
  }
  return bounds;
}

export function createProjection(bounds: MapBounds, width: number, height: number, padding: number): Projection {
  const geographicWidth = Math.max(bounds.maxX - bounds.minX, 0.001);
  const geographicHeight = Math.max(bounds.maxY - bounds.minY, 0.001);
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;
  const scale = Math.min(availableWidth / geographicWidth, availableHeight / geographicHeight);
  const offsetX = padding + (availableWidth - geographicWidth * scale) / 2;
  const offsetY = padding + (availableHeight - geographicHeight * scale) / 2;

  return {
    x: (longitude) => offsetX + (longitude - bounds.minX) * scale,
    y: (latitude) => height - offsetY - (latitude - bounds.minY) * scale,
  };
}

export function geometryPath(geometry: MapGeometry, projection: Projection): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude], index) => {
    const command = index === 0 ? "M" : "L";
    return `${command}${projection.x(longitude).toFixed(1)},${projection.y(latitude).toFixed(1)}`;
  }).join("") + "Z").join("")).join("");
}

export function featureCenter<Properties>(feature: MapFeature<Properties>, projection: Projection): [number, number] {
  const bounds = boundsForFeatures([feature]);
  return [
    projection.x((bounds.minX + bounds.maxX) / 2),
    projection.y((bounds.minY + bounds.maxY) / 2),
  ];
}
