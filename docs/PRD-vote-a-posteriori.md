# PRD — Évaluation A Posteriori (ADEO Google Apps Script WebApp)

## 1. Fonctionnalité & Objectif
- **Besoin utilisateur** : Permettre à l'organisateur d'un Meet de recueillir les avis des participants même après la fin de l'appel (personnes parties précipitamment ou n'ayant pas encore l'extension installée).
- **Objectif métier** : Maximiser le taux de réponse aux feedbacks de réunion sans forcer l'installation préalable de l'extension, tout en incitant à son adoption via un écran de confirmation dédié.

---

## 2. Cible
- **Organisateur** : Animateur de réunion ADEO disposant de l'extension Meeting Heroes.
- **Votants** : Tous les collaborateurs ADEO (disposent obligatoirement d'un compte Google ADEO Workspace).

---

## 3. Parcours Utilisateur (UX)

### Côté Organisateur (Extension)
- **Points d'accès** :
  1. **Écran de fin d'appel (toast/modal)** : Bouton dédié sous le formulaire :
     > ⚡ **"Réinvoquer les héros : partager le lien de vote"**  
     > *(Copie automatique du lien dans le presse-papier + notification "Lien héroïque copié !")*
  2. **Popup d'historique (dans l'extension)** : Sur chaque réunion passée, bouton/icône pour copier ce même lien.
- **Format du lien** :
  `https://script.google.com/a/macros/adeo.com/s/.../exec?m=<occurrenceHash>&key=<signature>`

### Côté Participant Votant (WebApp Apps Script Standalone)
1. **Accès au lien** :
   - Clic sur le lien partagé (Chat Meet, Slack, Email).
   - **Auth native Google Workspace** : Exécution configurée en *"User accessing the web app"* avec accès restreint à *"Anyone within ADEO"*. Authentification transparente SSO ADEO sans formulaire de login tiers.
2. **Contrôle d'accès & État de vote** :
   - Si l'utilisateur a **déjà voté** pour cette occurrence : écran de blocage convivial :
     > 🛡️ **"Tu as déjà sauvé cette réunion !"**  
     > *Ton avis héroïque est déjà comptabilisé. Installe l'extension pour suivre le consensus d'équipe.*
   - Si premier vote : affichage du formulaire.
3. **Formulaire de vote** :
   - Même UI, composant et thème exact que l'extension (étoiles, badges de durée, tags d'efficacité, critères rôtissoire).
   - Indication claire : *"Vote 100% anonyme pour la réunion du [Date]"*.
4. **Écran de confirmation & Conversion Héroïque** :
   - Message de validation après vote : *"Mission accomplie ! Ton avis héroïque est enregistré."*
   - Note : Les statistiques agrégées et le consensus ne sont **pas affichés sur la page Web** (réservés à l'extension).
   - Encart d'incitation à l'installation :
     > 🦸 **Deviens un Meeting Hero à chaque appel !**  
     > *Évalue directement dans Google Meet en 1 clic sans lien et suis les stats de ton équipe.*  
     > **[Installer l'extension Chrome]**

### Rattachement après installation de l'extension
- Aucun accès à l'API d'identité Google n'est demandé par l'extension (respect strict de la vie privée).
- Un cookie / token persistant anonyme de votant est partagé sur le domaine Google (`script.google.com` / `google.com`).
- Dès l'installation de l'extension, celle-ci lit ce token anonyme pour réconcilier et afficher les avis passés dans l'historique personnel de l'utilisateur.

---

## 4. Périmètre Technique & Architecture

### Front Web Unique (Zéro duplication de code)
- **Source unique** : Réutilisation directe de `RatingForm.tsx`, `i18n.ts` et `content.css`.
- **Entrée Vite & Inlining** : Cible `standalone.html` compilée en un bundle HTML unique (CSS et JS inlinés).
- **Déploiement Clasp** : Le fichier généré est synchronisé et déployé directement sur Google Apps Script via l'outil officiel **Clasp**.

### Backend (Google Apps Script)
- **Mode de déploiement** :
  - **Execute as** : `User accessing the web app` (permet à `Session.getActiveUser().getEmail()` de lire l'email du votant connecté sans le stocker).
  - **Who has access** : `Anyone within ADEO`.
- **`doGet(e)`** :
  - Vérifie la validité de l'occurrence `m`.
  - Calcule le `voterToken` anonyme.
  - Si déjà voté : renvoie directement la vue de blocage *"Déjà sauvé"*.
  - Sinon : sert le template HTML avec les métadonnées.
- **`doPost(e)`** :
  - Enregistre l'évaluation anonyme avec son `voterToken` unique.

---

## 5. Règles Métier, Sécurité & Anonymisation

1. **URL non devinable** :
   - Hash d'occurrence SHA-256 (`meetingId + date UTC`) + signature de validation. Impossible d'énumérer les réunions.
2. **Durée de vie du lien** :
   - Aucune expiration temporelle arbitraire. Le lien reste ouvert tant que l'utilisateur n'a pas voté.
3. **Unicité stricte du vote (1 vote / collaborateur ADEO)** :
   - Calcul côté Apps Script : `voterToken = SHA256(Google_User_Email + Salt_Secret + OccurrenceHash)`.
   - Si le `voterToken` existe déjà dans le Sheet pour cette réunion : soumission rejetée.
4. **Anonymat absolu garanti (Zéro trace nominative)** :
   - L'email ADEO n'est **jamais écrit dans Google Sheets**.
   - Seul le hash cryptographique `voterToken` est persisté.
5. **Réconciliation sans accès identité Google** :
   - Cookie / stockage persistant anonyme partagé entre le domaine WebApp et l'extension.
