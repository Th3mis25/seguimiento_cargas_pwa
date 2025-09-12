const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

// Stub services required at load time
const cacheStore = {};
global.CacheService = {
  getScriptCache: () => ({
    get: key => cacheStore[key] || null,
    put: (key, value) => { cacheStore[key] = value; }
  })
};

global.Utilities = {
  DigestAlgorithm: { SHA_256: 'sha256' },
  computeDigest: (algo, val) => Array.from(crypto.createHash('sha256').update(val).digest()),
  getUuid: () => 'token-123',
  parseDate: (str) => new Date(str)
};

// Load backend script into the current context
vm.runInThisContext(fs.readFileSync('./backend/Code.gs', 'utf8'));

// Stub remaining Apps Script services
const sheetData = [['Ejecutivo', 'Cliente']]; // No Trip column
const sheet = {
  getDataRange: () => ({
    getValues: () => sheetData
  })
};

global.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: () => sheet,
    getSpreadsheetTimeZone: () => 'UTC'
  })
};

global.ContentService = {
  createTextOutput: () => ({
    content: '',
    setContent(c) { this.content = c; return this; },
    setMimeType() { return this; },
    setHeader() { return this; }
  }),
  MimeType: { JSON: 'application/json', TEXT: 'text/plain' }
};

// Login to obtain token
const loginRes = doPost({ postData: {}, parameter: { action: 'login', user: 'VPADRONR', password: 'VP@trc.008' } });
const loginPayload = JSON.parse(loginRes.content);
const token = loginPayload.token;

// Execute doPost with missing Trip column
const e = {
  postData: {},
  parameter: {
    token,
    action: 'update',
    originalTrip: '123'
  }
};

const result = doPost(e);
const payload = JSON.parse(result.content);
assert.strictEqual(payload.error, 'Trip column not found');
console.log('Trip column missing test passed.');
