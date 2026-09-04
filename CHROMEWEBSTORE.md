# Chrome Web Store Listing — Meeting Heroes

> Dernière mise à jour : 2026-09-03 (Version 1.1.0)  
> **Extension Item ID :** `ofbfcnphgmibhdleifkegljmlgpmdlgp`  
> **URL Officielle Chrome Web Store :** https://chromewebstore.google.com/detail/ofbfcnphgmibhdleifkegljmlgpmdlgp

---

## 🌍 Stratégie Multi-Langues sur le Chrome Web Store

1. **Langue par défaut (Primary Language) :** **Anglais (English)** recommandé si tu as des collègues hors France (Espagne, Italie, Pologne, Brésil, etc.). Tout utilisateur dont la langue n'a pas de traduction spécifique verra l'anglais.
2. **Traductions secondaires :** **Français (French)**, Espagnol, Italien, etc.
3. **Comment ajouter des traductions dans la console :**
   - Va sur la [Chrome Developer Console](https://chrome.google.com/webstore/devconsole).
   - Sélectionne ton extension > clique sur **Store Listing** (Fiche de la boutique).
   - Dans le menu déroulant en haut à droite de la fiche, clique sur **"Add a language"** (Ajouter une langue).
   - Sélectionne **French** : colle la version française ci-dessous.
   - Sélectionne **English (Default)** : colle la version anglaise ci-dessous.
   - Le Chrome Web Store affichera automatiquement la page en français pour les utilisateurs francophones, et en anglais pour les autres !

---

## 🇬🇧 1. Store Listing — English (Default Language)

### Extension Name [REQUIRED]
`Meeting Heroes - Save your meetings`
*(36 chars — Limit: 75)*

### Short Description [REQUIRED]
`Rate your Google Meet calls in 10 seconds: 100% anonymous feedback, team consensus, and zero wasted time.`
*(106 chars — Limit: 132)*

### Detailed Description [REQUIRED]
*(Plain text without markdown bullets for clean Chrome Web Store rendering)*

Meeting Heroes transforms your Google Meet calls into productive, engaging, and time-respecting moments.

In 10 seconds flat during or after your call, share honest anonymous feedback to help your team continuously improve.

KEY FEATURES

★ Rate in 10 Seconds Flat
Overall score from 1 to 5 stars plus 5 actionable criteria: duration accuracy, recurrence pace, agenda clarity, concrete decisions/next steps, and preferred alternative format (async, message, workshop).

★ Mathematical Anonymity & Zero PII (0 Personally Identifiable Information)
Your reviews are secured by one-way SHA-256 cryptographic hashing. No names, no email addresses, no Google IDs are ever collected or stored. A local anonymous salt token enforces a single vote per participant without revealing your identity.

★ Collective Team Consensus
See collective averages and trends from colleagues directly in the extension popup for every evaluated meeting.

★ Host Mission Control (Heroes HQ)
Review past meetings, track recurring team rituals, and see how team satisfaction evolves over time.

★ Non-Intrusive Notification Badge
The extension icon gently alerts organizers when new feedback arrives, with zero interference during active live calls.

HOW IT WORKS

1. Join your Google Meet call as usual.
2. A discrete "Super-review" button appears in the top header.
3. Submit feedback in 3 clicks during the call or on the exit screen.
4. Open the extension popup to view team consensus and insights.

PRIVACY & SECURITY

- No browsing history or personal email collection.
- No audio, video, or keystroke recording.
- All feedback is routed anonymously to your team's secure backend.
- Data is never sold or shared with third parties.

SUPPORT

Questions or suggestions? Contact your internal support team or visit our project repository.

---

### Category [REQUIRED]
`Productivity`

### Single Purpose [REQUIRED]
`Allow participants and organizers to anonymously rate the quality and efficiency of Google Meet calls in 10 seconds.`

### Primary Language [REQUIRED]
`English`

---

### Permissions Justifications — English (Review form)

- **storage**: `Required to locally store the user's meeting history, anonymous single-vote tokens, and unread review counts on the device.`
- **activeTab**: `Used to securely interact with the active Google Meet tab when the user triggers the feedback panel.`
- **scripting**: `Required to dynamically inject the lightweight rating button and sidebar into the Google Meet interface upon extension updates.`
- **alarms**: `Used to periodically run a lightweight background check (every 10 minutes) to update the unread review badge for meeting hosts.`
- ***://meet.google.com/* *: `Required to inject content scripts that render the in-call rating button and the post-call exit feedback dialog.`
- **https://script.google.com/* & https://script.googleusercontent.com/* *: `Required to securely send and retrieve anonymous SHA-256 hashed evaluation payloads to the organization's backend.`

---

## 🇫🇷 2. Fiche de la boutique — Français (Traduction)

### Nom de l'extension [OBLIGATOIRE]
`Meeting Heroes - Sauve tes réunions`
*(37 caractères — Limite Google : 75)*

### Description courte [OBLIGATOIRE]
`Évaluez vos réunions Google Meet en 10 secondes : notation 100% anonyme, consensus d'équipe et zéro perte de temps.`
*(110 caractères — Limite Google : 132)*

### Description détaillée [OBLIGATOIRE]
*(Formaté sans puces markdown pour éviter la troncature sur le Chrome Web Store)*

Meeting Heroes transforme vos réunions Google Meet en moments utiles, efficaces et respectueux du temps de chacun.

En 10 secondes chrono à la fin ou pendant votre appel, partagez votre super-avis en toute liberté et 100% anonymement pour aider votre équipe à progresser.

FONCTIONNALITÉS CLÉS

★ Évaluation en 10 secondes chrono
Note globale de 1 à 5 étoiles et 5 critères ciblés : durée effective, fréquence de récurrence, clarté de l'ordre du jour, décisions concrètes obtenues, et format alternatif pertinent (message, asynchrone, atelier).

★ Anonymat Mathématique et Zéro Donnée Personnelle (0 PII)
Vos retours sont protégés par un hachage cryptographique irréversible SHA-256. Aucun nom, aucune adresse e-mail, aucun identifiant Google n'est transmis ni stocké. Un jeton cryptographique local garantit un vote unique par participant sans révéler votre identité.

★ Consensus Collectif d'Équipe
Retrouvez directement dans l'extension la note moyenne collective et la tendance des avis de vos collègues sur chaque réunion évaluée.

★ Tableau de Bord Organisateur (QG des Héros)
Consultez l'historique de vos réunions animées, identifiez les axes d'amélioration de vos rituels d'équipe et suivez la progression de la satisfaction des participants.

★ Badge d'Avis Non Lus
L'icône de l'extension vous notifie discrètement lorsqu'un nouveau super-avis a été déposé sur vos réunions animées, sans jamais interférer avec un appel en cours.

COMMENT ÇA MARCHE ?

1. Rejoignez votre réunion Google Meet habituelle.
2. Un bouton discret "Super-avis" s'intègre naturellement dans l'en-tête de la réunion.
3. Donnez votre avis en 3 clics pendant l'appel ou sur l'écran de fin de réunion.
4. Consultez le consensus de l'équipe et pilotez vos réunions depuis le tableau de bord en cliquant sur l'icône de l'extension.

CONFIDENTIALITÉ ET SÉCURITÉ

Meeting Heroes est conçu selon le principe de Privacy-by-Design :
- Aucune collecte d'historique de navigation ni d'e-mail.
- Aucun enregistrement audio, vidéo ou de frappe.
- Toutes les données transitent sous forme de hash anonyme vers votre table d'équipe sécurisée.
- Aucune revente de données.

SUPPORT & CONTACT

Une question, une idée ou un retour ? Contactez notre équipe de support interne ou visitez notre dépôt de projet.

---

### Catégorie [OBLIGATOIRE]
`Productivité` (Productivity)

### Objectif Unique / Single Purpose [OBLIGATOIRE]
`Permettre aux participants et organisateurs d'évaluer de manière anonyme la qualité et l'efficacité de leurs réunions Google Meet en 10 secondes.`

### Langue Principale [OBLIGATOIRE]
`Français`

---

## 2. Éléments Graphiques & Visuels (Graphics & Assets)

| Asset | Dimensions requises | Fichier source / Emplacement | Statut |
|---|---|---|---|
| **Icône Store** [OBLIGATOIRE] | 128×128 PNG | `public/icon128.png` | ✅ Prêt |
| **Capture 1 : 10s Feedback** [OBLIGATOIRE] | 1 280 × 800 px | `store-assets/1-feature-10s-feedback.jpg` | ✅ Prêt (1280×800) |
| **Capture 2 : Team Consensus** [RECOMMANDÉ] | 1 280 × 800 px | `store-assets/2-feature-team-consensus.jpg` | ✅ Prêt (1280×800) |
| **Capture 3 : 100% Anonymity** [RECOMMANDÉ] | 1 280 × 800 px | `store-assets/3-feature-mathematical-anonymity.jpg` | ✅ Prêt (1280×800) |
| **Tuile promotionnelle** [RECOMMANDÉ] | 440 × 280 px | `store-assets/promo-tile-440x280.jpg` | ✅ Prêt (440×280) |

### Guide pour les captures d'écran :
- **Capture 1 (Meet Header) :** Montrer une réunion Google Meet avec le bouton discret Meeting Heroes dans l'en-tête.
- **Capture 2 (Formulaire 10s) :** Montrer le volet latéral ouvert avec la note 1 à 5 étoiles et les 5 critères rapides.
- **Capture 3 (QG des Héros) :** Montrer la popup de l'extension avec la liste des réunions animées, les statistiques collectives et les badges.

---

## 3. Justification des Permissions (Permissions Justification)

*(Texte précis à copier-coller dans le formulaire de révision Google)*

### `storage` (Permission)
> **Justification :** Nécessaire pour sauvegarder localement sur l'appareil de l'utilisateur l'historique de ses évaluations de réunion, ses jetons anonymes de vote unique, et l'état de lecture des avis reçus pour l'organisateur.

### `activeTab` (Permission)
> **Justification :** Utilisé pour interagir de façon sécurisée et éphémère avec l'onglet Google Meet actif au moment où l'utilisateur clique sur l'extension ou sur le bouton d'évaluation.

### `scripting` (Permission)
> **Justification :** Nécessaire pour injecter dynamiquement le bouton et la barre latérale d'évaluation dans l'interface Google Meet existante lors des mises à jour sans nécessiter de rechargement de page.

### `alarms` (Permission)
> **Justification :** Permet d'exécuter une vérification périodique légère en tâche de fond (toutes les 10 minutes) pour actualiser le compteur d'avis non lus reçu par l'organisateur.

### `*://meet.google.com/*` (Host Permission)
> **Justification :** Nécessaire pour injecter le content script (`content.js` et `content.css`) qui affiche le bouton d'évaluation dans l'en-tête de la visioconférence et la pop-up d'évaluation au départ de la réunion.

### `https://script.google.com/*` et `https://script.googleusercontent.com/*` (Host Permissions)
> **Justification :** Nécessaire pour transmettre les évaluations 100% anonymes (sans identifiant personnel) au script d'arrière-plan Google Apps Script de l'entreprise et récupérer les statistiques agrégées des réunions.

---

## 4. Déclaration de Confidentialité (Privacy & Data Use)

### Questions du formulaire Chrome Web Store :

1. **L'extension collecte-t-elle des données utilisateur ?**  
   👉 **Oui** (données d'usage fonctionnelles anonymes uniquement).

| Type de donnée | Collectée ? | Transmise hors de l'appareil ? | Finalité | Partagée avec des tiers ? |
|---|---|---|---|---|
| **Identifiants personnels (Nom, Email, etc.)** | ❌ NON | ❌ NON | Aucune collecte | ❌ NON |
| **Communications personnelles (Chat, audio, vidéo)** | ❌ NON | ❌ NON | Aucune écoute ni enregistrement | ❌ NON |
| **Historique de navigation** | ❌ NON | ❌ NON | Aucune collecte | ❌ NON |
| **Activité de l'utilisateur (Évaluation réunion)** | ✅ OUI | ✅ OUI | Recueillir la note (1-5), les 5 critères de feedback et le commentaire optionnel pour la réunion correspondante. | ❌ NON (conservée dans la base Google Sheets de l'entreprise) |
| **Emplacement géographique / IP** | ❌ NON | ❌ NON | Aucune géolocalisation ni enregistrement d'IP | ❌ NON |

### Certifications de conformité Google [À COCHER DANS LE DASHBOARD] :
- [x] Je certifie que les données ne sont PAS vendues à des tiers.
- [x] Je certifie que les données ne sont PAS utilisées à des fins sans rapport avec la fonctionnalité principale de l'extension.
- [x] Je certifie que les données ne sont PAS utilisées pour déterminer la solvabilité ou à des fins de prêt.

---

## 5. Politique de Confidentialité (Privacy Policy)

**URL recommandée :** Héberger le texte ci-dessous sur GitHub Pages, Google Sites, Notion public ou l'intranet de l'entreprise.

```text
Politique de Confidentialité — Meeting Heroes
Dernière mise à jour : 3 septembre 2026

1. Engagement de Confidentialité
Meeting Heroes est conçue selon le principe de confidentialité dès la conception (Privacy by Design). L'extension n'a pas pour but de tracer les individus mais d'améliorer collectivement la qualité des réunions professionnelles.

2. Données Traitées et Anonymat
- Zéro Donnée Personnelle Identifiante (0 PII) : Meeting Heroes ne collecte, ne stocke et ne transmet aucun nom, prénom, adresse email, adresse IP ou identifiant de compte Google.
- Hachage Cryptographique Unilatéral : Les identifiants de réunions sont hachés localement via l'algorithme SHA-256 avec la date du jour avant toute transmission. Il est mathématiquement impossible de reconstituer le titre ou le lien d'origine à partir de ce hash.
- Jeton de Vote Unique Local : Un sel cryptographique généré aléatoirement et stocké exclusivement sur votre appareil permet de valider l'unicité de votre vote sans lier ce vote à votre identité.

3. Finalité des Données
Les données recueillies (note globale, durée perçue, fréquence, cadrage, efficacité, format alternatif et commentaires qualitatifs libres) sont exclusivement utilisées pour générer le bilan collectif et aider l'organisateur à améliorer ses futurs rendez-vous.

4. Sécurité et Hébergement
Les retours sont transmis via protocole sécurisé HTTPS chiffré vers l'endpoint Google Apps Script de l'organisation. Aucune donnée n'est vendue, louée ou cédée à des régies publicitaires ou tiers commerciaux.

5. Contact
Pour toute question concernant la présente politique de confidentialité, vous pouvez contacter l'équipe projet via le dépôt interne de l'application.
```

---

## 6. Historique des Versions (Version History)

| Version | Date | Changements principaux | Statut |
|---|---|---|---|
| **1.1.0** | 2026-09-03 | Consensus collectif visible pour tous les participants, badge d'avis non lus sans superposition sur appel actif, suppression de la dépendance Google Calendar, branding Meeting Heroes complet. | 🟡 Prêt à soumettre |
| **1.0.0** | 2026-08-15 | Première version initiale avec notation Google Meet 10s et synchronisation Apps Script. | ✅ Publié |

---

## 7. Procédure de Génération du Package ZIP pour le Web Store

Pour soumettre l'extension sur le [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) :

```bash
# 1. Compiler la version de production
npm run build

# 2. Créer le fichier ZIP d'upload propre (depuis le dossier dist/)
cd dist && zip -r ../meeting-heroes-v1.1.0.zip . && cd ..
```

Le fichier `meeting-heroes-v1.1.0.zip` contient uniquement les fichiers nécessaires (`manifest.json`, bundle JS, CSS, icônes, HTML) et exclut tout le code source, tests et `node_modules`.
