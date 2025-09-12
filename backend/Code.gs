const SHEET_NAME = 'Tabla_1';
const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

// Usuarios con contraseñas hasheadas (SHA-256)
const USERS = {
  'VPADRONR': '637acb3c6c207e324182ceae11ceac46c0a9f8f793fa3ea2b08d8fc369cf6017',
  'DDAVILA': '2a8f5d9c84213a3448398a349c9540f919065517331661ce2cf799e7c6b6fa1d'
};

function hashPassword(password) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function verifyUser(user, pass) {
  const stored = USERS[user];
  if (!stored) return false;
  return hashPassword(pass) === stored;
}

function issueToken(user) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, user, 3600); // Expira en 1h
  return token;
}

function isAuthorized(e) {
  const token = e.parameter && e.parameter.token;
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  return cache.get(token) !== null;
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
  if (!e.postData) {
    return createJsonOutput({}, 200);
  }

  var p = e.parameter || {};

  if (p.action === 'login') {
    if (verifyUser(p.user, p.password)) {
      return createJsonOutput({ token: issueToken(p.user) }, 200);
    }
    return createJsonOutput({ error: 'Invalid credentials' }, 401);
  }

  if (!isAuthorized(e)) {
    return createJsonOutput({ error: 'Unauthorized' }, 401);
  }

  try {
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
