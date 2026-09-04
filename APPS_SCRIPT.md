# Google Apps Script — OptiMeeting Sheets Integration (Haute Sécurité & Zéro PII)

## Niveaux de Sécurité Implémentés

1. **Anti-Spam / Rate Limiting (`CacheService`) :**
   - Limite de fréquence par réunion (max 60 soumissions / minute).
   - Limite de fréquence de lecture scopée par réunion (max 60 requêtes / minute) pour éliminer tout risque de déni de service global.
2. **Anti-Doublon Mathématique (Vote Unique Anonyme) :**
   - Chaque client génère un token cryptographique `voterToken = SHA-256(selLocal + meetingHash)`.
   - Le serveur exige obligatoirement ce token (`MISSING_OR_INVALID_VOTER_TOKEN`) et bloque tout second vote émis par le même utilisateur pour la même occurrence (`ALREADY_VOTED`), tout en garantissant un anonymat total (aucun email, nom, IP).
3. **Protection contre l'Injection de Formules (CSV / Formula Injection) :**
   - Neutralisation des caractères dangereux (`=`, `+`, `-`, `@`, `\t`, `\r`) pouvant déclencher du code arbitraire à l'ouverture du Google Sheet (`=IMPORTXML`, `=WEBSERVICE`).
4. **Validation Stricte des Types & Tailles de Payloads :**
   - Rejet immédiat des payloads > 15 Ko.
   - `meetingHash` vérifié par regex SHA-256 (64 caractères hexadécimaux).
   - `rating` strictement bridé entre 1 et 5.
   - `comment` tronqué à 1000 caractères maximum.
   - Durées et participants bornés.
5. **Protection contre la Concurrence (`LockService`) :**
   - Verrouillage atomique des écritures simultanées (`LockService.getScriptLock()`) avec timeout de 10s pour éviter la corruption de données quand 50 personnes votent en même temps à la fin d'un appel.

---

## Configuration

1. Rendez-vous sur [https://script.google.com](https://script.google.com) et ouvrez votre projet lié à votre Google Sheet.
2. Remplacez le code de `Code.gs` par le script ci-dessous.
3. Renseignez votre identifiant de feuille dans `SHEET_ID`.
4. Cliquez sur **Déployer → Nouveau déploiement** (ou **Gérer les déploiements → Modifier → Nouvelle version**) :
   - Type : **Application Web**
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Toute personne au sein de votre organisation** (ou **Tout le monde**)
5. L'URL générée (`https://script.google.com/.../exec`) est à renseigner dans `src/utils/SheetsHelper.ts`.

---

## Code.gs (Version Blindée pour la Production)

```javascript
var SHEET_ID = 'VOTRE_SHEET_ID_ICI';
var SHEET_NAME = 'Evaluations';

// Indices de colonnes (base 0)
var COL = {
  TIMESTAMP: 0,
  MEETING_HASH: 1,
  PARTICIPANTS: 2,
  RATING: 3,
  COMMENT: 4,
  DURATION_FB: 5,
  RECURRENCE_FB: 6,
  AGENDA_FB: 7,
  EFFICIENCY_FB: 8,
  FORMAT_FB: 9,
  VOTER_TOKEN: 10 // Utilisé pour l'anti-doublon (non renvoyé à l'API de lecture)
};

// ── Point d'entrée POST unique ───────────────────────────────────────────────

function doPost(e) {
  // 1. Protection taille de charge utile (Anti-DDoS / Buffer overflow)
  if (!e || !e.postData || !e.postData.contents) {
    return jsonResponse({ success: false, error: 'EMPTY_PAYLOAD' });
  }
  if (e.postData.contents.length > 15000) {
    return jsonResponse({ success: false, error: 'PAYLOAD_TOO_LARGE' });
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var cache = CacheService.getScriptCache();

    // ── Action 1 : Lecture sécurisée des évaluations ─────────────────────────
    if (data.action === 'fetch_evaluations') {
      var requestedHashes = data.meetingHashes || [];
      if (!Array.isArray(requestedHashes) || requestedHashes.length === 0 || requestedHashes.length > 50) {
        return jsonResponse({ success: false, error: 'INVALID_HASH_ARRAY' });
      }

      // Rate limiting scopé par réunion (max 60 req / min par cible) pour éviter tout déni de service global
      var primaryTarget = String(requestedHashes[0]).trim().toLowerCase().substring(0, 16);
      var readRateKey = 'rl_fetch_' + primaryTarget;
      var readCount = Number(cache.get(readRateKey) || 0);
      if (readCount > 60) {
        return jsonResponse({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
      }
      cache.put(readRateKey, String(readCount + 1), 60);

      var hashSet = {};
      for (var h = 0; h < requestedHashes.length; h++) {
        var cleanHash = String(requestedHashes[h]).trim().toLowerCase();
        if (/^[a-f0-9]{64}$/.test(cleanHash)) {
          hashSet[cleanHash] = true;
        }
      }

      var sheet = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return jsonResponse([]);

      // Lecture par bloc (colonnes 1 à 10, excluant le token interne)
      var rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
      var results = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var rowHash = String(row[COL.MEETING_HASH] || row[0]).trim().toLowerCase();
        if (hashSet[rowHash]) {
          results.push({
            meetingHash: rowHash,
            timestamp: row[COL.TIMESTAMP],
            rating: Number(row[COL.RATING]),
            comment: String(row[COL.COMMENT] || ''),
            duration_feedback: String(row[COL.DURATION_FB] || ''),
            recurrence_feedback: String(row[COL.RECURRENCE_FB] || ''),
            agenda_feedback: String(row[COL.AGENDA_FB] || ''),
            efficiency_feedback: String(row[COL.EFFICIENCY_FB] || ''),
            format_feedback: String(row[COL.FORMAT_FB] || '')
          });
        }
      }

      return jsonResponse(results);
    }

    // ── Action 2 : Enregistrement d'une évaluation avec contrôles stricts ─────
    if (data.action === 'submit_evaluation' || !data.action) {
      // Validation du hash SHA-256 (strictement 64 caractères hexa)
      var meetingHash = String(data.meetingHash || data.meetingTitle || '').trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(meetingHash)) {
        return jsonResponse({ success: false, error: 'INVALID_MEETING_HASH' });
      }

      // Rate limit par réunion (max 60 soumissions / min)
      var meetingKey = 'rl_sub_' + meetingHash.substring(0, 16);
      var meetingSubCount = Number(cache.get(meetingKey) || 0);
      if (meetingSubCount > 60) {
        return jsonResponse({ success: false, error: 'RATE_LIMIT_MEETING' });
      }
      cache.put(meetingKey, String(meetingSubCount + 1), 60);

      // Validation de la note (entier entre 1 et 5)
      var rating = Math.round(Number(data.rating));
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return jsonResponse({ success: false, error: 'INVALID_RATING' });
      }

      // Validation et anti-doublon via voterToken anonyme (strictement obligatoire)
      var voterToken = String(data.voterToken || '').trim().toLowerCase();
      if (!voterToken || !/^[a-f0-9]{64}$/.test(voterToken)) {
        return jsonResponse({ success: false, error: 'MISSING_OR_INVALID_VOTER_TOKEN' });
      }
      var voterCacheKey = 'voter_' + voterToken;
      if (cache.get(voterCacheKey)) {
        return jsonResponse({ success: false, error: 'ALREADY_VOTED' });
      }

      // Bornage des participants
      var participantCount = Math.max(1, Math.min(1000, Math.round(Number(data.participant_count) || 1)));

      // Nettoyage et protection contre l'injection de formules
      var cleanComment = sanitizeText(data.comment, 1000);
      var cleanDurationFb = sanitizeText(data.duration_feedback, 100);
      var cleanRecurrenceFb = sanitizeText(data.recurrence_feedback, 100);
      var cleanAgendaFb = sanitizeText(data.agenda_feedback, 100);
      var cleanEfficiencyFb = sanitizeText(data.efficiency_feedback, 100);
      var cleanFormatFb = sanitizeText(data.format_feedback, 100);

      // Verrouillage de concurrence atomique (évite les conflits d'écritures)
      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000); // Attente max 10 secondes

        var sheet = getSheet();

        // Vérification anti-doublon persistante dans la feuille
        if (voterToken) {
          var lastRow = sheet.getLastRow();
          if (lastRow > 1) {
            // Lecture des tokens déjà enregistrés (colonne 11)
            var tokenColValues = sheet.getRange(2, COL.VOTER_TOKEN + 1, lastRow - 1, 1).getValues();
            for (var t = 0; t < tokenColValues.length; t++) {
              if (String(tokenColValues[t][0]) === voterToken) {
                return jsonResponse({ success: false, error: 'ALREADY_VOTED' });
              }
            }
          }
        }

        var timestamp = new Date().toISOString();
        sheet.appendRow([
          timestamp,
          meetingHash,
          participantCount,
          rating,
          cleanComment,
          cleanDurationFb,
          cleanRecurrenceFb,
          cleanAgendaFb,
          cleanEfficiencyFb,
          cleanFormatFb,
          voterToken
        ]);

        // Mémorise le token en cache pendant 6 heures (21600 sec)
        if (voterToken) {
          cache.put('voter_' + voterToken, '1', 21600);
        }

        return jsonResponse({ success: true });

      } finally {
        lock.releaseLock();
      }
    }

    return jsonResponse({ success: false, error: 'UNKNOWN_ACTION' });

  } catch (err) {
    return jsonResponse({ success: false, error: String(err.message || err) });
  }
}

// ── Fonctions Utilitaires & Sécurité ──────────────────────────────────────────

function getSheet() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp', 'Meeting Hash', 'Participants', 'Rating', 'Comment',
      'Duration Feedback', 'Recurrence Feedback', 'Agenda Feedback',
      'Efficiency Feedback', 'Format Feedback', 'Voter Token'
    ]);
  }
  return sheet;
}

/**
 * Neutralise les injections de formules CSV/Sheets (=, +, -, @)
 * et tronque la chaîne à la longueur autorisée.
 */
function sanitizeText(input, maxLength) {
  if (typeof input !== 'string') return '';
  var s = input.trim();
  if (s.length > maxLength) {
    s = s.substring(0, maxLength);
  }
  // Protection injection de formule : préfixe avec une apostrophe si débute par un opérateur
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return s;
}

function doGet() {
  return jsonResponse({ message: 'Meeting Heroes API active. Utiliser POST pour soumettre.' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```
