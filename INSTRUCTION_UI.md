# Interface de Soumission de Problèmes — Guide UI/UX complet

Ce document décrit précisément l'interface de soumission de solutions mathématiques du projet Poly-LLG (fork de Mathraining), afin de permettre à un LLM de la recréer fidèlement dans un autre projet.

---

## Table des matières

1. [Vue d'ensemble & flux utilisateur](#1-vue-densemble--flux-utilisateur)
2. [Composant Post — affichage d'un message](#2-composant-post--affichage-dun-message)
3. [Prévisualisation LaTeX en temps réel](#3-prévisualisation-latex-en-temps-réel)
4. [Formulaire de rédaction (brouillon)](#4-formulaire-de-rédaction-brouillon)
5. [Accordion Rolling — bascule contenu ↔ formulaire](#5-accordion-rolling--bascule-contenu--formulaire)
6. [Page "Nouvelle soumission" — gestion du brouillon](#6-page-nouvelle-soumission--gestion-du-brouillon)
7. [Page "Voir la soumission" — fil de correction](#7-page-voir-la-soumission--fil-de-correction)
8. [Système de réservation (correcteurs)](#8-système-de-réservation-correcteurs)
9. [Formulaire de correction et boutons d'action](#9-formulaire-de-correction-et-boutons-daction)
10. [Avertissements intelligents (IA, plagiat)](#10-avertissements-intelligents-ia-plagiat)
11. [Pièces jointes](#11-pièces-jointes)
12. [Garde de navigation (unsaved changes)](#12-garde-de-navigation-unsaved-changes)
13. [Palette de couleurs & états](#13-palette-de-couleurs--états)
14. [Architecture des statuts de soumission](#14-architecture-des-statuts-de-soumission)
15. [Schéma de données minimal](#15-schéma-de-données-minimal)

---

## 1. Vue d'ensemble & flux utilisateur

```
Étudiant                        Correcteur
   │                                │
   ▼                                │
[Rédige brouillon]                  │
   │  textarea + preview LaTeX      │
   │  sauvegarde auto               │
   ▼                                │
[Envoie la soumission]              │
   │  case à cocher consentement    │
   │  bouton "Soumettre"            │
   ▼                                ▼
[Soumission "en attente"]  ──► [Réserve la soumission]
                                    │
                           [Poste un commentaire]
                           ┌────────┴────────┐
                           │                 │
                    [Refuse] (rouge)   [Accepte] (vert)
                           │                 │
                     soumission        soumission
                     "erronée"         "correcte"
                           │
                  [Étudiant peut commenter
                   ou faire nouvelle soumission]
```

**Règle clé** : un brouillon est unique par couple (utilisateur, problème). L'étudiant peut modifier son brouillon librement avant envoi. Après envoi, s'il veut répondre à un correcteur, il poste un _commentaire_ (modification légère) ou une _nouvelle soumission_ (réécriture complète).

---

## 2. Composant Post — affichage d'un message

Le composant `Post` est la brique de base. Il s'utilise pour afficher une **soumission** ou une **correction**.

### Structure HTML

```html
<div class="post mb-3">

  <!-- En-tête coloré selon le type de message -->
  <div class="header table-ld-primary">   <!-- bleu pour soumission étudiant -->
  <!-- ou class="header table-ld-danger"  -- rouge pour correction correcteur -->

    <!-- Auteur (gauche) -->
    <div class="author h4 mb-0">
      <a href="/users/42">Marie Dupont</a>
    </div>

    <!-- Date (droite) -->
    <div class="date h5 mb-0">17 mai 2026 à 14h32</div>

  </div>

  <!-- Corps du message (LaTeX rendu) -->
  <div class="content">
    <!-- Contenu HTML rendu depuis le texte brut avec MathJax -->
    <p>Soit $f : \mathbb{R} \to \mathbb{R}$...</p>
  </div>

  <!-- Barre d'actions (optionnelle, visible si can_edit) -->
  <div class="modify">
    <a href="#" onclick="return Rolling.develop('')">Modifier la solution</a>
    | <a href="/submissions/7" data-method="delete"
         data-confirm="Êtes-vous sûr ?">Supprimer la solution</a>
  </div>

</div>
```

### CSS du Post (`post.scss`)

```scss
.post > div {
  overflow-x: auto;
  border: 1px solid var(--bs-border-color);

  &:not(:first-child) {
    border-top: none;   /* fusionner les bordures entre sections */
  }
}

.post > .header {
  display: flex;
  flex-direction: column;
  background-color: var(--bs-table-bg);
  border-color: var(--bs-table-border-color);

  @media (min-width: 576px) {   /* sm */
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.post .author,
.post .date {
  padding: 12px 15px;
  font-weight: bold;
}

.post .date {
  text-align: right;
  border-top: 1px solid;
  border-color: inherit;

  @media (min-width: 576px) {
    border-top: none;
  }
}

.post > .content {
  padding: 15px;
  overflow-x: auto;
}

.post > .modify {
  text-align: center;
  padding: 0.5rem;
}
```

### Règle de couleur de l'en-tête

| Condition | Classe CSS | Couleur (light) |
|---|---|---|
| Message de l'étudiant (soumission ou commentaire étudiant) | `table-ld-primary` | Bleu `#cfe2ff` |
| Commentaire d'un correcteur | `table-ld-danger` | Rouge `#f8d7da` |

---

## 3. Prévisualisation LaTeX en temps réel

### Principe

- La prévisualisation est une **carte Bootstrap** placée **au-dessus** du `<textarea>`.
- Elle se met à jour avec un délai de **150 ms** après la frappe.
- MathJax rend le LaTeX. Pour éviter le scintillement, on utilise un **double buffer** : un div caché reçoit le nouveau rendu, puis on permute les deux divs.
- La classe `hidden-latex` sert à masquer un div sans le retirer du DOM (important pour que MathJax calcule les dimensions).

### HTML de la prévisualisation

```html
<!-- Conteneur principal de la prévisualisation -->
<div class="card text-bg-ld-light-dark" id="MathContainer">
  <!-- Le div "preview" affiché -->
  <div class="card-body" id="MathPreview"></div>
  <!-- Le div "buffer" (créé dynamiquement par JS, class="card-body hidden-latex") -->
</div>

<!-- Textarea de saisie -->
<textarea
  class="form-control"
  maxlength="8000"
  style="height:200px;"
  id="MathInput"
></textarea>
```

La preview et le textarea sont **dans la même colonne, empilés verticalement** (preview en haut, textarea en bas). Pas de layout côte à côte.

### CSS pour masquer/afficher

```css
.hidden-latex {
  visibility: hidden;
  height: 0;
  overflow: hidden;
  padding: 0 !important;
  margin: 0 !important;
}
```

### JavaScript — classe Preview complète

```javascript
class Preview {
  constructor(key) {
    this.key = key;
    this.delay = 150;       // ms après frappe avant mise à jour
    this.timeout = null;
    this.mjRunning = false; // MathJax en cours ?
    this.needUpdate = false;// mise à jour demandée pendant le rendu ?
  }

  Init(safe, enableBBCode, enableHiddenText, enableIndice) {
    this.container = document.getElementById("MathContainer" + this.key);
    this.preview   = document.getElementById("MathPreview" + this.key);
    this.input     = document.getElementById("MathInput" + this.key);
    this.buff      = undefined;
    this.safe      = safe;          // true = mode soumission (escape HTML)
    this.bbcode    = enableBBCode;  // true = activer [b], [u], [i], [url=]
    this.hiddentext = enableHiddenText; // true = activer [hide=Label]...[/hide]
    this.indice    = enableIndice;
    this.autoscroll = false;

    // Déclencher la mise à jour à chaque frappe
    this.input.oninput = () => PreviewHandler.UpdateFromUser(this.key);

    // Callback MathJax (peut être appelé plusieurs fois)
    this.callback = MathJax.Callback(["CreatePreview", this]);
    this.callback.autoReset = true;
  }

  // Créer le div buffer (une seule fois)
  CreateBufferDiv() {
    if (this.buff !== undefined) return;
    this.buff = document.createElement("div");
    this.buff.classList.add("card-body", "hidden-latex");
    this.container.appendChild(this.buff);
  }

  // Permuter buffer et preview (sans scintillement)
  SwapBufferAndPreview() {
    const oldHeight = this.preview.offsetHeight;
    const oldScroll = window.scrollY;

    this.preview.classList.add("hidden-latex");
    this.buff.classList.remove("hidden-latex");

    if (this.autoscroll) {
      const newHeight = this.buff.offsetHeight;
      if (Math.abs(newHeight - oldHeight) > 1) {
        window.scrollTo(0, oldScroll + newHeight - oldHeight);
      }
    }

    this.preview.remove();
    this.preview = this.buff;
    this.buff = undefined;
  }

  // Déclencher la mise à jour avec délai
  Update() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(this.callback, this.delay);
  }

  // Appelé après frappe utilisateur
  UpdateFromUser() {
    this.autoscroll = true;
    LeavingForm.SetChangesDone(); // signaler les changements non sauvegardés
    this.Update();
  }

  // Créer la prévisualisation et lancer MathJax
  CreatePreview() {
    this.timeout = null;
    if (this.mjRunning) { this.needUpdate = true; return; }

    this.CreateBufferDiv();

    let text = this.input.value;

    if (this.safe) {
      // Échapper le HTML
      text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        // Éviter les sauts de ligne juste après \] ou $$ (bug MathJax)
        .replace(/\\\][ \r]*\n/g, '\\] ')
        .replace(/\$\$[ \r]*\n/g, '$$$ ');

      if (this.bbcode) {
        text = text
          .replace(/\[b\]((.|\n)*?)\[\/b\]/gmi, '<b>$1</b>')
          .replace(/\[u\]((.|\n)*?)\[\/u\]/gmi, '<u>$1</u>')
          .replace(/\[i\]((.|\n)*?)\[\/i\]/gmi, '<i>$1</i>')
          .replace(/\[url=(.*?)\](.*?)\[\/url\]/gmi, "<a target='blank' href='$1'>$2</a>");
      }

      text = text.replace(/\n/g, '<br/>');
    }

    if (text === this.preview.innerHTML) return; // pas de changement

    this.buff.innerHTML = text;
    this.mjRunning = true;
    this.needUpdate = false;

    // File MathJax : rendre le buffer, puis permuter
    MathJax.Hub.Queue(
      ["Typeset", MathJax.Hub, this.buff],
      ["PreviewDone", this]
    );
  }

  PreviewDone() {
    this.mjRunning = false;
    this.SwapBufferAndPreview();
    if (this.needUpdate) this.CreatePreview(); // si frappe pendant le rendu
  }
}

// Gestionnaire global (plusieurs previews possibles sur une même page)
const PreviewHandler = {
  previews: new Map(),

  Init(key, safe, enableBBCode, enableHiddenText, enableIndice) {
    this.previews.set(key, new Preview(key));
    this.previews.get(key).Init(safe, enableBBCode, enableHiddenText, enableIndice);
  },

  Update(key) { this.previews.get(key).Update(); },
  UpdateFromUser(key) { this.previews.get(key).UpdateFromUser(); },
};
```

**Pourquoi plusieurs previews sur une même page ?**
La page `show.html` peut contenir à la fois le formulaire de modification de la soumission (postfix = `"Submission"`) ET le formulaire de correction (postfix = `""`). Le paramètre `key`/`postfix` différencie les IDs.

---

## 4. Formulaire de rédaction (brouillon)

### Structure complète

```html
<!-- Instructions (en haut du formulaire) -->
<p>
  Merci d'écrire votre solution directement sur le site, en français,
  et en utilisant le $\LaTeX$ pour les formules mathématiques.
  <a href="/chapters/13" target="_blank">Ce chapitre</a> vous donne
  toutes les bases pour l'utiliser. Les solutions écrites à la main
  et scannées ne sont pas acceptées.
</p>
<p>
  L'utilisation d'une intelligence artificielle,
  <u>pour quelque raison que ce soit</u>, est strictement interdite
  et sera systématiquement sanctionnée.
</p>

<!-- Zone prévisualisation LaTeX -->
<div class="mb-2">
  <div class="card text-bg-ld-light-dark" id="MathContainer">
    <div class="card-body" id="MathPreview"></div>
  </div>

  <!-- Barre de smileys (optionnelle) -->
  <div id="smileyBar">...</div>

  <!-- Textarea de saisie -->
  <textarea
    class="form-control"
    maxlength="8000"
    style="height:200px;"
    id="MathInput"
    name="submission[content]"
  ></textarea>

  <!-- Initialisation JS de la prévisualisation -->
  <script>
    initAndUpdatePreviewSafeWhenPossible(
      "",        // postfix (vide = formulaire principal)
      true,      // enableBBCode
      false,     // enableHiddenText
      false      // skipUpdate (true si on charge un brouillon existant sans le modifier)
    );
    initLeavingFormWhenPossible(); // garde de navigation
  </script>
</div>
```

### Boutons du formulaire de brouillon

```html
<!-- Dans _edit.html.erb -->
<button type="submit" class="btn btn-primary mb-1">
  Enregistrer cette solution
</button>
<button class="btn btn-ld-light-dark mb-1"
        onclick="return Rolling.hideActual();">
  Annuler
</button>
```

---

## 5. Accordion Rolling — bascule contenu ↔ formulaire

### Principe UX

La bascule entre "voir la soumission" et "modifier la soumission" se fait via une animation jQuery de 1000 ms. Les deux éléments existent dans le DOM simultanément :

- `#the{postfix}` → div de contenu (hauteur → 0 pour masquer)
- `#form{postfix}` → div de formulaire (hauteur → auto pour afficher)

### HTML

```html
<!-- État initial : contenu visible, formulaire masqué -->
<div id="theSubmission" class="content-part">
  <!-- Composant Post (voir §2) -->
  <div class="post mb-3">...</div>
  <div class="modify">
    <a href="#" onclick="return Rolling.develop('Submission')">
      Modifier la solution
    </a>
  </div>
</div>

<div id="formSubmission" class="form-part px-1" style="height:0px;">
  <!-- Formulaire d'édition (voir §4) -->
  <form>
    ...
    <button type="submit" class="btn btn-primary">Enregistrer</button>
    <button onclick="return Rolling.hideActual();">Annuler</button>
  </form>
</div>
```

### JavaScript Rolling

```javascript
const Rolling = {
  actual: null,
  rollingTime: 1000,  // ms d'animation

  // Cacher le formulaire actuellement ouvert
  hideActual() {
    if (this.actual !== null) {
      // Fermer le formulaire
      $(`#form${this.actual}`).animate({ height: '0px' }, this.rollingTime);
      // Ré-ouvrir le contenu
      const el = $(`#the${this.actual}`);
      const autoHeight = el.css('height', 'auto').height();
      el.height(0).animate({ height: autoHeight }, this.rollingTime,
        () => el.height('auto'));
      this.actual = null;
    }
    return false;
  },

  // Ouvrir le formulaire m (en fermant l'actuel si besoin)
  develop(m) {
    this.hideActual();
    this.actual = m;

    // Masquer le contenu
    $(`#the${m}`).animate({ height: '0px' }, this.rollingTime);

    // Ouvrir le formulaire
    const el = $(`#form${m}`);
    const autoHeight = el.css('height', 'auto').height();
    el.height(0).animate({ height: autoHeight }, this.rollingTime, () => {
      el.height('auto');
      // Scroll vers le formulaire
      const yyy = document.getElementById(`form${m}`).offsetTop - 60;
      $('body,html').animate({ scrollTop: yyy }, this.rollingTime / 2);
      // Déclencher la prévisualisation
      if (document.getElementById(`MathInput${m}`)) {
        PreviewHandler.Update(m);
      }
    });
    return false;
  },

  // Ouverture immédiate (en cas d'erreur de validation)
  develop_quick(m) {
    this.actual = m;
    $(`#the${m}`).height(0);
    $(`#form${m}`).height('auto');
    MathJax.Hub.Queue(() => {
      const yyy = document.getElementById(`form${m}`).offsetTop - 60;
      $('body,html').scrollTop(yyy);
      if (document.getElementById(`MathInput${m}`)) {
        PreviewHandler.Update(m);
      }
    });
  },

  // Scroll vers le contenu sans basculer
  showus(m) {
    MathJax.Hub.Queue(() => {
      const yyy = document.getElementById(`the${m}`).offsetTop - 60;
      $('body,html').scrollTop(yyy);
    });
  }
};
```

**Quand utiliser `develop_quick`** : quand le serveur retourne une erreur de validation sur le formulaire (ex : contenu vide). Dans ce cas, le formulaire doit s'afficher immédiatement sans animation.

---

## 6. Page "Nouvelle soumission" — gestion du brouillon

Cette page a deux états selon que l'utilisateur a déjà un brouillon ou non.

### État A : pas de brouillon (nouveau)

```html
<h3>Nouvelle soumission</h3>

<div id="form" class="form-part px-1">
  <!-- Formulaire de création -->
  <form action="/problems/5/submissions" method="post" enctype="multipart/form-data">
    <!-- §4 : prévisualisation + textarea -->
    ...
    <button type="submit" class="btn btn-primary">
      Enregistrer cette solution
    </button>
  </form>

  <p class="fst-italic">
    Vous pourrez modifier cette solution tant que vous le voudrez
    avant de l'envoyer pour qu'elle soit corrigée.
  </p>
</div>
```

### État B : brouillon existant

```html
<h3>Nouvelle soumission</h3>

<!-- Affichage du brouillon avec action "envoyer" -->
<div id="the" class="content-part">
  <p>Cette solution n'a pas encore été envoyée aux correcteurs.</p>

  <!-- Composant Post (voir §2) -->
  <div class="post mb-3">
    <div class="header table-ld-primary">
      <div class="author h4 mb-0">Marie Dupont</div>
      <div class="date h5 mb-0">17 mai 2026 à 14h32</div>
    </div>
    <div class="content"><!-- contenu rendu --></div>
    <div class="modify">
      <a href="#" onclick="return Rolling.develop('')">Modifier la solution</a>
      | <a href="/submissions/7" data-method="delete"
           data-confirm="Êtes-vous sûr ?">Supprimer la solution</a>
    </div>
  </div>

  <!-- Formulaire d'envoi avec case de consentement -->
  <form action="/submissions/7/send_draft" method="post" enctype="multipart/form-data">

    <script>
      function checkChecked() {
        const c = document.getElementById("consent").checked;
        const bt = document.getElementById("send-button");
        bt.disabled = !c;
      }
    </script>

    <!-- Case à cocher obligatoire -->
    <div class="form-check mb-2 ms-1">
      <label class="form-check-label">
        <input
          type="checkbox"
          id="consent"
          name="consent"
          value="1"
          class="form-check-input"
          onchange="checkChecked()"
        />
        Je comprends que les correcteurs sont bénévoles et vont corriger
        cette solution pendant leur temps libre pour me faire progresser.
        Je certifie donc que cette solution est le fruit de mon travail
        et qu'elle ne provient pas d'une source extérieure.
        Je garantis également ne pas avoir utilisé d'intelligence
        artificielle pour rédiger cette solution.<sup>1</sup>
      </label>
    </div>

    <!-- Bouton désactivé jusqu'à ce que la case soit cochée -->
    <div class="mb-2 text-center">
      <button
        type="submit"
        id="send-button"
        class="btn btn-primary mb-1"
        disabled
        data-confirm="Attention ! Votre solution va être lue par un
          correcteur bénévole.\n\nVeillez à ce que celle-ci soit
          suffisamment claire et bien rédigée..."
      >
        Soumettre cette solution
      </button>
    </div>

    <p style="font-size:12px;">
      <sup>1</sup> Les administrateurs se réservent le droit de bloquer
      l'accès au site aux personnes qui ne sont pas à l'origine de leur
      solution ou qui utilisent l'intelligence artificielle.
    </p>

  </form>
</div>

<!-- Formulaire d'édition du brouillon (masqué initialement) -->
<div id="form" class="form-part px-1" style="height:0px;">
  <form action="/submissions/7" method="post" enctype="multipart/form-data">
    <input type="hidden" name="_method" value="patch"/>
    <!-- §4 : prévisualisation + textarea (avec contenu brouillon pré-rempli) -->
    ...
    <button type="submit" class="btn btn-primary mb-1">
      Enregistrer cette solution
    </button>
    <button class="btn btn-ld-light-dark mb-1"
            onclick="return Rolling.hideActual();">Annuler</button>
  </form>

  <p class="fst-italic">
    Vous pourrez modifier cette solution tant que vous le voudrez
    avant de l'envoyer pour qu'elle soit corrigée.
  </p>
</div>
```

**Points UX importants :**
- Le bouton "Soumettre" est **désactivé par défaut** et ne s'active qu'après avoir coché la case de consentement.
- La case de consentement mentionne explicitement les correcteurs bénévoles et l'interdiction d'IA.
- Un `data-confirm` affiche une alerte JS avant soumission finale.
- Le formulaire d'édition est caché via `height:0px` et s'ouvre via `Rolling.develop('')`.

---

## 7. Page "Voir la soumission" — fil de correction

Structure générale de la page `submissions/show` :

```
┌─────────────────────────────────────────────┐
│  Énoncé du problème (collapsible)           │
├─────────────────────────────────────────────┤
│  <h3>Soumission (statut)</h3>               │
│                                             │
│  [Bandeau de réservation si correcteur]     │
│                                             │
│  [Rappel de l'énoncé collapsible]           │
│                                             │
│  ┌─ Post (soumission) ──────────────────┐   │
│  │ EN-TÊTE BLEU : Auteur | Date         │   │
│  │ ─────────────────────────────────── │   │
│  │ Contenu rendu (LaTeX + HTML)         │   │
│  │ ─────────────────────────────────── │   │
│  │ [Modifier la solution]               │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  [Formulaire modification (masqué)]         │
│                                             │
│  <h4>Commentaires</h4>                      │
│                                             │
│  ┌─ Post (correction) ──────────────────┐   │
│  │ EN-TÊTE ROUGE : Correcteur | Date    │   │
│  │ ─────────────────────────────────── │   │
│  │ Contenu                              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  [Info : commentaire ou nouvelle soumission?]│
│                                             │
│  [Formulaire de nouveau commentaire]        │
│                                             │
│  [Avertissements IA / plagiat]              │
│                                             │
│  [Liens : marquer correct/erroné, supprimer]│
└─────────────────────────────────────────────┘
```

### Titre de la soumission avec statut

```html
<h3>Soumission
  <!-- Afficher le statut entre parenthèses -->
  <span class="text-muted fs-5">
    <!-- selon submission.status : -->
    (en attente de correction)    <!-- waiting / waiting_forever -->
    (erronée)                     <!-- wrong / wrong_to_read -->
    (plagiée)                     <!-- plagiarized -->
    (générée par intelligence artificielle) <!-- generated_with_ai -->
    (clôturée)                    <!-- closed -->
    (correcte)                    <!-- correct -->
  </span>

  <!-- Lien pour afficher/cacher l'énoncé (visible des correcteurs seulement) -->
  <a id="link_show_statement" href="#" onclick="showStatement(); return false;" class="fs-5">
    Rappel de l'énoncé
  </a>
  <a id="link_hide_statement" href="#" onclick="hideStatement(); return false;" class="fs-5" style="display:none;">
    Cacher l'énoncé
  </a>
</h3>
```

### Rappel de l'énoncé (collapsible)

```html
<!-- Masqué par défaut via hidden-latex -->
<div id="statement_reminder" class="card mb-3 hidden-latex">
  <h5 class="card-header">Énoncé</h5>
  <div class="card-body">
    <!-- Contenu de l'énoncé rendu -->
  </div>
</div>

<script>
function showStatement() {
  document.getElementById("link_show_statement").style.display = 'none';
  document.getElementById("link_hide_statement").style.display = 'inline';
  document.getElementById("statement_reminder").classList.remove("hidden-latex");
}
function hideStatement() {
  document.getElementById("link_show_statement").style.display = 'inline';
  document.getElementById("link_hide_statement").style.display = 'none';
  document.getElementById("statement_reminder").classList.add("hidden-latex");
}
</script>
```

### Info : commentaire ou nouvelle soumission ?

Ce bloc s'affiche uniquement si :
- La soumission est "erronée" (`wrong`)
- Le dernier commentaire vient d'un correcteur (pas de l'étudiant)
- L'activité est récente (< 2 mois)

```html
<div class="card mb-3">
  <h5 class="card-header">Commentaire ou nouvelle soumission ?</h5>
  <div class="card-body">
    <p class="mb-2">Votre solution est erronée ou incomplète.
      Deux options s'offrent à vous :</p>
    <ul class="mb-3">
      <li class="mb-1">
        Si l'idée générale de votre solution est correcte mais que vous
        devez apporter une justification complémentaire, faire une
        modification ou corriger une erreur, alors écrivez simplement
        un commentaire ci-dessous.
      </li>
      <li>
        Si votre solution est totalement incorrecte et que vous souhaitez
        en écrire une nouvelle (essentiellement différente), alors faites
        une nouvelle soumission.
      </li>
    </ul>
    <p class="mb-0 fst-italic">
      Merci de respecter cette règle pour simplifier la vie des
      correcteurs et leur faire gagner du temps !
    </p>
  </div>
</div>
```

---

## 8. Système de réservation (correcteurs)

Quand une soumission est en attente, les correcteurs peuvent la **réserver** pour signaler aux autres qu'ils s'en occupent. Trois états sont possibles, affichés via des bandeaux colorés.

### HTML des trois bandeaux

```html
<!-- État 1 : personne n'a réservé → jaune, invitation à réserver -->
<div id="div_reserved_by_nobody" class="mb-2 p-2 ps-3 bg-as-table-ld-warning">
  Avant de corriger cette soumission, prévenez les autres que vous vous en occupez !
  <div class="d-block d-lg-none" style="height:7px;"></div>
  <button class="btn btn-ld-light-dark ms-4" onclick="reserve()">
    Réserver cette soumission
  </button>
</div>

<!-- État 2 : réservée par quelqu'un d'autre → orange, lecture seule -->
<div id="div_reserved_by_other" class="mb-2 p-2 ps-3 bg-as-table-ld-warning-reder">
  <span id="text_reserved_by_other">
    Cette soumission est en train d'être corrigée par <b>Jean Martin</b>.
  </span>
</div>

<!-- État 3 : réservée par moi → vert clair, option d'annulation -->
<div id="div_reserved_by_me" class="mb-2 p-2 ps-3 bg-as-table-ld-warning-greener">
  Vous avez réservé cette soumission pour la corriger.
  <div class="d-block d-lg-none" style="height:7px;"></div>
  <button class="btn btn-ld-light-dark ms-4" onclick="unreserve()">
    Annuler ma réservation
  </button>
</div>
```

### Affichage conditionnel (un seul bandeau visible)

Au chargement, seul le bandeau correspondant à l'état actuel a `display:block` (les autres ont `display:none` inline). Les actions reserve/unreserve appellent un endpoint AJAX qui met à jour le DOM :

```javascript
// Appels AJAX (jQuery getScript — le serveur renvoie du JS)
const reserve = () => $.getScript("/submissions/7/reserve");
const unreserve = () => $.getScript("/submissions/7/unreserve");
```

La réponse JS côté serveur bascule les divs :

```javascript
// Exemple de réponse JS (Rails format .js.erb)
document.getElementById("div_reserved_by_nobody").style.display = "none";
document.getElementById("div_reserved_by_me").style.display = "block";
// Activer les boutons du formulaire de correction
document.querySelectorAll(".to-enable").forEach(el => el.disabled = false);
```

**Clé UX** : quand la soumission est réservée par quelqu'un d'autre, les boutons du formulaire de correction sont **désactivés** (`disable_correction = true`).

---

## 9. Formulaire de correction et boutons d'action

Le formulaire de correction est identique au formulaire de rédaction (même preview LaTeX, même textarea), mais avec des boutons d'action différents selon le rôle et le statut de la soumission.

### Structure du formulaire

```html
<div id="theCorrection">
  <h4>Poster un commentaire</h4>

  <form action="/submissions/7/corrections" method="post" enctype="multipart/form-data">

    <!-- Preview LaTeX (voir §3) -->
    <div class="card text-bg-ld-light-dark" id="MathContainer">
      <div class="card-body" id="MathPreview"></div>
    </div>

    <!-- Textarea -->
    <div class="mb-2">
      <textarea
        class="form-control to-enable"
        maxlength="8000"
        style="height:200px;"
        id="MathInput"
        name="correction[content]"
      ></textarea>
      <script>initAndUpdatePreviewSafeWhenPossible();</script>
    </div>

    <!-- Pièces jointes (voir §11) -->
    ...

    <!-- Champ caché anti-conflit : ID du dernier commentaire connu -->
    <input type="hidden" name="last_id" value="42" />

    <!-- Boutons d'action (voir ci-dessous) -->
    ...

  </form>
</div>
```

### Boutons selon le rôle et l'état

**Pour un correcteur** (statut `waiting`) :

```html
<div class="mb-3">
  <!-- Refuser la soumission -->
  <button type="submit" name="commit" value="Poster et refuser la soumission"
          class="btn btn-danger mb-1 to-enable">
    Poster et refuser la soumission
  </button>

  <!-- Accepter la soumission (avec confirmation) -->
  <button type="submit" name="commit" value="Poster et accepter la soumission"
          class="btn btn-success mb-1 to-enable"
          data-confirm="Êtes-vous sûr de vouloir accepter cette soumission ?
                        Vous ne pourrez plus revenir en arrière.">
    Poster et accepter la soumission
  </button>

  <!-- Clôturer (sanction temporaire) -->
  <button type="submit" name="commit" value="Poster et clôturer la soumission"
          class="btn btn-ld-dark-light-er mb-1 to-enable"
          data-confirm="Êtes-vous sûr de vouloir clore cette soumission ?
                        L'étudiant ne pourra plus travailler sur ce problème
                        pendant une semaine !">
    Poster et clôturer la soumission
  </button>
</div>
```

**Pour un étudiant** (simple commentaire, soumission déjà erronée) :

```html
<button type="submit" class="btn btn-primary mb-3">
  Poster
</button>
```

**Matrice des boutons par statut** :

| Statut soumission | Boutons disponibles (correcteur) |
|---|---|
| `waiting` | Refuser + Accepter + Clôturer |
| `wrong` | Poster (simple) + Accepter + Clôturer |
| `correct` | Poster (simple commentaire seulement) |
| `wrong_to_read` | Accepter + Refuser + Clôturer |

**Classe `.to-enable`** : tous les boutons du formulaire de correction portent cette classe. Quand la soumission est réservée par quelqu'un d'autre, tous les `.to-enable` sont mis `disabled`. Quand on réserve soi-même, le JS les ré-active.

---

## 10. Avertissements intelligents (IA, plagiat)

Ces blocs s'affichent **sous le fil de corrections**, visibles uniquement des correcteurs.

### Avertissement plagiat (extrait externe détecté)

```html
<div class="mb-3 p-2 px-3 bg-as-table-ld-warning-reder">
  <span class="fw-bold text-decoration-underline">Avertissement</span> :
  Certains extraits de cette solution proviennent de
  <a href="https://example.com/solution" target="_blank">example.com/solution</a> :
  <ul class="mb-1">
    <li>Texte de l'extrait correspondant 1</li>
    <li>Texte de l'extrait correspondant 2</li>
  </ul>
  Vérifiez s'il s'agit d'un plagiat et soumettez une suspicion de triche si c'est le cas !
</div>
```

### Avertissement style IA (ChatGPT LaTeX patterns)

```html
<!-- Cas : utilisation suspecte de \[ \] et \( \) style ChatGPT -->
<div class="mb-3 p-2 px-3 bg-as-table-ld-warning-reder">
  <span class="fw-bold text-decoration-underline">Avertissement</span> :
  Cette solution contient <b>3</b> blocs $\LaTeX$ similaires à ce que ChatGPT produit :
  <ul class="tex2jax_ignore mb-1">
    <li>2 utilisations de \[ et \] sur des lignes séparées au lieu de $$</li>
    <li>1 utilisation de \( et \) au lieu de $</li>
  </ul>
  Vérifiez le code et soumettez une suspicion de triche si la solution vous semble suspecte.
</div>

<!-- Cas : utilisateur en liste blanche (a un style naturel similaire) -->
<div class="mb-3 p-2 px-3 bg-as-table-ld-warning-greener">
  <span class="fw-bold text-decoration-underline">Note</span> :
  Cette solution contient <b>3</b> blocs $\LaTeX$ similaires à ce que ChatGPT produit,
  mais il a été considéré par le passé que cet étudiant écrivait bien naturellement
  de cette façon.
</div>
```

**Heuristique de détection IA** :
- Compter les `\[\n` et `\]\n` sur des lignes séparées (style ChatGPT) → humains utilisent `$$`
- Compter les `\(` et `\)` (style ChatGPT) → humains utilisent `$`

### Avertissement : nouvelle soumission postérieure

```html
<div class="mb-3 p-2 px-3 bg-as-table-ld-warning-reder">
  <span class="fw-bold text-decoration-underline">Avertissement</span> :
  Marie Dupont a posté une
  <a href="/problems/5/submissions/9">nouvelle soumission</a>
  à ce problème le 17 mai 2026.
</div>
```

---

## 11. Pièces jointes

### Interface d'ajout de fichiers

```html
<div>
  <label class="form-label">
    Pièces jointes (décochez pour supprimer)
  </label>

  <!-- Fichiers existants (avec case à décocher pour supprimer) -->
  <div class="form-check mb-1">
    <label class="form-check-label">
      <input type="checkbox" name="prevFile_42" value="1" checked class="form-check-input"/>
      <a href="/rails/active_storage/blobs/...">figure.png</a>
    </label>
  </div>

  <!-- Zone d'injection dynamique pour les nouveaux fichiers -->
  <div id="divFiles"></div>

  <!-- Message d'info (affiché quand on ajoute le premier fichier) -->
  <p id="allowedFiles" class="mt-2 mb-2 fst-italic" style="display:none;">
    Types de fichier autorisés : gif, jpg, png, bmp, pdf, txt.<br/>
    Taille maximale autorisée : 1 Mo par fichier, 5 Mo au total.<br/>
    <b>(Pensez à compresser vos fichiers s'ils sont trop volumineux !)</b>
  </p>

  <!-- Bouton d'ajout -->
  <input
    type="button"
    value="Ajouter une pièce jointe"
    id="addFile"
    onclick="Joint.add('')"
    class="btn btn-sm btn-ld-light-dark mb-2 to-enable"
  />
</div>
```

### JavaScript Joint

```javascript
const Joint = {
  id: 0,

  add(postfix) {
    // Afficher les types autorisés au premier ajout
    const allowedFilesEl = document.getElementById(`allowedFiles${postfix}`);
    if (allowedFilesEl) allowedFilesEl.style.display = 'block';

    // Créer un nouvel input file
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = `file${postfix}_${this.id}`;
    fileInput.className = 'form-control mb-1';
    fileInput.accept = '.gif,.jpg,.jpeg,.png,.bmp,.pdf,.txt';

    // Champ caché pour identifier le fichier côté serveur
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = `hidden${postfix}_${this.id}`;
    hiddenInput.value = this.id;

    document.getElementById(`divFiles${postfix}`).appendChild(fileInput);
    document.getElementById(`divFiles${postfix}`).appendChild(hiddenInput);

    this.id++;
  }
};
```

---

## 12. Garde de navigation (unsaved changes)

Lorsque l'utilisateur modifie le textarea sans sauvegarder, une alerte native du navigateur (`beforeunload`) l'avertit avant de quitter la page.

```javascript
const LeavingForm = {
  Init(s = "") {
    this.input = document.getElementById(`MathInput${s}`);

    // Supprimer l'avertissement lors de la soumission volontaire
    this.input.form.onsubmit = () => LeavingForm.SetFormSubmitting();

    window.formSubmitting = false;
    window.originalText = this.input.value;
    window.changesDone = false;

    window.addEventListener("beforeunload", LeavingForm.AskConfirmationIfNeeded);
  },

  SetFormSubmitting() {
    window.formSubmitting = true;
  },

  // Appelé à chaque frappe par la Preview
  SetChangesDone() {
    if (this.input) {
      window.changesDone = (window.originalText !== this.input.value);
    }
  },

  AskConfirmationIfNeeded(e) {
    if (window.formSubmitting || !window.changesDone) return undefined;
    const msg = 'Attention ! Vous perdrez votre texte en quittant cette page.';
    (e || window.event).returnValue = msg;
    return msg;
  }
};
```

**Intégration avec la Preview** : `LeavingForm.SetChangesDone()` est appelé dans `Preview.UpdateFromUser()` à chaque frappe.

---

## 13. Palette de couleurs & états

### Thème clair / sombre (CSS variables Bootstrap 5)

```scss
/* Bleu — soumissions étudiant, en-têtes de posts */
[data-bs-theme="light"] .table-ld-primary {
  --bs-table-bg: #cfe2ff;
  --bs-table-border-color: #bacbe6;
}
[data-bs-theme="dark"] .table-ld-primary {
  --bs-table-bg: #002d73;
  --bs-table-border-color: #144187;
}

/* Rouge — corrections de correcteurs, avertissements */
[data-bs-theme="light"] .table-ld-danger {
  --bs-table-bg: #f8d7da;
  --bs-table-border-color: #dfc2c4;
}
[data-bs-theme="dark"] .table-ld-danger {
  --bs-table-bg: #5f1017;
  --bs-table-border-color: #77141d;
}

/* Jaune — en attente, bandeaux d'info neutres */
[data-bs-theme="light"] .table-ld-warning { --bs-table-bg: #fff3cd; }
[data-bs-theme="dark"]  .table-ld-warning { --bs-table-bg: #413724; }

/* Vert clair — réservé par moi, utilisateur whitelisté */
[data-bs-theme="light"] .table-ld-warning-greener { --bs-table-bg: #e1f3af; }
[data-bs-theme="dark"]  .table-ld-warning-greener { --bs-table-bg: #415724; }

/* Orange — réservé par quelqu'un d'autre, avertissements forts */
[data-bs-theme="light"] .table-ld-warning-reder { --bs-table-bg: #ffd5af; }
[data-bs-theme="dark"]  .table-ld-warning-reder { --bs-table-bg: #613724; }

/* Vert — soumission correcte */
[data-bs-theme="light"] .table-ld-success { --bs-table-bg: #d1e7dd; }
[data-bs-theme="dark"]  .table-ld-success { --bs-table-bg: #254838; }

/* Cyan — nouvelle activité (wrong_to_read) */
[data-bs-theme="light"] .table-ld-info { --bs-table-bg: #cff4fc; }
[data-bs-theme="dark"]  .table-ld-info { --bs-table-bg: #054856; }
```

Les classes `bg-as-table-ld-*` (ex: `bg-as-table-ld-warning`) sont des variantes pour les `<div>` (pas des `<td>`) avec les mêmes couleurs + bordure.

### Correspondance statut → couleur de ligne de tableau

| Statut | Classe CSS | Signification |
|---|---|---|
| `correct` | `table-ld-success` | Vert — solution acceptée |
| `wrong` / `plagiarized` / `generated_with_ai` | `table-ld-danger` | Rouge — rejetée / interdite |
| `waiting` | `table-ld-warning` | Jaune — en attente |
| Réservée par moi | `table-ld-warning-greener` | Vert clair |
| Réservée par autre | `table-ld-warning-reder` | Orange |
| `wrong_to_read` | `table-ld-info` | Bleu — nouvelle réponse du correcteur |
| `draft` / masquée | `table-ld-secondary` | Gris |

---

## 14. Architecture des statuts de soumission

```
draft (-1)           → Brouillon, visible seulement de l'auteur
waiting (0)          → En attente de correction
wrong (1)            → Erronée (correcteur a refusé et l'étudiant a lu)
correct (2)          → Acceptée (points attribués)
wrong_to_read (3)    → Erronée + nouveau commentaire non lu par l'étudiant
plagiarized (4)      → Plagiée (bloquée 6 mois)
closed (5)           → Clôturée (bloquée 1 semaine)
waiting_forever (6)  → Jamais corrigée (sanction grave)
generated_with_ai (7)→ IA détectée (bloquée 6 mois)
```

**Transitions possibles** :
```
draft → waiting          (send_draft)
waiting → wrong          (correction : refuser)
waiting → correct        (correction : accepter)
wrong → wrong_to_read    (nouveau commentaire correcteur)
wrong_to_read → correct  (correction : accepter)
wrong_to_read → wrong    (réponse étudiant)
correct → wrong          (undo, fenêtre 11 min pour correcteur)
waiting → closed         (correction : clôturer)
waiting → plagiarized    (admin)
waiting → generated_with_ai (admin)
waiting → waiting_forever (admin)
```

---

## 15. Schéma de données minimal

```sql
-- Soumissions
CREATE TABLE submissions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  problem_id  INTEGER NOT NULL REFERENCES problems(id),
  content     TEXT NOT NULL,
  status      INTEGER NOT NULL DEFAULT -1,  -- voir §14
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Contrainte : un seul brouillon par (user, problem)
  UNIQUE (user_id, problem_id, status) WHERE status = -1
);

-- Corrections / commentaires
CREATE TABLE corrections (
  id            SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  content       TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Réservations (correcteur qui prend en charge une soumission)
CREATE TABLE followings (
  id            SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, user_id)
);

-- Pièces jointes
CREATE TABLE myfiles (
  id              SERIAL PRIMARY KEY,
  myfiletable_type VARCHAR NOT NULL,  -- 'Submission' ou 'Correction'
  myfiletable_id   INTEGER NOT NULL,
  -- fichier via Active Storage ou équivalent
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Validation de contenu** :
- Longueur max : 8 000 caractères dans le formulaire (les fins de ligne comptent double côté serveur, limite serveur à 16 000)
- Présence obligatoire

---

## Résumé des points UX distinctifs

1. **Preview avant saisie** : la prévisualisation LaTeX est toujours visible au-dessus du textarea, pas dans un onglet séparé.

2. **Double buffer sans scintillement** : MathJax rend dans un div caché, puis les deux divs sont permutés — aucun flash.

3. **Brouillon unique** : un seul brouillon par (utilisateur, problème). Sauvegarder érase le précédent.

4. **Consentement obligatoire** : le bouton "Soumettre" est désactivé jusqu'à ce que la case de consentement soit cochée (+ confirmation modale).

5. **Accordion 1000 ms** : la bascule "voir → éditer" est animée avec jQuery, avec scroll automatique vers le formulaire.

6. **Réservation temps réel** : les bandeaux de réservation se mettent à jour via AJAX sans rechargement de page.

7. **Boutons contextuels** : les boutons du formulaire de correction varient selon le statut de la soumission ET le rôle de l'utilisateur (étudiant/correcteur/admin).

8. **Anti-conflit** : le champ caché `last_id` enregistre l'ID du dernier commentaire connu. Si quelqu'un d'autre poste entre-temps, le serveur refuse et redemande une relecture.

9. **Détection IA heuristique** : détecte automatiquement les patterns LaTeX typiques de ChatGPT (`\[`, `\]`, `\(`, `\)`) et affiche un avertissement aux correcteurs.

10. **Thème clair/sombre** : toutes les couleurs sont définies pour les deux thèmes via `[data-bs-theme]`.
