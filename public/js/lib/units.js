// Unit conversion tables. Each category maps a unit to its factor relative to the base unit.

export const UNITS = {
  length: { label: 'Length', base: 'm', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852 } },
  mass: { label: 'Mass', base: 'kg', units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 } },
  area: { label: 'Area', base: 'm²', units: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1, 'km²': 1e6, ha: 1e4, 'in²': 0.00064516, 'ft²': 0.09290304, 'yd²': 0.83612736, ac: 4046.8564224, 'mi²': 2589988.110336 } },
  volume: { label: 'Volume', base: 'l', units: { ml: 0.001, l: 1, 'm³': 1000, tsp: 0.00492892159375, tbsp: 0.01478676478125, 'fl oz': 0.0295735295625, cup: 0.2365882365, pt: 0.473176473, qt: 0.946352946, gal: 3.785411784 } },
  speed: { label: 'Speed', base: 'm/s', units: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 1852 / 3600, 'ft/s': 0.3048 } },
  time: { label: 'Time', base: 's', units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800 } },
  data: { label: 'Digital storage', base: 'B', units: { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4, PB: 1024 ** 5 } },
  temp: { label: 'Temperature', base: '°C', units: { '°C': 1, '°F': 1, K: 1 } },
};

const toCelsius = (v, u) => (u === '°C' ? v : u === '°F' ? (v - 32) * 5 / 9 : v - 273.15);
const fromCelsius = (c, u) => (u === '°C' ? c : u === '°F' ? c * 9 / 5 + 32 : c + 273.15);

export function convert(category, value, from, to) {
  const cat = UNITS[category];
  if (!cat || !(from in cat.units) || !(to in cat.units)) throw new Error('Unknown unit.');
  if (category === 'temp') return fromCelsius(toCelsius(value, from), to);
  return value * cat.units[from] / cat.units[to];
}

/** Format with up to 8 significant digits and no trailing zeros. */
export function fmtNumber(n) {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-6) return n.toExponential(5).replace(/\.?0+e/, 'e');
  return String(Number(n.toPrecision(8)));
}
