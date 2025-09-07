const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const headers = ['Ejecutivo', 'Trip', 'Caja', 'Referencia', 'Cliente', 'Destino', 'Estatus', 'Segmento', 'TR-MX', 'TR-USA', 'Cita carga', 'Llegada carga', 'Cita entrega', 'Llegada entrega', 'Comentarios', 'Docs', 'Tracking'];

const appendedRows = [];

const sheet = {
  getDataRange: () => ({ getValues: () => [headers] }),
  appendRow: (row) => appendedRows.push(row)
};

const ss = {
  getSheetByName: () => sheet,
  getSpreadsheetTimeZone: () => 'UTC'
};

const sandbox = {
  SpreadsheetApp: { openById: () => ss },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: () => ({
      setContent() { return this; },
      setMimeType() { return this; },
      setHeader() { return this; }
    })
  },
  Utilities: { parseDate: (val) => val }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), sandbox);

const e = {
  postData: {},
  parameter: {
    token: 'demo-token',
    action: 'add',
    ejecutivo: 'Maria',
    trip: 'T1',
    referencia: 'R1',
    cliente: 'C1',
    estatus: 'E1'
  }
};

sandbox.doPost(e);

const row = appendedRows[0];
assert.strictEqual(row[0], 'Maria');
console.log('Code.gs tests passed.');
