/**
 * Meeting Heroes — Google Apps Script Backend & Standalone WebApp
 * 
 * Déploiement :
 * - Execute as : User accessing the web app
 * - Who has access : Anyone within ADEO
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'fetch_evaluations') {
    var hashesParam = (e && e.parameter && e.parameter.meetingHashes) || '';
    var hashes = hashesParam ? hashesParam.split(',') : [];
    return handleFetchEvaluations({ meetingHashes: hashes });
  } else if (action === 'fetch_my_evaluations') {
    return handleFetchMyEvaluations(e && e.parameter ? e.parameter : {});
  }

  var template = HtmlService.createTemplateFromFile('standalone-vote');
  template.m = (e && e.parameter && e.parameter.m) || '';
  template.key = (e && e.parameter && e.parameter.key) || '';
  template.t = (e && e.parameter && e.parameter.t) || '';

  return template.evaluate()
    .setTitle('Meeting Heroes — Évaluation A Posteriori')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function checkAlreadyVoted(meetingHash) {
  try {
    var activeEmail = Session.getActiveUser().getEmail();
    if (!activeEmail || !meetingHash) return false;
    var voterToken = computeServerToken(activeEmail, meetingHash);
    var sheet = getOrCreateEvaluationsSheet();
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] === meetingHash && values[i][11] === voterToken) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : '';
    var data = JSON.parse(contents);

    // Routage selon l'action
    if (data.action === 'submit_evaluation') {
      return handleSubmitEvaluation(data);
    } else if (data.action === 'fetch_evaluations') {
      return handleFetchEvaluations(data);
    } else if (data.action === 'fetch_my_evaluations') {
      return handleFetchMyEvaluations(data);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: 'Action inconnue' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Point d'entrée pour les appels directs google.script.run depuis l'iframe de la WebApp
function submitEvaluationWeb(payload) {
  var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return processSubmitEvaluation(data);
}

function handleSubmitEvaluation(data) {
  var res = processSubmitEvaluation(data);
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

function processSubmitEvaluation(data) {
  var meetingHash = data.meetingHash;
  if (!meetingHash) {
    return { status: 'error', error: 'meetingHash requis' };
  }

  // Récupère l'utilisateur connecté ADEO si disponible (exécuté en tant que "User accessing the web app")
  var activeEmail = '';
  try {
    activeEmail = Session.getActiveUser().getEmail();
  } catch (e) {}

  // Dérive le voterToken côté serveur pour garantir l'unicité stricte si fourni ou calculé
  var voterToken = data.voterToken;
  if (activeEmail) {
    var raw = activeEmail + '_SALT_ADEO_SECRET_' + meetingHash;
    var hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
    voterToken = hashBytes.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
  }

  var sheet = getOrCreateEvaluationsSheet();
  var values = sheet.getDataRange().getValues();

  // Contrôle d'unicité : 1 seul vote par token et par réunion
  if (voterToken && values.length > 1) {
    for (var i = 1; i < values.length; i++) {
      var rowHash = values[i][1];
      var rowToken = values[i][11];
      if (rowHash === meetingHash && rowToken === voterToken) {
        return { status: 'already_submitted', error: 'Tu as déjà sauvé cette réunion !' };
      }
    }
  }

  // ZÉRO DONNÉE NOMINATIVE : Aucune adresse email ou identifiant en clair n'est écrit
  var nowIso = new Date().toISOString();
  sheet.appendRow([
    nowIso,
    meetingHash,
    data.participant_count || 1,
    data.rating || 0,
    sanitizeText(data.comment, 1000),
    data.duration_feedback || '',
    data.recurrence_feedback || '',
    data.agenda_feedback || '',
    data.efficiency_feedback || '',
    data.format_feedback || '',
    'web_a_posteriori',
    voterToken || ''
  ]);

  return { status: 'success' };
}

function handleFetchEvaluations(data) {
  var hashes = data.meetingHashes || [];
  if (!hashes.length) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }

  var hashSet = {};
  for (var h = 0; h < hashes.length; h++) {
    var cleanH = String(hashes[h] || '').trim().toLowerCase();
    if (cleanH) hashSet[cleanH] = true;
  }

  var sheet = getOrCreateEvaluationsSheet();
  var values = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var mHash = String(row[1] || '').trim().toLowerCase();
    if (hashSet[mHash]) {
      var rawTs = row[0];
      var isoTs = (rawTs instanceof Date) ? rawTs.toISOString() : String(rawTs || '');
      results.push({
        timestamp: isoTs,
        meetingHash: mHash,
        rating: Number(row[3]) || 0,
        comment: String(row[4] || ''),
        duration_feedback: String(row[5] || ''),
        recurrence_feedback: String(row[6] || ''),
        agenda_feedback: String(row[7] || ''),
        efficiency_feedback: String(row[8] || ''),
        format_feedback: String(row[9] || '')
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleFetchMyEvaluations(data) {
  var activeEmail = '';
  try {
    activeEmail = Session.getActiveUser().getEmail();
  } catch (e) {}

  var clientTokens = data && data.voterTokens ? data.voterTokens : [];
  if (typeof clientTokens === 'string') clientTokens = clientTokens.split(',');
  var clientTokenSet = {};
  for (var c = 0; c < clientTokens.length; c++) {
    var tk = String(clientTokens[c]).trim();
    if (tk) clientTokenSet[tk] = true;
  }

  var sheet = getOrCreateEvaluationsSheet();
  var values = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var mHash = String(row[1] || '').trim().toLowerCase();
    var rowToken = String(row[11] || '').trim();

    var isMyVote = false;
    if (clientTokenSet[rowToken]) {
      isMyVote = true;
    } else if (activeEmail && mHash) {
      var expectedToken = computeServerToken(activeEmail, mHash);
      if (rowToken === expectedToken) {
        isMyVote = true;
      }
    }

    if (isMyVote) {
      var rawTs = row[0];
      var isoTs = (rawTs instanceof Date) ? rawTs.toISOString() : String(rawTs || '');
      results.push({
        id: mHash.slice(0, 12),
        meetingHash: mHash,
        title: 'Réunion évaluée',
        startTime: new Date(isoTs).getTime() || Date.now(),
        endTime: new Date(isoTs).getTime() || Date.now(),
        participantCount: Number(row[2]) || 1,
        isOrganizer: false,
        rating: Number(row[3]) || 0,
        comment: String(row[4] || ''),
        details: {
          durationVal: String(row[5] || ''),
          recurrenceVal: String(row[6] || ''),
          agendaVal: String(row[7] || ''),
          efficiencyVal: String(row[8] || ''),
          formatVal: String(row[9] || '')
        }
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}

function computeServerToken(email, meetingHash) {
  var raw = email + '_SALT_ADEO_SECRET_' + meetingHash;
  var hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return hashBytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function getOrCreateEvaluationsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Evaluations');
  if (!sheet) {
    sheet = ss.insertSheet('Evaluations');
    sheet.appendRow([
      'Timestamp', 'MeetingHash', 'Participants', 'Rating', 'Comment',
      'Duration', 'Recurrence', 'Agenda', 'Efficiency', 'Format', 'Origin', 'VoterToken'
    ]);
  }
  return sheet;
}

function sanitizeText(str, maxLength) {
  if (!str) return '';
  var s = String(str).trim();
  if (s.length > maxLength) s = s.substring(0, maxLength);
  // Protection anti-formule Sheets
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}
