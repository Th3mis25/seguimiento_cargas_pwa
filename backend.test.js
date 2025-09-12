const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Stub services required at load time
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: () => 'demo-token'
  })
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

// Ensure missing postData returns 400 and authorization is checked
let authCalled = false;
const originalIsAuthorized = isAuthorized;
global.isAuthorized = function(e) {
  authCalled = true;
  return originalIsAuthorized(e);
};

const noPostDataResult = doPost({ parameter: { token: 'demo-token' } });
const noPostDataPayload = JSON.parse(noPostDataResult.content);
assert.strictEqual(noPostDataPayload.error, 'Missing postData');
assert.strictEqual(noPostDataPayload.status, 400);
assert.ok(authCalled, 'isAuthorized should be called');
console.log('Missing postData test passed.');

// Execute doPost with missing Trip column
const e = {
  postData: {},
  parameter: {
    token: 'demo-token',
    action: 'update',
    originalTrip: '123'
  }
};

const result = doPost(e);
const payload = JSON.parse(result.content);
assert.strictEqual(payload.error, 'Trip column not found');
console.log('Trip column missing test passed.');
