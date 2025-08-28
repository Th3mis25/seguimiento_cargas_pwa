const assert = require('assert');
const { fmtDate } = require('./app.js');

const sample = '2024-06-09T15:30:00';

assert.strictEqual(fmtDate(sample, 'en-US'), '06/09/2024 03:30 PM');
assert.strictEqual(fmtDate(sample, 'es-MX'), '09/06/2024 03:30 p.m.');
assert.strictEqual(fmtDate(sample, 'de-DE'), '09.06.2024 15:30');

console.log('All fmtDate locale tests passed.');
