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
      var citaCargaDate = p.citaCarga ? Utilities.parseDate(p.citaCarga, 'America/Mexico_City', "yyyy-MM-dd'T'HH:mm:ss") : '';
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
        citaCargaDate,
        '', // Llegada carga
        '', // Cita entrega
        '', // Llegada entrega
        '', // Comentarios
        '', // Docs
        ''  // Tracking
      ];
      sheet.appendRow(row);
      output.setContent(JSON.stringify({ success: true }));
    } else if (p.action === 'update') {
      var sheet = SpreadsheetApp.openById('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms').getSheetByName(SHEET_NAME);
      if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' not found');
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var tripIdx = headers.indexOf('Trip');
      if (tripIdx === -1) throw new Error('Trip column not found');
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][tripIdx]) === String(p.originalTrip)) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) throw new Error('Trip not found');
      var citaCarga = p.citaCarga ? Utilities.parseDate(p.citaCarga, 'America/Mexico_City', "yyyy-MM-dd'T'HH:mm:ss") : '';
      var llegadaCarga = p.llegadaCarga ? Utilities.parseDate(p.llegadaCarga, 'America/Mexico_City', "yyyy-MM-dd'T'HH:mm:ss") : '';
      var citaEntrega = p.citaEntrega ? Utilities.parseDate(p.citaEntrega, 'America/Mexico_City', "yyyy-MM-dd'T'HH:mm:ss") : '';
      var llegadaEntrega = p.llegadaEntrega ? Utilities.parseDate(p.llegadaEntrega, 'America/Mexico_City', "yyyy-MM-dd'T'HH:mm:ss") : '';
      var map = {
        'Trip': p.trip || '',
        'Caja': p.caja || '',
        'Referencia': p.referencia || '',
        'Cliente': p.cliente || '',
        'Destino': p.destino || '',
        'Estatus': p.estatus || '',
        'Segmento': p.segmento || '',
        'TR-MX': p.trmx || '',
        'TR-USA': p.trusa || '',
        'Cita carga': citaCarga,
        'Llegada carga': llegadaCarga,
        'Cita entrega': citaEntrega,
        'Llegada entrega': llegadaEntrega,
        'Comentarios': p.comentarios || '',
        'Docs': p.docs || '',
        'Tracking': p.tracking || ''
      };
      for (var h in map) {
        var idx = headers.indexOf(h);
        if (idx > -1) {
          sheet.getRange(rowIndex + 1, idx + 1).setValue(map[h]);
        }
      }
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
