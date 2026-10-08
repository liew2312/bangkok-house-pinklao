// ============================================================
//  หน้าเว็บย้ายไปอยู่ที่ GitHub Pages (โฟลเดอร์ docs/)
//  Apps Script ทำหน้าที่เป็น API อย่างเดียว:
//   - doGet  : เช็คว่า API ทำงาน (ไม่ส่งหน้าเว็บ/ไม่ส่งข้อมูล)
//   - doPost : รับคำสั่งจากหน้าเว็บ (ต้องมี token จากการล็อกอิน) + รับ webhook จาก LINE
//  หมายเหตุ: ไม่ใช้ HtmlService แล้ว จึงไม่มีใครเรียก google.script.run ข้ามระบบล็อกอินได้
// ============================================================
function doGet(e) {
  return jsonOut_({ ok: true, service: 'dorm-api', message: 'Dorm Manager API ทำงานปกติ' });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// คำสั่งที่หน้าเว็บเรียกได้ (ต้องล็อกอินแล้วเท่านั้น) — ชื่อเดียวกับฟังก์ชันเดิม
function apiActions_() {
  return {
    getAppData: getAppData,
    saveMeterData: saveMeterData,
    updateMeterData: updateMeterData,
    updatePaymentStatusBackend: updatePaymentStatusBackend,
    saveSettingsData: saveSettingsData,
    addRoomData: addRoomData,
    deleteRoomData: deleteRoomData,
    updateTenantData: updateTenantData,
    moveOutTenant: moveOutTenant,
    saveRepair: saveRepair,
    updateRepairStatusBackend: updateRepairStatusBackend,
    saveExpense: saveExpense,
    getBatchInvoiceData: getBatchInvoiceData,
    uploadFileToDrive: uploadFileToDrive,
    getWebAppUrl: getWebAppUrl,
    pushLineBills: pushLineBills,
    pushLineReceipts: pushLineReceipts,
    testLineConnection: testLineConnection,
    unlinkLineUser: unlinkLineUser,
    saveAdjustmentsForMonth: saveAdjustmentsForMonth,
    upsertRoomAdjustments: upsertRoomAdjustments
  };
}

// ไม่ส่งค่าลับออกไปฝั่งหน้าเว็บเด็ดขาด (รหัสผ่านแอดมิน / LINE token)
function stripSecrets_(result) {
  if (result && typeof result === 'object' && result.settings && typeof result.settings === 'object') {
    var st = result.settings;
    st.LineTokenSet = (st.LineChannelToken || st.LineTokenSet) ? 'yes' : '';
    st.AdminPassSet = (st.AdminPass || st.AdminPassSet) ? 'yes' : '';
    delete st.LineChannelToken;
    delete st.AdminPass;
  }
  return result;
}

function handleApi_(body) {
  var action = (body && body.action ? body.action : '').toString();
  var args = (body && Array.isArray(body.args)) ? body.args : [];
  try {
    if (action === 'info') {
      var si = readSettingsObj_();
      return { ok: true, result: { DormName: si.DormName || 'ระบบจัดการหอพัก' } };
    }
    if (action === 'login') return apiLogin_(args[0], args[1]);
    var tok = (body && body.token ? body.token : '').toString();
    if (!checkSession_(tok)) return { ok: false, code: 'AUTH', error: 'กรุณาเข้าสู่ระบบใหม่' };
    if (action === 'logout') { endSession_(tok); return { ok: true, result: 'SUCCESS' }; }
    var fn = apiActions_()[action];
    if (!fn) return { ok: false, error: 'ไม่รู้จักคำสั่ง: ' + action };
    return { ok: true, result: stripSecrets_(fn.apply(null, args)) };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// ---- ล็อกอินฝั่ง server + session token (เก็บใน Script Properties อายุ 30 วัน) ----
var SESSION_DAYS_ = 30;

function apiLogin_(user, pass) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('loginFails') || '0', 10) || 0;
  if (fails >= 10) return { ok: false, error: 'ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' };
  var s = readSettingsObj_();
  var validU = (s.AdminUser || 'admin').toString().trim();
  var validP = (s.AdminPass || '1234').toString().trim();
  if ((user || '').toString().trim() !== validU || (pass || '').toString() !== validP) {
    cache.put('loginFails', String(fails + 1), 900);
    Utilities.sleep(800);
    return { ok: false, error: 'ชื่อผู้ใช้ หรือ รหัสผ่าน ไม่ถูกต้อง!' };
  }
  cache.remove('loginFails');
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {   // ล้าง session ที่หมดอายุ
    if (k.indexOf('sess_') === 0 && (parseInt(all[k], 10) || 0) < now) props.deleteProperty(k);
  });
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('sess_' + token, String(now + SESSION_DAYS_ * 86400000));
  return { ok: true, result: { token: token, dormName: s.DormName || '' } };
}

function checkSession_(token) {
  if (!token || token.length < 30) return false;
  var exp = parseInt(PropertiesService.getScriptProperties().getProperty('sess_' + token) || '0', 10) || 0;
  return exp > Date.now();
}

function endSession_(token) {
  try { PropertiesService.getScriptProperties().deleteProperty('sess_' + token); } catch (e) {}
}

// ออกจากระบบทุกเครื่อง (รันเองจาก Apps Script editor ได้ ถ้าสงสัยว่ารหัสหลุด)
function logoutAllSessions() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf('sess_') === 0) props.deleteProperty(k); });
  return 'SUCCESS: ออกจากระบบทุกเครื่องแล้ว';
}

function initPermissions() {
  try {
    DriveApp.getRootFolder();
    var folderIterator = DriveApp.getFoldersByName("DormManager_TenantFiles");
    if (!folderIterator.hasNext()) DriveApp.createFolder("DormManager_TenantFiles");
  } catch (e) { console.log(e); }
}

function parseMonthString(val) {
  if (!val) return "";
  if (val instanceof Date) { var mm = ("0" + (val.getMonth() + 1)).slice(-2); return mm + "/" + val.getFullYear(); }
  if (typeof val === 'string' && val.indexOf('T') > -1 && val.indexOf('Z') > -1) {
    try { var d = new Date(val); var mmd = ("0" + (d.getMonth() + 1)).slice(-2); return mmd + "/" + d.getFullYear(); } catch(e) {}
  }
  return val.toString().trim();
}

function sanitize(data) {
  if (!data || !Array.isArray(data)) return [];
  var sanitizedData = [];
  for (var i = 0; i < data.length; i++) {
    var row = [];
    if (!data[i] || !Array.isArray(data[i])) { sanitizedData.push([]); continue; }
    for (var j = 0; j < data[i].length; j++) {
      var cell = data[i][j];
      if (cell instanceof Date) { row.push(cell.toISOString()); }
      else { row.push(cell === null || cell === undefined ? "" : cell); }
    }
    sanitizedData.push(row);
  }
  return sanitizedData;
}

function getAppData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { status: 'error', message: 'ไม่พบฐานข้อมูล Google Sheet' };

    var setSheet = ss.getSheetByName('Settings');
    var roomSheet = ss.getSheetByName('Rooms');
    var meterSheet = ss.getSheetByName('Meters');
    var historySheet = ss.getSheetByName('TenantHistory');
    var repairSheet = ss.getSheetByName('Repairs');
    var expenseSheet = ss.getSheetByName('Expenses');
    var filesSheet = ss.getSheetByName('TenantFiles');

    if (!setSheet || !roomSheet || !meterSheet) {
      return { status: 'error', message: 'ไม่พบแท็บ Settings, Rooms หรือ Meters ในไฟล์ (ห้ามเปลี่ยนชื่อแท็บ)' };
    }

    var settings = {}; 
    var setValues = setSheet.getDataRange().getValues();
    if (setValues && Array.isArray(setValues)) {
        for (var i = 0; i < setValues.length; i++) {
          if(setValues[i] && setValues[i][0]) settings[setValues[i][0].toString().trim()] = setValues[i][1];
        }
    }

    var stats = { total: 0, occupied: 0, vacant: 0, totalRent: 0 }; 
    var tenants = [];
    var roomRaw = sanitize(roomSheet.getDataRange().getValues()); 
    if(roomRaw.length > 0) roomRaw.shift();
    
    for (var i = 0; i < roomRaw.length; i++) {
      var r = roomRaw[i];
      if (r && r.length > 0 && r[0] && r[0] !== "") {
        var status = r[1] ? r[1].toString().trim() : 'ห้องว่าง'; 
        var rent = parseFloat(r[3]) || 0;
        if(status === 'มีคนพัก') { stats.occupied++; stats.totalRent += rent; } else { stats.vacant++; }
        tenants.push({ room: r[0].toString(), status: status, name: r[2], rent: rent, phone: r[4], start: r[5], end: r[6], deposit: r[7], line: r[8], email: r[9], idCard: r[10], notes: r[11] });
      }
    }
    stats.total = tenants.length;

    var history = []; var chartStats = {}; var lateData = { count: 0, amount: 0, list: [] }; var unpaidRooms = [];
    var mRaw = sanitize(meterSheet.getDataRange().getValues()); 
    if(mRaw.length > 0) mRaw.shift(); 
    var currentDay = new Date().getDate();
    var dueDay = parseInt(settings.LateDueDay, 10) || 5; // วันครบกำหนดชำระ (ตั้งค่าได้)

    // Build all meter rows for lookup (for prev-month calculation)
    var allMeterRows = [];
    for (var i = 0; i < mRaw.length; i++) {
      var r = mRaw[i];
      if(!r || r.length < 3 || !r[2] || r[2] === "") continue;
      var mStr = parseMonthString(r[1]);
      allMeterRows.push({ month: mStr, room: r[2].toString().trim(), cw: parseFloat(r[3]) || 0, ce: parseFloat(r[4]) || 0 });
    }

    for (var i = 0; i < mRaw.length; i++) {
      var r = mRaw[i];
      if(!r || r.length < 3 || !r[2] || r[2] === "") continue;
      var monthStr = parseMonthString(r[1]); var roomNo = r[2].toString().trim();
      var curW = parseFloat(r[3]) || 0; var curE = parseFloat(r[4]) || 0;
      var payStatus = r[7] ? r[7].toString().trim() : 'ค้างชำระ';

      // Calculate units used = current reading - previous month reading
      var prevW = 0; var prevE = 0;
      var mParts = monthStr ? monthStr.split('/') : [];
      if (mParts.length === 2) {
        var targetDate = new Date(parseInt(mParts[1]), parseInt(mParts[0]) - 1, 1);
        var bestDate = null;
        for (var p = 0; p < allMeterRows.length; p++) {
          var pr = allMeterRows[p];
          if (pr.room !== roomNo) continue;
          var prParts = pr.month ? pr.month.split('/') : [];
          if (prParts.length !== 2) continue;
          var prDate = new Date(parseInt(prParts[1]), parseInt(prParts[0]) - 1, 1);
          if (prDate < targetDate) {
            if (bestDate === null || prDate > bestDate) { bestDate = prDate; prevW = pr.cw; prevE = pr.ce; }
          }
        }
      }
      var wUsed = Math.round(Math.max(0, curW - prevW));
      var eUsed = Math.round(Math.max(0, curE - prevE));

      history.push({ month: monthStr, room: roomNo, water: wUsed, elec: eUsed, waterReading: curW, elecReading: curE, payStatus: payStatus, paidDate: (r[8] || '') });
      
      var wRate = parseFloat(settings.WaterRate) || 0; var eRate = parseFloat(settings.ElecRate) || 0;
      var commonFee = parseFloat(settings.CommonFee) || 0;
      var wBill = Math.max(wUsed * wRate, 50); var eTotal = eUsed * eRate;
      var tRent = 0;
      for (var j = 0; j < tenants.length; j++) { if (tenants[j].room === roomNo) { tRent = tenants[j].rent; break; } }
      var totalBill = Math.ceil(tRent + wBill + eTotal + commonFee);

      if(!chartStats[monthStr]) chartStats[monthStr] = { total: 0 };
      chartStats[monthStr].total += totalBill;

      if (payStatus !== 'ชำระแล้ว' && currentDay > dueDay) {
        if (unpaidRooms.indexOf(roomNo) === -1) unpaidRooms.push(roomNo);
        lateData.amount += totalBill; lateData.list.push({ room: roomNo, month: monthStr, amount: totalBill });
      }
    }
    lateData.count = unpaidRooms.length;

    var chartKeys = Object.keys(chartStats).sort(function(a,b) { 
        if(!a || !b) return 0;
        var pA = a.split('/'); var pB = b.split('/'); 
        if (!pA || !pB || pA.length < 2 || pB.length < 2) return 0;
        return new Date(pA[1], pA[0]-1) - new Date(pB[1], pB[0]-1); 
    });
    // เปลี่ยนดึงข้อมูลกราฟเป็น 12 เดือน
    if (chartKeys.length > 12) { chartKeys = chartKeys.slice(chartKeys.length - 12); }
    var chartTotal = [];
    for (var i = 0; i < chartKeys.length; i++) { 
        chartTotal.push(chartStats[chartKeys[i]].total || 0);
    }
    var finalChart = { labels: chartKeys, total: chartTotal };

    var oldTenants = []; 
    if(historySheet) { 
      var hRaw = sanitize(historySheet.getDataRange().getValues()); if(hRaw.length > 0) hRaw.shift(); 
      for (var i = hRaw.length - 1; i >= 0; i--) { 
          if (hRaw[i] && hRaw[i].length > 1 && hRaw[i][1] && hRaw[i][1] !== "") {
              oldTenants.push({ room: hRaw[i][1].toString(), name: hRaw[i][2], phone: hRaw[i][3], start: hRaw[i][4], moveOut: hRaw[i][5], notes: hRaw[i][6] }); 
          }
      }
    }

    var repairs = []; 
    if(repairSheet) { 
      var rRaw = sanitize(repairSheet.getDataRange().getValues()); if(rRaw.length > 0) rRaw.shift(); 
      for (var i = rRaw.length - 1; i >= 0; i--) { 
          if (rRaw[i] && rRaw[i].length > 1 && rRaw[i][1] && rRaw[i][1] !== "") {
              repairs.push({ date: rRaw[i][0], room: rRaw[i][1].toString().trim(), issue: rRaw[i][2], status: rRaw[i][3], cost: parseFloat(rRaw[i][4]) || 0, url: rRaw[i][5] || '' }); 
          }
      }
    }

    var expenses = []; 
    if(expenseSheet) { 
      var eRaw = sanitize(expenseSheet.getDataRange().getValues()); if(eRaw.length > 0) eRaw.shift(); 
      for (var i = eRaw.length - 1; i >= 0; i--) { 
          if (eRaw[i] && eRaw[i].length > 1 && eRaw[i][1] && eRaw[i][1] !== "") {
              expenses.push({ date: eRaw[i][1], category: eRaw[i][2], amount: parseFloat(eRaw[i][3]) || 0, note: eRaw[i][4], url: eRaw[i][5] || '' }); 
          }
      }
    }

    var tenantFiles = []; 
    if(filesSheet) { 
      var fRaw = sanitize(filesSheet.getDataRange().getValues()); if(fRaw.length > 0) fRaw.shift(); 
      for (var i = 0; i < fRaw.length; i++) { 
          if (fRaw[i] && fRaw[i].length > 1 && fRaw[i][1] && fRaw[i][1] !== "") {
              tenantFiles.push({ date: fRaw[i][0], room: fRaw[i][1].toString().trim(), fileName: fRaw[i][2], url: fRaw[i][3] }); 
          }
      }
    }

    history.reverse();
    // ไม่ส่ง Channel access token ออกไปฝั่ง client (กัน token หลุด) — ส่งแค่สถานะว่าตั้งค่าแล้วหรือยัง
    if (settings) {
      settings.LineTokenSet = (settings.LineChannelToken ? 'yes' : ''); delete settings.LineChannelToken;
      settings.AdminPassSet = (settings.AdminPass ? 'yes' : ''); delete settings.AdminPass;
    }
    return { status: 'success', stats: stats, tenants: tenants, settings: settings, history: history, oldTenants: oldTenants, chart: finalChart, late: lateData, repairs: repairs, expenses: expenses, tenantFiles: tenantFiles, lineUsers: getLineUsers_(), lineSent: getLineSent_(), adjustments: getAdjustments_() };
  } catch(e) { return { status: 'error', message: e.toString() }; }
}

function saveMeterData(record) { 
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meters'); var data = sheet.getDataRange().getValues();
  var searchMonth = record.month.trim(); var searchRoom = record.room.toString().trim();
  for (var i = 1; i < data.length; i++) {
    if(!data[i] || !data[i][1] || !data[i][2]) continue;
    var rowMonth = parseMonthString(data[i][1]); var rowRoom = data[i][2].toString().trim();
    if (rowMonth === searchMonth && rowRoom === searchRoom) return "ERROR: ข้อมูลของห้อง '" + searchRoom + "' รอบบิล '" + searchMonth + "' มีอยู่แล้ว!";
  }
  var monthText = "'" + searchMonth; 
  sheet.appendRow([new Date(), monthText, searchRoom, record.cw, record.ce, record.uw, record.ue, "ค้างชำระ"]); 
  return 'SUCCESS: บันทึกข้อมูลมิเตอร์เรียบร้อย!'; 
}

function updateMeterData(record) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meters'); var data = sheet.getDataRange().getValues();
    var searchMonth = record.month.trim(); var searchRoom = record.room.toString().trim();
    for (var i = 1; i < data.length; i++) {
      if(!data[i] || !data[i][1] || !data[i][2]) continue;
      var rowMonth = parseMonthString(data[i][1]); var rowRoom = data[i][2].toString().trim();
      if (rowMonth === searchMonth && rowRoom === searchRoom) {
        sheet.getRange(i+1, 4).setValue(record.cw);
        sheet.getRange(i+1, 5).setValue(record.ce);
        sheet.getRange(i+1, 6).setValue(record.uw);
        sheet.getRange(i+1, 7).setValue(record.ue);
        return 'SUCCESS: แก้ไขข้อมูลมิเตอร์เรียบร้อย!';
      }
    }
    return "ERROR: ไม่พบข้อมูลมิเตอร์ของห้อง '" + searchRoom + "' รอบบิล '" + searchMonth + "' กรุณาบันทึกใหม่";
  } catch(e) { return 'ERROR: ' + e.toString(); }
}

// แปลงค่าวันที่รับชำระให้เป็น Date (รองรับ 'YYYY-MM-DD' จาก <input type=date>) ; ว่าง = วันนี้
function parsePaidDate_(v) {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  var s = v.toString().trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  var d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function updatePaymentStatusBackend(room, month, isPaid, paidDate) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meters'); var data = sheet.getDataRange().getValues();
    var searchMonth = month.trim(); var searchRoom = room.toString().trim(); var statusText = isPaid ? 'ชำระแล้ว' : 'ค้างชำระ';
    for (var i = 1; i < data.length; i++) {
      if(!data[i] || !data[i][1] || !data[i][2]) continue;
      var rowMonth = parseMonthString(data[i][1]); var rowRoom = data[i][2].toString().trim();
      if (rowMonth === searchMonth && rowRoom === searchRoom) {
        sheet.getRange(i + 1, 8).setValue(statusText);
        // เก็บ "วันที่รับชำระ" ไว้ที่คอลัมน์ 9 (ใช้วันที่ที่ผู้ใช้กรอก ให้ตรงกับสลิป) และล้างเมื่อยกเลิก
        if (isPaid) { sheet.getRange(i + 1, 9).setValue(parsePaidDate_(paidDate)); } else { sheet.getRange(i + 1, 9).setValue(''); }
        return 'SUCCESS: อัปเดตสถานะชำระเงินเรียบร้อย';
      }
    }
    return "ERROR: ไม่พบข้อมูลบิลรอบเดือน " + month + " ของห้อง " + room;
  } catch(e) { return 'ERROR: ' + e.toString(); }
}

function saveSettingsData(newSet) {
  if(!newSet || !newSet.DormName) return "ERROR: ชื่อหอพักห้ามเว้นว่าง!";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  // เก็บค่าเดิมของ "คีย์ลับ" ไว้ ถ้า client ส่งมาว่าง (เพราะเราไม่ส่ง token ออกไปฝั่ง client)
  var prev = {}; var pv = sheet.getDataRange().getValues();
  for (var p = 0; p < pv.length; p++) { if (pv[p] && pv[p][0]) prev[pv[p][0].toString().trim()] = pv[p][1]; }
  var SECRET = ['LineChannelToken', 'AdminPass'];
  for (var si = 0; si < SECRET.length; si++) {
    var kk = SECRET[si];
    if ((newSet[kk] === undefined || newSet[kk] === '') && prev[kk] !== undefined && prev[kk] !== '') newSet[kk] = prev[kk];
  }
  sheet.clear(); sheet.appendRow(["Key", "Value"]);
  var keys = Object.keys(newSet);
  for(var i=0; i<keys.length; i++) { sheet.appendRow([keys[i], newSet[keys[i]]]); }
  return "SUCCESS: บันทึกตั้งค่าเรียบร้อย!";
}

function addRoomData(record) {
  try {
    if (!record || !record.room) return "ERROR: กรุณากรอกเลขห้อง";
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rooms');
    if (!sheet) return "ERROR: ไม่พบแท็บ Rooms";
    var data = sheet.getDataRange().getValues();
    // Check duplicate
    for (var i = 1; i < data.length; i++) {
      if (data[i] && data[i][0] && data[i][0].toString().trim() === record.room.toString().trim()) {
        return "ERROR: ห้อง '" + record.room + "' มีอยู่ในระบบแล้ว!";
      }
    }
    sheet.appendRow([record.room, record.status||'ห้องว่าง', record.name||'', parseFloat(record.rent)||0, record.phone||'', record.start||'', record.end||'', parseFloat(record.deposit)||0, record.line||'', record.email||'', record.idcard||'', record.notes||'']);
    return "SUCCESS: เพิ่มห้อง '" + record.room + "' สำเร็จ!";
  } catch(e) { return "ERROR: " + e.toString(); }
}

function deleteRoomData(roomNo) {
  try {
    if (!roomNo) return "ERROR: ไม่พบเลขห้อง";
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rooms');
    if (!sheet) return "ERROR: ไม่พบแท็บ Rooms";
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i] && data[i][0] && data[i][0].toString().trim() === roomNo.toString().trim()) {
        sheet.deleteRow(i + 1);
        return "SUCCESS: ลบห้อง '" + roomNo + "' สำเร็จ!";
      }
    }
    return "ERROR: ไม่พบห้อง '" + roomNo + "' ในระบบ";
  } catch(e) { return "ERROR: " + e.toString(); }
}

function updateTenantData(record) { 
  if(!record.room) return "ERROR: ไม่พบเลขห้อง";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rooms'); var data = sheet.getDataRange().getValues(); 
  for(var i=1; i<data.length; i++) { 
    if(data[i] && data[i][0] && data[i][0].toString() === record.room.toString()) { 
      sheet.getRange(i+1, 2).setValue(record.status); sheet.getRange(i+1, 3).setValue(record.name); sheet.getRange(i+1, 4).setValue(record.rent); sheet.getRange(i+1, 5).setValue(record.phone); sheet.getRange(i+1, 6).setValue(record.start); sheet.getRange(i+1, 7).setValue(record.end); sheet.getRange(i+1, 8).setValue(record.deposit); sheet.getRange(i+1, 9).setValue(record.line); sheet.getRange(i+1, 10).setValue(record.email); sheet.getRange(i+1, 11).setValue(record.idcard); sheet.getRange(i+1, 12).setValue(record.notes); return "SUCCESS: บันทึกข้อมูลผู้เช่าเรียบร้อยแล้ว!"; 
    } 
  } return "ERROR: ไม่พบเลขห้องนี้ในระบบ"; 
}

function moveOutTenant(record) { 
  var ss = SpreadsheetApp.getActiveSpreadsheet(); var roomSheet = ss.getSheetByName('Rooms'); var historySheet = ss.getSheetByName('TenantHistory'); 
  if(!historySheet) { historySheet = ss.insertSheet('TenantHistory'); historySheet.appendRow(["Timestamp", "RoomNo", "TenantName", "Phone", "ContractStart", "MoveOutDate", "Notes"]); } 
  var data = roomSheet.getDataRange().getValues(); 
  for(var i=1; i<data.length; i++) { 
    if(data[i] && data[i][0] && data[i][0].toString() === record.room.toString()) { 
      var name = data[i][2]; var phone = data[i][4]; var start = data[i][5]; 
      historySheet.appendRow([new Date(), record.room, name, phone, start, record.moveOutDate, record.note || "แจ้งย้ายออก"]); 
      roomSheet.getRange(i+1, 2).setValue("ห้องว่าง"); roomSheet.getRange(i+1, 3).clearContent(); roomSheet.getRange(i+1, 5).clearContent(); roomSheet.getRange(i+1, 6).clearContent(); roomSheet.getRange(i+1, 7).clearContent(); roomSheet.getRange(i+1, 8).clearContent(); roomSheet.getRange(i+1, 9).clearContent(); roomSheet.getRange(i+1, 10).clearContent(); roomSheet.getRange(i+1, 11).clearContent(); roomSheet.getRange(i+1, 12).clearContent(); 
      return "SUCCESS: บันทึกประวัติย้ายออก และเคลียร์ห้องสำเร็จ!"; 
    } 
  } return "ERROR: เกิดข้อผิดพลาด"; 
}

function uploadAttachment(base64Data, filename, mimeType) {
  try {
    var folderIterator = DriveApp.getFoldersByName("DormManager_TenantFiles");
    var folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.createFolder("DormManager_TenantFiles");
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) { 
    return ""; 
  }
}

function saveRepair(record) { 
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs');
  if(!sheet) { 
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Repairs'); 
      sheet.appendRow(['Timestamp','RoomNo','Issue','Status','Cost','AttachmentURL']); 
  }
  var fileUrl = "";
  if (record.fileData) { fileUrl = uploadAttachment(record.fileData, record.fileName, record.mimeType); }
  sheet.appendRow([new Date(), record.room, record.issue, 'รอดำเนินการ', 0, fileUrl]); 
  return 'SUCCESS: แจ้งซ่อมพร้อมแนบไฟล์สำเร็จ!'; 
}

function updateRepairStatusBackend(room, issue, oldStatus, newStatus, cost) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs'); var data = sheet.getDataRange().getValues();
    for(var i=1; i<data.length; i++) {
      if(data[i] && data[i][1] && data[i][1].toString().trim() === room.toString().trim() && data[i][2] === issue && data[i][3] === oldStatus) {
        sheet.getRange(i+1, 4).setValue(newStatus); sheet.getRange(i+1, 5).setValue(parseFloat(cost) || 0); return "SUCCESS: อัปเดตสถานะงานซ่อมเรียบร้อย";
      }
    }
    return "ERROR: ไม่พบรายการแจ้งซ่อมนี้";
  } catch(e) { return "ERROR: " + e.toString(); }
}

function saveExpense(record) { 
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Expenses');
  if(!sheet) { 
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Expenses'); 
      sheet.appendRow(['Timestamp','Date','Category','Amount','Note','AttachmentURL']); 
  }
  var fileUrl = "";
  if (record.fileData) { fileUrl = uploadAttachment(record.fileData, record.fileName, record.mimeType); }
  sheet.appendRow([new Date(), record.date, record.category, record.amount, record.note, fileUrl]); 
  return 'SUCCESS: บันทึกรายจ่ายพร้อมแนบไฟล์สำเร็จ!'; 
}

function getBatchInvoiceData(month) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var setSheet = ss.getSheetByName('Settings'); var settings = {}; 
  if(setSheet) { var setValues = setSheet.getDataRange().getValues(); for (var i = 0; i < setValues.length; i++) { if(setValues[i] && setValues[i][0]) settings[setValues[i][0].toString().trim()] = setValues[i][1]; } }
  var roomSheet = ss.getSheetByName('Rooms'); var roomsDict = {}; 
  if(roomSheet) { var rData = roomSheet.getDataRange().getValues() || []; rData.shift(); for(var i=0; i<rData.length; i++) { if(rData[i] && rData[i][0]) roomsDict[rData[i][0].toString().trim()] = { name: rData[i][2], rent: parseFloat(rData[i][3]) || 0, status: rData[i][1] ? rData[i][1].toString().trim() : '' }; } }
  
  // Parse target month into a Date for comparison
  var targetParts = month.trim().split('/');
  var targetDate = targetParts.length === 2 ? new Date(parseInt(targetParts[1]), parseInt(targetParts[0])-1, 1) : null;
  
  var meterSheet = ss.getSheetByName('Meters'); var currentMeters = {}; var allMeterRows = [];
  if(meterSheet) { 
    var mData = meterSheet.getDataRange().getValues() || []; mData.shift(); 
    for(var i=0; i<mData.length; i++) { 
      var m = mData[i]; if(!m || !m[1] || !m[2]) continue; 
      var mMonth = parseMonthString(m[1]); var roomNo = m[2].toString().trim();
      allMeterRows.push({ month: mMonth, room: roomNo, cw: parseFloat(m[3]) || 0, ce: parseFloat(m[4]) || 0 });
      if(mMonth === month.trim() && roomNo !== '') {
        currentMeters[roomNo] = { cw: parseFloat(m[3]) || 0, ce: parseFloat(m[4]) || 0 }; 
      } 
    } 
  }
  
  var invoices = []; var meterKeys = Object.keys(currentMeters);
  for(var i=0; i<meterKeys.length; i++) { 
    var roomNo = meterKeys[i]; var cur = currentMeters[roomNo]; var rInfo = roomsDict[roomNo] || { name: '-', rent: 0, status: '' };
    
    // Find previous month meter reading (closest month before target)
    var prevW = 0; var prevE = 0; var hasPrev = false;
    if(targetDate) {
      var bestDate = null;
      for(var j=0; j<allMeterRows.length; j++) {
        var row = allMeterRows[j]; if(row.room !== roomNo) continue;
        var rp = row.month ? row.month.split('/') : []; if(rp.length !== 2) continue;
        var rowDate = new Date(parseInt(rp[1]), parseInt(rp[0])-1, 1);
        if(rowDate < targetDate) { 
          if(bestDate === null || rowDate > bestDate) { 
            bestDate = rowDate; prevW = row.cw; prevE = row.ce; hasPrev = true; 
          } 
        }
      }
    }
    
    // Calculate units used = current reading - previous reading, rounded to integer
    var wu = Math.round(Math.max(0, cur.cw - prevW));
    var eu = Math.round(Math.max(0, cur.ce - prevE));
    
    var wRate = parseFloat(settings.WaterRate) || 0;
    var eRate = parseFloat(settings.ElecRate) || 0;
    var cTotal = parseFloat(settings.CommonFee) || 0;
    var wTotal = wu * wRate; 
    var eTotal = eu * eRate;
    
    invoices.push({ 
      room: roomNo, name: rInfo.name, status: rInfo.status, rent: rInfo.rent, 
      waterUnit: wu, waterTotal: wTotal, 
      elecUnit: eu, elecTotal: eTotal, 
      common: cTotal, grandTotal: rInfo.rent + wTotal + eTotal + cTotal, 
      cw: Math.round(cur.cw), ce: Math.round(cur.ce), 
      prevW: Math.round(prevW), prevE: Math.round(prevE) 
    }); 
  }
  return { settings: settings, invoices: invoices };
}

function uploadFileToDrive(base64Data, filename, mimeType, roomNo) {
  try {
    var folderIterator = DriveApp.getFoldersByName("DormManager_TenantFiles"); var folder;
    if (folderIterator.hasNext()) { folder = folderIterator.next(); } else { folder = DriveApp.createFolder("DormManager_TenantFiles"); }
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    var file = folder.createFile(blob); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
    var ss = SpreadsheetApp.getActiveSpreadsheet(); var sheet = ss.getSheetByName('TenantFiles');
    if (!sheet) { sheet = ss.insertSheet('TenantFiles'); sheet.appendRow(['Timestamp', 'RoomNo', 'FileName', 'FileURL']); }
    sheet.appendRow([new Date(), roomNo.toString(), filename, file.getUrl()]);
    return "SUCCESS: อัพโหลดไฟล์ " + filename + " สำเร็จ!";
  } catch (e) { return "ERROR: " + e.toString(); }
}

/**
 * สร้างโครงสร้างฐานข้อมูลสำหรับการใช้งานครั้งแรก
 * เรียกใช้จาก Apps Script editor เพียงครั้งเดียว (Run > initializeDatabase)
 * ข้อมูลเดิมจะไม่ถูกลบหรือเขียนทับ
 */
function initializeDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('กรุณาผูก Apps Script นี้กับ Google Sheet ฐานข้อมูลก่อน');

  var schemas = {
    Settings: ['Key', 'Value'],
    Rooms: ['RoomNo', 'Status', 'TenantName', 'Rent', 'Phone', 'ContractStart', 'ContractEnd', 'Deposit', 'Line', 'Email', 'IdCard', 'Notes'],
    Meters: ['Timestamp', 'Month', 'RoomNo', 'WaterReading', 'ElecReading', 'WaterUnits', 'ElecUnits', 'PaymentStatus', 'PaidDate'],
    TenantHistory: ['Timestamp', 'RoomNo', 'TenantName', 'Phone', 'ContractStart', 'MoveOutDate', 'Notes'],
    Repairs: ['Timestamp', 'RoomNo', 'Issue', 'Status', 'Cost', 'AttachmentURL'],
    Expenses: ['Timestamp', 'Date', 'Category', 'Amount', 'Note', 'AttachmentURL'],
    TenantFiles: ['Timestamp', 'RoomNo', 'FileName', 'FileURL'],
    LineUsers: ['Timestamp', 'RoomNo', 'UserId', 'DisplayName'],
    LineSent: ['Timestamp', 'Month', 'RoomNo'],
    Adjustments: ['Timestamp', 'Month', 'RoomNo', 'Label', 'Amount']
  };

  Object.keys(schemas).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, schemas[name].length)
        .setFontWeight('bold').setBackground('#D4A373');
    }
  });

  var settings = ss.getSheetByName('Settings');
  if (settings.getLastRow() <= 1) {
    settings.getRange(2, 1, 5, 2).setValues([
      ['DormName', 'หอพักของฉัน'],
      ['WaterRate', 18],
      ['ElecRate', 8],
      ['CommonFee', 0],
      ['DueDay', 5]
    ]);
  }
  initPermissions();
  return 'SUCCESS: เตรียมฐานข้อมูลเรียบร้อยแล้ว';
}

// ============================================================
//  LINE OA (Messaging API) — webhook เก็บ userId + push บิล
//  หมายเหตุ: Apps Script doPost อ่าน HTTP header ไม่ได้ จึง
//  ตรวจ X-Line-Signature ไม่ได้ ป้องกันด้วย "คีย์ลับใน URL"
//  (?k=xxx) แทน — ตั้งคีย์ในหน้าตั้งค่า (LineWebhookKey)
// ============================================================

function getWebAppUrl() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function readSettingsObj_() {
  var obj = {};
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    var v = sh.getDataRange().getValues();
    for (var i = 0; i < v.length; i++) { if (v[i] && v[i][0]) obj[v[i][0].toString().trim()] = v[i][1]; }
  } catch (e) {}
  return obj;
}

function getLineUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('LineUsers');
  if (!sh) { sh = ss.insertSheet('LineUsers'); sh.appendRow(['Timestamp', 'RoomNo', 'UserId', 'DisplayName']); sh.setFrozenRows(1); }
  return sh;
}

// คืน array [{room, userId}] ให้ฝั่งหน้าเว็บรู้ว่าห้องไหนผูกไลน์แล้ว (ไม่ส่ง userId เต็มก็ได้ แต่ใช้เช็คสถานะ)
function getLineUsers_() {
  try {
    var v = getLineUsersSheet_().getDataRange().getValues();
    var map = {};
    for (var i = 1; i < v.length; i++) {
      if (v[i] && v[i][1] && v[i][2]) map[v[i][1].toString().trim()] = v[i][2].toString().trim(); // ห้องล่าสุดชนะ
    }
    var out = [];
    Object.keys(map).forEach(function (r) { out.push({ room: r, userId: map[r] }); });
    return out;
  } catch (e) { return []; }
}

function getLineUserMap_() {
  var map = {}; getLineUsers_().forEach(function (u) { map[u.room] = u.userId; }); return map;
}

function normalizeRoom_(text) {
  if (!text) return '';
  var t = text.toString().toUpperCase().replace(/\s+/g, '').replace(/[ห้องROOM:：#]/g, '');
  return /^[A-Z]?\d{1,4}[A-Z]?$/.test(t) ? t : '';
}

// upsert: หนึ่งห้อง = หนึ่ง userId ล่าสุด ; matched=true ถ้ามีห้องนี้ในแท็บ Rooms
function linkLineUser_(room, userId, displayName) {
  var sh = getLineUsersSheet_();
  var v = sh.getDataRange().getValues();
  var rowFound = -1;
  for (var i = 1; i < v.length; i++) { if (v[i] && v[i][1] && v[i][1].toString().trim() === room) { rowFound = i + 1; break; } }
  if (rowFound > 0) {
    sh.getRange(rowFound, 1).setValue(new Date());
    sh.getRange(rowFound, 3).setValue(userId);
    if (displayName) sh.getRange(rowFound, 4).setValue(displayName);
  } else {
    sh.appendRow([new Date(), room, userId, displayName || '']);
  }
  var matched = false;
  try {
    var rooms = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rooms').getDataRange().getValues();
    for (var j = 1; j < rooms.length; j++) { if (rooms[j] && rooms[j][0] && rooms[j][0].toString().trim() === room) { matched = true; break; } }
  } catch (e) {}
  return { matched: matched };
}

function lineReply_(token, replyToken, text) {
  if (!token || !replyToken) return false;
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
  return res.getResponseCode() === 200;
}

function linePush_(token, to, messages) {
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: messages }),
    muteHttpExceptions: true
  });
  return { code: res.getResponseCode(), body: res.getContentText() }; // 200 = สำเร็จ ; อื่นๆ = อ่าน body เพื่อดูสาเหตุ
}

function _lineTxt_(s) { return ContentService.createTextOutput(s || 'OK'); }
function _fmtB_(n) { n = parseFloat(n) || 0; return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

// POST เข้ามาที่ URL ของ web app (ต้อง Deploy เป็น Web app, Anyone) มี 2 แบบ:
//   1) LINE webhook  -> body มี events[]
//   2) หน้าเว็บ (GitHub Pages) -> body = { action, args, token }
function doPost(e) {
  var body = null;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { body = null; }
  if (body && Array.isArray(body.events)) return handleLineWebhook_(e, body);
  if (!body) return jsonOut_({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' });
  return jsonOut_(handleApi_(body));
}

function handleLineWebhook_(e, body) {
  try {
    var s = readSettingsObj_();
    var key = (s.LineWebhookKey || '').toString().trim();
    if (key && (!e || !e.parameter || e.parameter.k !== key)) return _lineTxt_('IGNORED'); // กันคนสุ่มยิง
    var events = body.events || [];
    // ★ ไม่ตอบกลับอัตโนมัติใดๆ ทั้งสิ้น (ห้ามบอทส่งข้อความหาลูกบ้านเอง)
    // ทำแค่ "ผูกเงียบๆ": ถ้าลูกบ้านพิมพ์เลขห้องที่มีจริงในระบบ → บันทึก userId ให้ห้องนั้น โดยไม่ตอบกลับ
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var uid = ev && ev.source && ev.source.userId;
      if (!uid) continue;
      if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
        var room = normalizeRoom_(ev.message.text);
        if (room && roomExists_(room)) linkLineUser_(room, uid, '');
      }
    }
    return _lineTxt_('OK');
  } catch (err) { return _lineTxt_('OK'); } // ตอบ 200 เสมอ กัน LINE ยิงซ้ำ
}

// เช็คว่ามีห้องนี้จริงในแท็บ Rooms (ใช้กันการผูกเลขห้องมั่ว)
function roomExists_(room) {
  try {
    var rooms = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rooms').getDataRange().getValues();
    for (var j = 1; j < rooms.length; j++) { if (rooms[j] && rooms[j][0] && rooms[j][0].toString().trim() === room) return true; }
  } catch (e) {}
  return false;
}

// สร้าง Flex บิลจากข้อมูลที่หน้าเว็บคำนวณมาแล้ว (ตัวเลขตรงกับ calcRoomBill 100%)
function buildBillFlex_(dorm, it, s) {
  function row(label, unit, amt) {
    var contents = [{ type: 'text', text: label, size: 'sm', color: '#555555', flex: 5 }];
    if (unit) contents.push({ type: 'text', text: unit, size: 'sm', color: '#999999', flex: 3, align: 'center' });
    else contents.push({ type: 'text', text: ' ', size: 'sm', flex: 3 });
    contents.push({ type: 'text', text: _fmtB_(amt), size: 'sm', color: '#111111', align: 'end', flex: 4 });
    return { type: 'box', layout: 'horizontal', contents: contents };
  }
  var bodyRows = [];
  if (it.rent > 0) bodyRows.push(row('ค่าเช่าห้อง', '', it.rent));
  bodyRows.push(row('ค่าน้ำ', it.wUnits + ' หน่วย', it.wBill));
  bodyRows.push(row('ค่าไฟ', it.eUnits + ' หน่วย', it.eBill));
  if (it.common > 0) bodyRows.push(row('ค่าส่วนกลาง', '', it.common));
  // รายการปรับยอด (ค่าพิเศษ/หักค่าประกัน) — รวมอยู่ใน it.total แล้ว แสดงเป็นบรรทัดให้ครบ
  if (it.adjustments && it.adjustments.length) {
    for (var ad = 0; ad < it.adjustments.length; ad++) {
      var aAmt = parseFloat(it.adjustments[ad].amount) || 0;
      if (aAmt === 0) continue;
      bodyRows.push(row(it.adjustments[ad].label || 'รายการปรับยอด', '', aAmt));
    }
  }
  var bank = (s.BankName || s.BankAcc) ? ('โอน: ' + (s.BankName || '') + ' ' + (s.BankAcc || '') + (s.BankOwner ? ' (' + s.BankOwner + ')' : '')) : '';
  var due = s.DueText || 'กรุณาชำระภายในวันที่ 5 ของทุกเดือน';
  return {
    type: 'flex',
    altText: 'บิลค่าเช่าห้อง ' + it.room + ' รอบ ' + it.billMonth + ' ยอด ' + _fmtB_(it.total) + ' บาท',
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#BE854A', paddingAll: '16px', contents: [
        { type: 'text', text: dorm, color: '#ffffff', weight: 'bold', size: 'md', wrap: true },
        { type: 'text', text: 'ใบแจ้งค่าเช่า • รอบบิล ' + it.billMonth, color: '#FDF3E7', size: 'sm', margin: 'sm' }
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ห้อง ' + it.room, weight: 'bold', size: 'lg' },
          { type: 'text', text: it.name || '-', size: 'sm', color: '#888888', align: 'end', gravity: 'center', wrap: true }
        ] },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: bodyRows },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [
          { type: 'text', text: 'รวมสุทธิ', weight: 'bold', size: 'md', flex: 5 },
          { type: 'text', text: _fmtB_(it.total) + ' บาท', weight: 'bold', size: 'md', color: '#DC2626', align: 'end', flex: 7 }
        ] }
      ] },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'text', text: due, size: 'xs', color: '#999999', wrap: true }
      ].concat(bank ? [{ type: 'text', text: bank, size: 'xs', color: '#666666', wrap: true }] : []) }
    }
  };
}

// เรียกจากหน้าเว็บ: items = [{room,name,month,billMonth,rent,wUnits,wBill,eUnits,eBill,common,total}, ...]
// month = เดือนที่จด (คีย์จริง) ใช้บันทึกสถานะ "ส่งแล้ว" ; billMonth = ป้ายรอบบิล (+1) ใช้แสดงในการ์ด
function pushLineBills(items) {
  var s = readSettingsObj_();
  var token = (s.LineChannelToken || '').toString().trim();
  if (!token) return { ok: false, sent: [], skip: [], fail: 0, message: 'ERROR: ยังไม่ได้ตั้งค่า Channel access token (หน้าตั้งค่าระบบ)' };
  if (!items || !items.length) return { ok: false, sent: [], skip: [], fail: 0, message: 'ERROR: ไม่มีรายการบิลที่จะส่ง' };
  var map = getLineUserMap_();
  var dorm = s.DormName || 'หอพัก';
  var sentRooms = [], fail = 0, skip = [], errDetail = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var uid = map[String(it.room).trim()];
    if (!uid) { skip.push(it.room); continue; }
    try {
      var pr = linePush_(token, uid, [buildBillFlex_(dorm, it, s)]);
      if (pr.code === 200) { sentRooms.push(it.room); recordLineSent_(it.month, it.room); }
      else { fail++; if (!errDetail) errDetail = 'ห้อง ' + it.room + ' • HTTP ' + pr.code + ' • ' + String(pr.body).substring(0, 300); }
    } catch (e) { fail++; if (!errDetail) errDetail = 'ห้อง ' + it.room + ' • ' + e; }
  }
  var msg = 'ส่งไลน์สำเร็จ ' + sentRooms.length + ' ห้อง';
  if (fail) msg += ' | ผิดพลาด ' + fail + ' ห้อง\nสาเหตุ: ' + errDetail;
  if (skip.length) msg += '\nข้าม (ยังไม่ผูกไลน์) ' + skip.length + ' ห้อง: ' + skip.join(', ');
  return { ok: true, sent: sentRooms, skip: skip, fail: fail, message: msg, error: errDetail };
}

// สร้าง Flex "ใบเสร็จรับเงิน" (สีเขียว) — ตัวเลขตรงกับใบเสร็จในหน้าเว็บ
function buildReceiptFlex_(dorm, it, s) {
  function row(label, unit, amt) {
    var contents = [{ type: 'text', text: label, size: 'sm', color: '#555555', flex: 5 }];
    if (unit) contents.push({ type: 'text', text: unit, size: 'sm', color: '#999999', flex: 3, align: 'center' });
    else contents.push({ type: 'text', text: ' ', size: 'sm', flex: 3 });
    contents.push({ type: 'text', text: _fmtB_(amt), size: 'sm', color: '#111111', align: 'end', flex: 4 });
    return { type: 'box', layout: 'horizontal', contents: contents };
  }
  var bodyRows = [];
  if (it.rent > 0) bodyRows.push(row('ค่าเช่าห้อง', '', it.rent));
  bodyRows.push(row('ค่าน้ำ', it.wUnits + ' หน่วย', it.wBill));
  bodyRows.push(row('ค่าไฟ', it.eUnits + ' หน่วย', it.eBill));
  if (it.common > 0) bodyRows.push(row('ค่าส่วนกลาง', '', it.common));
  if (it.adjustments && it.adjustments.length) {
    for (var ad = 0; ad < it.adjustments.length; ad++) {
      var aAmt = parseFloat(it.adjustments[ad].amount) || 0;
      if (aAmt === 0) continue;
      bodyRows.push(row(it.adjustments[ad].label || 'รายการปรับยอด', '', aAmt));
    }
  }
  var footerRows = [
    { type: 'text', text: 'ชำระแล้วเมื่อ ' + (it.paidText || '-') + (it.method ? ' • ' + it.method : ''), size: 'xs', color: '#16A34A', weight: 'bold', wrap: true },
    { type: 'text', text: 'ขอบคุณที่ชำระเงินตรงเวลาครับ/ค่ะ', size: 'xs', color: '#999999', wrap: true }
  ];
  return {
    type: 'flex',
    altText: 'ใบเสร็จรับเงิน ห้อง ' + it.room + ' รอบ ' + it.billMonth + ' ยอด ' + _fmtB_(it.total) + ' บาท',
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#16A34A', paddingAll: '16px', contents: [
        { type: 'text', text: dorm, color: '#ffffff', weight: 'bold', size: 'md', wrap: true },
        { type: 'text', text: 'ใบเสร็จรับเงิน • รอบบิล ' + it.billMonth, color: '#DCFCE7', size: 'sm', margin: 'sm' }
      ] },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ห้อง ' + it.room, weight: 'bold', size: 'lg' },
          { type: 'text', text: '✓ ชำระแล้ว', size: 'sm', color: '#16A34A', weight: 'bold', align: 'end', gravity: 'center' }
        ] },
        { type: 'text', text: it.name || '-', size: 'sm', color: '#888888', wrap: true },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: bodyRows },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [
          { type: 'text', text: 'ยอดรับชำระ', weight: 'bold', size: 'md', flex: 5 },
          { type: 'text', text: _fmtB_(it.total) + ' บาท', weight: 'bold', size: 'md', color: '#16A34A', align: 'end', flex: 7 }
        ] }
      ] },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerRows }
    }
  };
}

// เรียกจากหน้าเว็บ: items = [{room,name,billMonth,rent,wUnits,wBill,eUnits,eBill,common,adjustments,total,paidText,method}, ...]
function pushLineReceipts(items) {
  var s = readSettingsObj_();
  var token = (s.LineChannelToken || '').toString().trim();
  if (!token) return { ok: false, sent: [], skip: [], fail: 0, message: 'ERROR: ยังไม่ได้ตั้งค่า Channel access token (หน้าตั้งค่าระบบ)' };
  if (!items || !items.length) return { ok: false, sent: [], skip: [], fail: 0, message: 'ERROR: ไม่มีใบเสร็จที่จะส่ง' };
  var map = getLineUserMap_();
  var dorm = s.DormName || 'หอพัก';
  var sentRooms = [], fail = 0, skip = [], errDetail = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var uid = map[String(it.room).trim()];
    if (!uid) { skip.push(it.room); continue; }
    try {
      var pr = linePush_(token, uid, [buildReceiptFlex_(dorm, it, s)]);
      if (pr.code === 200) { sentRooms.push(it.room); }
      else { fail++; if (!errDetail) errDetail = 'ห้อง ' + it.room + ' • HTTP ' + pr.code + ' • ' + String(pr.body).substring(0, 300); }
    } catch (e) { fail++; if (!errDetail) errDetail = 'ห้อง ' + it.room + ' • ' + e; }
  }
  var msg = 'ส่งใบเสร็จทางไลน์สำเร็จ ' + sentRooms.length + ' ห้อง';
  if (fail) msg += ' | ผิดพลาด ' + fail + ' ห้อง\nสาเหตุ: ' + errDetail;
  if (skip.length) msg += '\nข้าม (ยังไม่ผูกไลน์) ' + skip.length + ' ห้อง: ' + skip.join(', ');
  return { ok: true, sent: sentRooms, skip: skip, fail: fail, message: msg, error: errDetail };
}

// ---- ทดสอบว่า token ใช้งานได้จริง (เรียกจากปุ่มในหน้าตั้งค่า) ----
function testLineConnection() {
  var s = readSettingsObj_();
  var token = (s.LineChannelToken || '').toString().trim();
  if (!token) return 'ERROR: ยังไม่ได้บันทึก Channel access token';
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    var code = res.getResponseCode(); var body = res.getContentText();
    if (code === 200) { var j = JSON.parse(body); return 'SUCCESS: เชื่อมต่อสำเร็จ ✅ บอท: ' + (j.displayName || '-') + (j.basicId ? ' (' + j.basicId + ')' : ''); }
    return 'ERROR: token ใช้ไม่ได้ (HTTP ' + code + ') — ' + body;
  } catch (e) { return 'ERROR: ' + e; }
}

// ---- สถานะ "ส่งบิลทางไลน์แล้ว" (คงอยู่ข้ามการรีเฟรช) ----
function getLineSentSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('LineSent');
  if (!sh) { sh = ss.insertSheet('LineSent'); sh.appendRow(['Timestamp', 'Month', 'RoomNo']); sh.setFrozenRows(1); }
  return sh;
}
function getLineSent_() {
  try {
    var v = getLineSentSheet_().getDataRange().getValues(); var out = [];
    for (var i = 1; i < v.length; i++) { if (v[i] && v[i][1] && v[i][2]) out.push({ month: String(v[i][1]).trim(), room: String(v[i][2]).trim() }); }
    return out;
  } catch (e) { return []; }
}
function recordLineSent_(month, room) {
  try {
    if (!month || !room) return;
    var sh = getLineSentSheet_(); var v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) { if (v[i] && String(v[i][1]).trim() === String(month).trim() && String(v[i][2]).trim() === String(room).trim()) return; }
    sh.appendRow([new Date(), "'" + month, "'" + room]); // ★ นำหน้าด้วย ' เพื่อบังคับเก็บเป็น text (กัน Sheets แปลง 07/2026 เป็นวันที่ แล้วสถานะหาย)
  } catch (e) {}
}

// ยกเลิกผูกไลน์ของห้อง (ใช้ตอนเปลี่ยนผู้เช่า/ผู้เช่าย้ายออก) — ลบทั้ง mapping และสถานะส่งแล้วของห้องนั้น
function unlinkLineUser(room) {
  try {
    var r = String(room).trim();
    var su = getLineUsersSheet_(); var vu = su.getDataRange().getValues();
    for (var i = vu.length - 1; i >= 1; i--) { if (vu[i] && vu[i][1] && vu[i][1].toString().trim() === r) su.deleteRow(i + 1); }
    var ss = getLineSentSheet_(); var vs = ss.getDataRange().getValues();
    for (var j = vs.length - 1; j >= 1; j--) { if (vs[j] && vs[j][2] && vs[j][2].toString().trim() === r) ss.deleteRow(j + 1); }
    return 'SUCCESS: ยกเลิกผูกไลน์ห้อง ' + r + ' แล้ว';
  } catch (e) { return 'ERROR: ' + e; }
}

// ============================================================
//  Adjustments (รายการปรับยอด) — ค่าพิเศษ/หักค่าประกัน ต่อ (รอบ+ห้อง)
//  เก็บลงชีต เพื่อให้ "ใบแจ้งหนี้" กับ "บันทึกการชำระ/ใบเสร็จ/รายงาน/ไลน์"
//  ใช้ตัวเลขชุดเดียวกัน (ยอดตรงกันทุกหน้า) — จำนวนเงินติดลบได้ (ใช้หัก)
// ============================================================
function getAdjustmentsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Adjustments');
  if (!sh) { sh = ss.insertSheet('Adjustments'); sh.appendRow(['Timestamp', 'Month', 'RoomNo', 'Label', 'Amount']); sh.setFrozenRows(1); }
  return sh;
}

function getAdjustments_() {
  try {
    var v = getAdjustmentsSheet_().getDataRange().getValues();
    var out = [];
    for (var i = 1; i < v.length; i++) {
      if (!v[i] || v[i][1] === '' || v[i][2] === '' || v[i][1] == null || v[i][2] == null) continue;
      var amt = parseFloat(v[i][4]);
      if (isNaN(amt)) amt = 0;
      out.push({ month: parseMonthString(v[i][1]), room: v[i][2].toString().trim(), label: (v[i][3] || '').toString(), amount: amt });
    }
    return out;
  } catch (e) { return []; }
}

// ============================================================
//  ค่าปรับ/ค่าพิเศษ "รายห้อง" (กรอกเอง — ระบบไม่คิดค่าปรับอัตโนมัติ)
//  items = [{ label, amount, matchPrefix }]
//   - matchPrefix (เช่น 'ค่าปรับ') : ลบรายการเดิมของห้อง+รอบ ที่ชื่อขึ้นต้นด้วยคำนี้ แล้วเขียนใหม่
//   - ไม่มี matchPrefix           : แทนที่รายการที่ชื่อ (label) ตรงกันทุกตัวอักษร
//   - amount = 0                  : ลบรายการนั้นออก
//  คืนค่า { ok, message, adjustments } (adjustments = รายการทั้งหมดล่าสุด ให้หน้าเว็บใช้ตัวเลขชุดเดียวกัน)
// ============================================================
function upsertRoomAdjustments(month, room, items) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var m = (month || '').toString().trim();
    var r = (room == null ? '' : room.toString().trim());
    if (!m || !r) return { ok: false, message: 'ERROR: ไม่พบรอบบิลหรือเลขห้อง' };
    var list = Array.isArray(items) ? items : [];
    var sh = getAdjustmentsSheet_();
    var v = sh.getDataRange().getValues();
    for (var k = 0; k < list.length; k++) {
      var it = list[k]; if (!it) continue;
      var label = (it.label == null ? '' : it.label.toString().trim());
      var prefix = (it.matchPrefix == null ? '' : it.matchPrefix.toString().trim());
      var amount = parseFloat(it.amount); if (isNaN(amount)) amount = 0;
      if (!label && !prefix) continue;
      for (var i = v.length - 1; i >= 1; i--) {
        if (!v[i] || v[i][1] == null || v[i][2] == null || v[i][1] === '' || v[i][2] === '') continue;
        if (parseMonthString(v[i][1]) !== m || v[i][2].toString().trim() !== r) continue;
        var rowLabel = (v[i][3] || '').toString().trim();
        if ((prefix && rowLabel.indexOf(prefix) === 0) || (!prefix && rowLabel === label)) {
          sh.deleteRow(i + 1); v.splice(i, 1);
        }
      }
      if (label && amount !== 0) {
        sh.appendRow([new Date(), "'" + m, "'" + r, label, amount]);
        v.push([new Date(), m, r, label, amount]);
      }
    }
    return { ok: true, message: 'SUCCESS: บันทึกรายการของห้อง ' + r + ' แล้ว', adjustments: getAdjustments_() };
  } catch (e) {
    return { ok: false, message: 'ERROR: ' + e };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// แทนที่รายการปรับยอด "ทั้งรอบบิลนั้น" ด้วยชุดใหม่ (list = [{room,label,amount}, ...])
// วิธีนี้ทำให้กล่องค่าพิเศษในหน้าใบแจ้งหนี้ = ความจริงในฐานข้อมูลของรอบนั้นเสมอ (predictable)
function saveAdjustmentsForMonth(month, list) {
  try {
    var m = (month || '').toString().trim();
    if (!m) return 'ERROR: ไม่พบรอบบิล';
    var sh = getAdjustmentsSheet_();
    var v = sh.getDataRange().getValues();
    // ลบแถวเดิมของรอบนี้ (ไล่จากล่างขึ้นบน)
    for (var i = v.length - 1; i >= 1; i--) {
      if (v[i] && v[i][1] != null && parseMonthString(v[i][1]) === m) sh.deleteRow(i + 1);
    }
    // เขียนชุดใหม่ (บังคับเก็บ Month/RoomNo เป็น text กัน Sheets แปลงเป็นวันที่)
    var cleaned = Array.isArray(list) ? list : [];
    var count = 0;
    for (var j = 0; j < cleaned.length; j++) {
      var it = cleaned[j]; if (!it) continue;
      var room = (it.room == null ? '' : it.room.toString().trim());
      var label = (it.label == null ? '' : it.label.toString().trim());
      var amount = parseFloat(it.amount);
      if (!room || !label || isNaN(amount) || amount === 0) continue; // ข้ามค่าว่าง/0 (แต่ติดลบได้)
      sh.appendRow([new Date(), "'" + m, "'" + room, label, amount]);
      count++;
    }
    return 'SUCCESS: บันทึกรายการปรับยอดรอบ ' + m + ' แล้ว (' + count + ' รายการ)';
  } catch (e) { return 'ERROR: ' + e; }
}
