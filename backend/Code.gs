const SHEET_NAME = 'Tabla_1';
const AUTH_TOKEN = 'demo-token';
const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

function isAuthorized(e) {
  return e.parameter && e.parameter.token === AUTH_TOKEN;
}

function createJsonOutput(payload, status) {
  return ContentService.createTextOutput()
    .setContent(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    .setStatusCode(status);
}

function doPost(e) {
  if (!e.postData) {
    return createJsonOutput({}, 200);
  }

  if (!isAuthorized(e)) {
    return createJsonOutput({ error: 'Unauthorized' }, 401);
  }

  try {
    var p = e.parameter;
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' not found');
    var timeZone = ss.getSpreadsheetTimeZone();
    if (p.action === 'add') {
      // Interpret incoming time using the sheet timezone to avoid offsets
      var citaCargaDate = p.citaCarga ? Utilities.parseDate(p.citaCarga, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      // Allow either "ejecutivo" or "Ejecutivo" parameter names
      var ejecutivo = (p.ejecutivo || p.Ejecutivo || '').trim();
      if (!ejecutivo) throw new Error('Missing ejecutivo');
      var row = [
        ejecutivo,
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
      return createJsonOutput({ success: true }, 200);
    } else if (p.action === 'update') {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      // build a case-insensitive header map to avoid issues with extra spaces
      var headerMap = {};
      for (var i = 0; i < headers.length; i++) {
        headerMap[String(headers[i]).trim().toLowerCase()] = i;
      }
      var tripIdx = headerMap['trip'];
      if (tripIdx === -1) throw new Error('Trip column not found');
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][tripIdx]) === String(p.originalTrip)) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) throw new Error('Trip not found');
      // Parse dates using the sheet timezone to keep the submitted local time without adding offsets
      var ejecutivo = (p.ejecutivo || p.Ejecutivo || '').trim();
      if (!ejecutivo) throw new Error('Missing ejecutivo');
      var citaCarga = p.citaCarga ? Utilities.parseDate(p.citaCarga, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var llegadaCarga = p.llegadaCarga ? Utilities.parseDate(p.llegadaCarga, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var citaEntrega = p.citaEntrega ? Utilities.parseDate(p.citaEntrega, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var llegadaEntrega = p.llegadaEntrega ? Utilities.parseDate(p.llegadaEntrega, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var map = {
        'Ejecutivo': ejecutivo,
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
        var idx = headerMap[h.toLowerCase()];
        if (idx > -1) {
          sheet.getRange(rowIndex + 1, idx + 1).setValue(map[h]);
        }
      }
      return createJsonOutput({ success: true }, 200);
    } else {
      return createJsonOutput({ error: 'Unsupported action' }, 400);
    }
  } catch (err) {
    var status = (err.message === 'Trip not found' || err.message === 'Missing ejecutivo') ? 400 : 500;
    return createJsonOutput({ error: err.message }, status);
  }
}

function doGet(e) {
  if (!isAuthorized(e)) {
    return createJsonOutput({ error: 'Unauthorized' }, 401);
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' not found');
    var timeZone = ss.getSpreadsheetTimeZone();
    var data = sheet.getDataRange().getValues();
    var formattedData = data.map(function(row) {
      return row.map(function(cell) {
        return cell instanceof Date
          ? Utilities.formatDate(cell, timeZone, "yyyy-MM-dd'T'HH:mm:ss")
          : cell;
      });
    });
    return createJsonOutput({ data: formattedData }, 200);
  } catch (err) {
    return createJsonOutput({ error: err.message }, 500);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}
