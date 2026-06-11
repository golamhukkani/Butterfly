const ADMIN_PASSWORD = 'CHANGE_THIS_STRONG_PASSWORD';
const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_CONFIG = 'Config';

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  if (action === 'csv') return exportCsv_(e.parameter.password);
  if (action === 'config') return json_({ ok: true, teams: getTeams_() });
  return json_({ ok: true, message: 'Prediction API is running.' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.action === 'submit') return submit_(data);
    if (data.action === 'saveConfig') return saveConfig_(data);
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name, headers){
  const ss = ss_(); let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers) sh.appendRow(headers);
  return sh;
}
function submit_(d){
  const sh = sheet_(SHEET_SUBMISSIONS, ['Timestamp','Match No','Name','Contact','Team 1 Score','Team 2 Score','Winner','Comment','User Agent']);
  sh.appendRow([new Date(), clean_(d.matchNo), clean_(d.name), clean_(d.contact), clean_(d.score1), clean_(d.score2), clean_(d.winner), clean_(d.comment), clean_(d.userAgent)]);
  return json_({ ok: true });
}
function saveConfig_(d){
  if (d.password !== ADMIN_PASSWORD) return json_({ ok:false, error:'Unauthorized' });
  const sh = sheet_(SHEET_CONFIG, ['Key','Team Name']); sh.clearContents(); sh.appendRow(['Key','Team Name']);
  const rows = Object.entries(d.teams || {}).map(([k,v]) => [k, clean_(v)]);
  if (rows.length) sh.getRange(2,1,rows.length,2).setValues(rows);
  return json_({ ok:true });
}
function getTeams_(){
  const sh = sheet_(SHEET_CONFIG, ['Key','Team Name']); const vals = sh.getDataRange().getValues(); const out = {};
  vals.slice(1).forEach(r => { if (r[0] && r[1]) out[String(r[0])] = String(r[1]); });
  return out;
}
function exportCsv_(password){
  if (password !== ADMIN_PASSWORD) return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
  const sh = sheet_(SHEET_SUBMISSIONS, ['Timestamp','Match No','Name','Contact','Team 1 Score','Team 2 Score','Winner','Comment','User Agent']);
  const csv = sh.getDataRange().getValues().map(row => row.map(csvCell_).join(',')).join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV).downloadAsFile('match_predictions.csv');
}
function clean_(v){ return String(v == null ? '' : v).replace(/[<>]/g, '').trim(); }
function csvCell_(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
