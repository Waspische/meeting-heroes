# Changelog

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère à [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-09-08

### Améliorations & Corrections
- **Sourdine quotidienne ("Ne plus me demander aujourd'hui")** : ajout de l'option pour masquer le toast de fin d'appel pour le reste de la journée avec persistance dans le stockage local et réinitialisation automatique à minuit.
- **Détection de fin d'appel fiabilisée** : détection multilingue insensible à la langue du navigateur et découplée des sélecteurs CSS minifiés Google Meet.
- **Stabilité de l'ancrage du bouton dans l'en-tête** : positionnement dynamique et stable à droite du titre de la réunion, masquage complet dans la salle d'attente/lobby et suppression des sauts répétés toutes les secondes.
- **Débogage & tests** : injection de `resetMeetingHeroesSilence()` dans la console globale pour faciliter la réinitialisation du silence lors des tests.
- **Traductions** : support complet de la nouvelle clé de mise en sourdine sur l'ensemble des 9 langues supportées (FR, EN, ES, PT, PT-BR, IT, PL, UK, RO).

## [1.1.0] - 2026-09-03

### Ajouté
- Version initiale de Meeting Heroes pour Google Meet.
- Évaluation anonyme en 10 secondes (rôtissoire, critères d'efficacité, consensus d'équipe).
- Partage d'évaluation et synchronisation locale/Google Sheets.
