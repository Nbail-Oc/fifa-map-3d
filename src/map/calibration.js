const EARTH_METERS_PER_DEGREE = 111320;

export function makeCalibration(references) {
  if (!Array.isArray(references) || references.length < 2) {
    throw new Error('Calibration needs at least two reference points.');
  }

  if (references.length >= 3) {
    return makeAffineCalibration(references);
  }

  return makeTwoPointCalibration(references);
}

export function transformLocation(calibration, position) {
  if (calibration.type === 'affine') {
    const { x, y } = applyAffine(calibration.latLngToTile, position.lat, position.lng);
    return { tileX: x, tileY: y };
  }

  const p = project(position, calibration.origin);
  const dx = p.x - calibration.source.x;
  const dy = p.y - calibration.source.y;
  const cos = Math.cos(calibration.rotation);
  const sin = Math.sin(calibration.rotation);

  return {
    tileX: calibration.target.x + calibration.scale * (dx * cos - dy * sin),
    tileY: calibration.target.y + calibration.scale * (dx * sin + dy * cos)
  };
}

function makeTwoPointCalibration(references) {
  const [a, b] = references;
  const origin = { lat: a.lat, lng: a.lng };
  const sourceA = project(a, origin);
  const sourceB = project(b, origin);
  const sourceVector = { x: sourceB.x - sourceA.x, y: sourceB.y - sourceA.y };
  const targetVector = { x: b.tileX - a.tileX, y: b.tileY - a.tileY };
  const sourceLength = Math.hypot(sourceVector.x, sourceVector.y);
  const targetLength = Math.hypot(targetVector.x, targetVector.y);

  if (sourceLength < 0.01 || targetLength === 0) {
    throw new Error('Calibration points must not be identical.');
  }

  return {
    type: 'two-point',
    origin,
    source: sourceA,
    target: { x: a.tileX, y: a.tileY },
    scale: targetLength / sourceLength,
    rotation: Math.atan2(targetVector.y, targetVector.x) - Math.atan2(sourceVector.y, sourceVector.x)
  };
}

function makeAffineCalibration(references) {
  const matrix = references.map(({ lat, lng }) => [lat, lng, 1]);
  const latLngToTile = [
    solve3x3(matrix, references.map(({ tileX }) => tileX)),
    solve3x3(matrix, references.map(({ tileY }) => tileY))
  ];

  return { type: 'affine', latLngToTile };
}

function solve3x3(rows, values) {
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  const rhs = [0, 0, 0];

  rows.forEach((row, rowIndex) => {
    for (let i = 0; i < 3; i += 1) {
      rhs[i] += row[i] * values[rowIndex];
      for (let j = 0; j < 3; j += 1) {
        normal[i][j] += row[i] * row[j];
      }
    }
  });

  return gaussianElimination(normal, rhs);
}

function gaussianElimination(matrix, values) {
  const a = matrix.map((row, i) => [...row, values[i]]);

  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) {
      throw new Error('Calibration points are degenerate.');
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];

    const divisor = a[col][col];
    for (let i = col; i < 4; i += 1) a[col][i] /= divisor;

    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let i = col; i < 4; i += 1) a[row][i] -= factor * a[col][i];
    }
  }

  return [a[0][3], a[1][3], a[2][3]];
}

function applyAffine(coefficients, lat, lng) {
  return {
    x: coefficients[0][0] * lat + coefficients[0][1] * lng + coefficients[0][2],
    y: coefficients[1][0] * lat + coefficients[1][1] * lng + coefficients[1][2]
  };
}

function project(point, origin) {
  const latScale = EARTH_METERS_PER_DEGREE;
  const lngScale = EARTH_METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180);

  return {
    x: (point.lng - origin.lng) * lngScale,
    y: (point.lat - origin.lat) * latScale
  };
}
