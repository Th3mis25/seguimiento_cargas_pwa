const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Load backend script into the current context
vm.runInThisContext(fs.readFileSync('./backend/Code.gs', 'utf8'));

// Stub Apps Script services
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
