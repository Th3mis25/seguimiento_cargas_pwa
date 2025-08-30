const assert = require('assert');
const { fmtDate } = require('./app.js');

const isoSample = '2024-06-09T15:30:00';

assert.strictEqual(fmtDate(isoSample, 'en-US'), '06/09/2024 03:30 PM');
assert.strictEqual(fmtDate(isoSample, 'es-MX'), '09/06/2024 03:30 p.m.');
assert.strictEqual(fmtDate(isoSample, 'de-DE'), '09.06.2024 15:30');

const customSample = '09/06/2024 15:30:00';

assert.strictEqual(fmtDate(customSample, 'en-US'), '06/09/2024 03:30 PM');
assert.strictEqual(fmtDate(customSample, 'es-MX'), '09/06/2024 03:30 p.m.');
assert.strictEqual(fmtDate(customSample, 'de-DE'), '09.06.2024 15:30');

// Ensure custom format keeps local time without offset
const diffSample = '30/08/2025 08:00:00';
assert.strictEqual(fmtDate(diffSample, 'en-US'), '08/30/2025 08:00 AM');
assert.strictEqual(fmtDate(diffSample, 'es-MX'), '30/08/2025 08:00 a.m.');
assert.strictEqual(fmtDate(diffSample, 'de-DE'), '30.08.2025 08:00');

console.log('All fmtDate tests passed.');
