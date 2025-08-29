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

console.log('All fmtDate tests passed.');
