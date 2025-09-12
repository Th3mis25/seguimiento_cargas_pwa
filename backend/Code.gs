const SHEET_NAME = 'Tabla_1';
const AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

function isAuthorized(e) {
  var headerToken = '';
  if (e && e.headers) {
    var authHeader = e.headers.Authorization || e.headers.authorization;
    if (authHeader && authHeader.indexOf('Bearer ') === 0) {
      headerToken = authHeader.substring(7).trim();
    }
  }
  var paramToken = e.parameter && e.parameter.token;
  return headerToken === AUTH_TOKEN || paramToken === AUTH_TOKEN;
}

function createJsonOutput(payload, status) {
  if (typeof status === 'number') {
    payload = Object(payload);
    payload.status = status;
  }
  return ContentService.createTextOutput()
    .setContent(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function doPost(e) {
  if (!isAuthorized(e)) {
    return createJsonOutput({ error: 'Unauthorized' }, 401);
  }

  if (!e.postData) {
    return createJsonOutput({ error: 'Missing postData' }, 400);
  }

  try {
    var p = e.parameter;
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' not found');
    var timeZone = ss.getSpreadsheetTimeZone();
    if (p.action === 'add') {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var headerMap = {};
      for (var i = 0; i < headers.length; i++) {
        headerMap[String(headers[i]).trim().toLowerCase()] = i;
      }
      var tripIdx = headerMap['trip'];
      if (tripIdx == null) throw new Error('Trip column not found');
      var trip = String(p.trip || '').trim();
      if (!/^\d+$/.test(trip)) throw new Error('Invalid trip');
      if (Number(trip) < 225000) throw new Error('Trip must be >= 225000');
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][tripIdx]) === trip) throw new Error('Trip already exists');
      }
      var citaCargaDate = p.citaCarga ? Utilities.parseDate(p.citaCarga, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var ejecutivo = (p.ejecutivo || p.Ejecutivo || '').trim();
      if (!ejecutivo) throw new Error('Missing ejecutivo');
      var row = new Array(headers.length).fill('');
      var map = {
        'Ejecutivo': ejecutivo,
        'Trip': trip,
        'Caja': '',
        'Referencia': p.referencia || '',
        'Cliente': p.cliente || '',
        'Destino': p.destino || '',
        'Estatus': p.estatus || '',
        'Segmento': '',
        'TR-MX': '',
        'TR-USA': '',
        'Cita carga': citaCargaDate,
        'Llegada carga': '',
        'Cita entrega': '',
        'Llegada entrega': '',
        'Comentarios': '',
        'Docs': '',
        'Tracking': ''
      };
      for (var h in map) {
        var idx = headerMap[h.toLowerCase()];
        if (idx > -1) {
          row[idx] = map[h];
        }
      }
      sheet.appendRow(row);
      return createJsonOutput({ success: true }, 200);
    } else if (p.action === 'bulkAdd') {
      var rows;
      try {
        rows = JSON.parse(p.rows || '[]');
      } catch(err) {
        throw new Error('Invalid rows data');
      }
      if (!Array.isArray(rows)) throw new Error('Invalid rows data');
      var headers = sheet.getDataRange().getValues()[0];
      var headerMap = {};
      for (var i = 0; i < headers.length; i++) {
        headerMap[String(headers[i]).trim().toLowerCase()] = i;
      }
      var values = rows.map(function(r){
        var arr = new Array(headers.length).fill('');
        for (var key in r) {
          var idx = headerMap[String(key).trim().toLowerCase()];
          if (idx > -1) {
            var val = r[key];
            if (key === 'Cita carga' || key === 'Llegada carga' ||
                key === 'Cita entrega' || key === 'Llegada entrega') {
              val = val ? Utilities.parseDate(val, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
            }
            arr[idx] = val;
          }
        }
        return arr;
      });
      if(values.length){
        sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
      }
      return createJsonOutput({ success: true, inserted: values.length }, 200);
    } else if (p.action === 'update') {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      // build a case-insensitive header map to avoid issues with extra spaces
      var headerMap = {};
      for (var i = 0; i < headers.length; i++) {
        headerMap[String(headers[i]).trim().toLowerCase()] = i;
      }
      var tripIdx = headerMap['trip'];
      if (tripIdx == null) throw new Error('Trip column not found');
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][tripIdx]) === String(p.originalTrip)) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) throw new Error('Trip not found');
      var trip = String(p.trip || '').trim();
      if (!/^\d+$/.test(trip)) throw new Error('Invalid trip');
      if (Number(trip) < 225000) throw new Error('Trip must be >= 225000');
      for (var i = 1; i < data.length; i++) {
        if (i !== rowIndex && String(data[i][tripIdx]) === trip) {
          throw new Error('Trip already exists');
        }
      }
      // Parse dates using the sheet timezone to keep the submitted local time without adding offsets
      var ejecutivo = (p.ejecutivo || p.Ejecutivo || '').trim();
      if (!ejecutivo) throw new Error('Missing ejecutivo');
      var citaCarga = p.citaCarga ? Utilities.parseDate(p.citaCarga, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var llegadaCarga = p.llegadaCarga ? Utilities.parseDate(p.llegadaCarga, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var citaEntrega = p.citaEntrega ? Utilities.parseDate(p.citaEntrega, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var llegadaEntrega = p.llegadaEntrega ? Utilities.parseDate(p.llegadaEntrega, timeZone, "yyyy-MM-dd'T'HH:mm:ss") : '';
      var map = {
        'Ejecutivo': ejecutivo,
        'Trip': trip,
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
    var status = (
      err.message === 'Trip not found' ||
      err.message === 'Missing ejecutivo' ||
      err.message === 'Invalid trip' ||
      err.message === 'Trip must be >= 225000' ||
      err.message === 'Trip already exists'
    ) ? 400 : 500;
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
