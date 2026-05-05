# 🧩 Sudoku Ultimate

> La version complète du Sudoku — 6 thèmes, 4 modes de jeu, techniques de résolution, son, import/export et bien plus.

---

## 🚀 Lancement

Ouvre `index.html` dans ton navigateur. Aucune installation.

```
sudoku-v2/
├── index.html  ← Structure de la page
├── style.css   ← 6 thèmes visuels complets
├── app.js      ← Toute la logique du jeu
└── README.md   ← Ce fichier
```

---

## 🎮 Modes de jeu

| Mode | Description |
|------|-------------|
| 🎯 **Normal** | Mode classique avec limite d'erreurs |
| 🧘 **Zen** | Sans limite d'erreurs — joue à ton rythme |
| ⚡ **Blitz** | Barre de temps qui se vide — résous vite ! |
| 📖 **Apprentissage** | Affiche automatiquement les candidats dans chaque case |

---

## 🎨 Thèmes visuels

| Thème | Ambiance |
|-------|----------|
| 📰 **Journal** | Papier crème, encre bordeaux (défaut) |
| 🌙 **Nuit** | Fond sombre, accent doré |
| 🟤 **Sépia** | Tons chauds vintage |
| 🪨 **Ardoise** | Bleu-gris industriel |
| 💡 **Néon** | Fond noir, cyan fluo |
| ♿ **Daltonien** | Bleu/orange avec indicateurs de forme |

---

## 🆘 Aide disponible

- **💡 Indices** (3 par partie) — révèle la case sélectionnée ou une case aléatoire
- **🔍 Technique** — détecte et surligne une technique de résolution applicable :
  - Singleton nu (une seule case possible pour un chiffre)
  - Singleton caché (un chiffre ne peut aller qu'à un seul endroit dans une unité)
- **✎ Notes** — mode crayon pour noter des candidats
- **✨ Auto-notes** — remplit automatiquement toutes les notes candidates
- **✓ Vérifier** — surligne les erreurs sans révéler la solution
- **↩ Annuler** — historique complet des coups (y compris les auto-notes)

---

## 💾 Sauvegarde & import

- **💾 Sauvegarder** — sauvegarde la partie en cours dans le navigateur
- **📂 Reprendre** — reprend exactement là où tu t'es arrêté (timer inclus)
- **📥 Importer** — colle 81 chiffres (0 pour les cases vides) pour charger une grille externe
- **🔗 Partager** — génère le code de ta grille à envoyer à un ami

---

## 📊 Statistiques

- Parties jouées, victoires, série en cours, taux de réussite
- **Top 5** des meilleurs temps par niveau
- **Graphique** des temps sur les dernières parties
- **Analyse post-partie** : durée, erreurs, temps moyen par case, indices utilisés

---

## 🔊 Son & ambiance

- Son de frappe, erreur, indice, victoire (Web Audio API)
- Musique d'ambiance douce optionnelle (bruit blanc filtré)

---

## ⌨️ Raccourcis clavier

| Touche | Action |
|--------|--------|
| `1–9` | Saisir un chiffre |
| `N` | Activer/désactiver les notes |
| `A` | Auto-notes |
| `Z` | Annuler |
| `H` | Utiliser un indice |
| `T` | Détecter une technique |
| `Suppr` | Effacer la case |
| `↑ ↓ ← →` | Naviguer |

---

## 🛠️ Stack technique

- HTML5 / CSS3 variables (6 thèmes complets)
- JavaScript ES6+ vanilla — zéro dépendance
- Web Audio API — sons et ambiance
- Canvas API — graphique de progression + confettis
- `localStorage` — stats, thème, sauvegarde de partie
