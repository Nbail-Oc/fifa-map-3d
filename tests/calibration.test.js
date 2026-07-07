import { makeCalibration, transformLocation } from '../src/map/calibration.js';

function expectClosePoint(actual, expected) {
  expect(actual.tileX).toBeCloseTo(expected.tileX, 5);
  expect(actual.tileY).toBeCloseTo(expected.tileY, 5);
}

describe('calibration', () => {
  test('maps a third known point with 3 affine references', () => {
    const calibration = makeCalibration([
      { lat: 10, lng: 20, tileX: 1, tileY: 2 },
      { lat: 10, lng: 21, tileX: 3, tileY: 2 },
      { lat: 11, lng: 20, tileX: 1, tileY: 5 }
    ]);

    expectClosePoint(transformLocation(calibration, { lat: 11, lng: 21 }), { tileX: 3, tileY: 5 });
  });

  test('handles exactly two reference points', () => {
    const calibration = makeCalibration([
      { lat: 28.0000, lng: 77.0000, tileX: 1, tileY: 1 },
      { lat: 28.0001, lng: 77.0000, tileX: 1, tileY: 4 }
    ]);

    expectClosePoint(transformLocation(calibration, { lat: 28.00005, lng: 77.0000 }), { tileX: 1, tileY: 2.5 });
  });

  test('rejects identical two-point calibration input', () => {
    expect(() => makeCalibration([
      { lat: 1, lng: 1, tileX: 2, tileY: 2 },
      { lat: 1, lng: 1, tileX: 4, tileY: 4 }
    ])).toThrow('Calibration points must not be identical.');
  });
});
