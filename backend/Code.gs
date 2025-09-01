const SHEET_NAME = 'Tabla_1';

function doPost(e) {
  if (!e.postData) {
    return ContentService.createTextOutput('')
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  try {
    var p = e.parameter;
    if (p.action === 'add') {
      var sheet = SpreadsheetApp.openById('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms').getSheetByName(SHEET_NAME);
      if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' not found');
      var row = [
        p.trip || '',
        '', // Caja
        '', // Referencia
        p.cliente || '',
        '', // Destino
        p.estatus || '',
        '', // Segmento
        '', // TR-MX
        '', // TR-USA
        p.citaCarga || '',
        '', // Llegada carga
        '', // Cita entrega
        '', // Llegada entrega
        '', // Comentarios
        '', // Docs
        ''  // Tracking
      ];
      sheet.appendRow(row);
      output.setContent(JSON.stringify({ success: true }));
    } else {
      output.setContent(JSON.stringify({ error: 'Unsupported action' }));
    }
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }
  return output;
}

function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  try {
    var sheet = SpreadsheetApp.openById('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms').getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' not found');
    var data = sheet.getDataRange().getValues();
    output.setContent(JSON.stringify({ data: data }));
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}
