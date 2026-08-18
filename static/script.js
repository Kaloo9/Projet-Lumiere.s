let dernieresDonnees = null; // mémorise les dernières données reçues du serveur, pour filtrer/trier sans refaire de fetch

function afficherChargement() {
    document.getElementById("seances").innerHTML = "<p>Chargement des séances...</p>";
}


async function chargerSeances(jour) {
    afficherChargement(); // affiche le message pendant qu'on attend la réponse du serveur
    let url = "/api/seances";
    if (jour) {
        url += `?jour=${jour}`;
    }
    const reponse = await fetch(url);
    const donnees = await reponse.json();
    dernieresDonnees = donnees;
    mettreAJourAffichage();
}

// Affiche/masque la liste de cases à cocher quand on clique sur le bouton "Filtrer par cinéma"
function activerBoutonFiltre() {
    const bouton = document.getElementById("bouton-filtre");
    const listeCinemas = document.querySelector(".liste-cinemas");
    bouton.addEventListener("click", function () {
        if (listeCinemas.style.display === "none") {
            listeCinemas.style.display = "block";
        } else {
            listeCinemas.style.display = "none";
        }
    });
}

// À chaque case cochée/décochée, on redemande l'affichage à jour
function activerFiltreCinema() {
    const cases = document.querySelectorAll(".liste-cinemas input");
    for (const uneCase of cases) {
        uneCase.addEventListener("change", function () {
            mettreAJourAffichage();
        });
    }
}

// Ne garde, parmi les films en mémoire (dernieresDonnees), que ceux présents dans au moins un cinéma coché
function obtenirFilmsFiltres() {
    const cases = document.querySelectorAll(".liste-cinemas input");
    const cinemasCoches = [];
    for (const uneCase of cases) {
        if (uneCase.checked) {
            cinemasCoches.push(uneCase.value);
        }
    }

    const filmsFiltres = {};
    for (const [titre, infos] of Object.entries(dernieresDonnees)) {
        for (const nomCinema of Object.keys(infos.seances)) {
            if (cinemasCoches.includes(nomCinema)) {
                filmsFiltres[titre] = infos;
                break; // un cinéma coché trouvé pour ce film -> pas besoin de vérifier les autres
            }
        }
    }
    return filmsFiltres;
}

// Trie un objet de films (titre -> infos) par date de sortie, selon l'ordre choisi dans le <select>
function trierFilms(filmsObjet, ordre) {
    if (ordre === "defaut") {
        return filmsObjet; // pas de tri demandé, on renvoie tel quel
    }

    const entrees = Object.entries(filmsObjet); // transforme en tableau [[titre, infos], [titre, infos], ...] pour pouvoir utiliser .sort()

    entrees.sort(function (a, b) {
        // a et b sont deux paires [titre, infos] comparées entre elles
        const dateA = a[1].dateSortie;
        const dateB = b[1].dateSortie;

        // Dans le doute (date manquante = null), le film passe en premier, peu importe le sens du tri
        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return -1; // a (sans date) passe avant b
        if (dateB === null) return 1;  // b (sans date) passe avant a

        if (ordre === "sortie-asc") {
            return dateA < dateB ? -1 : 1; // plus ancien en premier
        } else {
            return dateA > dateB ? -1 : 1; // plus récent en premier
        }
    });

    // On reconstruit un objet { titre: infos, ... } à partir du tableau trié
    const filmsTries = {};
    for (const [titre, infos] of entrees) {
        filmsTries[titre] = infos;
    }
    return filmsTries;
}

// Fonction centrale : reprend les films filtrés, les trie selon le <select>, puis les affiche
function mettreAJourAffichage() {
    const filmsFiltres = obtenirFilmsFiltres();
    const ordre = document.getElementById("tri").value;
    const filmsTries = trierFilms(filmsFiltres, ordre);
    afficherFilms(filmsTries);
}

// Redéclenche l'affichage dès qu'on change l'option choisie dans le <select> de tri
function activerTri() {
    const selectTri = document.getElementById("tri");
    selectTri.addEventListener("change", function () {
        mettreAJourAffichage();
    });
}

// Recharge les séances (nouveau fetch) quand on change la date dans le calendrier
function activerSelecteurJour() {
    const inputJour = document.getElementById("jour");
    inputJour.addEventListener("change", function () {
        chargerSeances(inputJour.value);
    });
}

// Construit la grille de films (affiche + titre) et l'injecte dans le DOM
function afficherFilms(donnees) {
    const conteneur = document.getElementById("seances");
    let html = "";

    for (const [titre, infos] of Object.entries(donnees)) {
        html += `
            <div class="film">
                <img src="${infos.poster}" alt="${titre}">
                <h3>${titre}</h3>
                <div class="horaires" style="display: none;">
                    ${genererHorairesHTML(infos.seances)}
                </div>
            </div>
        `;
    }

    conteneur.innerHTML = html;
    activerClics(); // ré-active les clics, car les .film ont été recréés par innerHTML
}

// Construit le HTML des horaires (par cinéma), avec langue (VF/VO) et format (4DX/IMAX/3D)
function genererHorairesHTML(seances) {
    let html = "";
    for (const [nomCinema, horaires] of Object.entries(seances)) {
        html += `<h4>${nomCinema}</h4><ul>`;
        for (const seance of horaires) {
            const heure = seance.startsAt.slice(11, 16); // extrait "HH:MM" de la date complète

            let langue;
            if (seance.diffusionVersion === "ORIGINAL") {
                langue = "VO";
            } else {
                langue = "VF";
            }

            const infosTexte = `${seance.projection} ${seance.experience}`; // conversion en texte, peu importe le type d'origine

            let texteFormat = "";
            if (infosTexte.includes("4DX")) {
                texteFormat = " — 4DX";
            } else if (infosTexte.includes("IMAX")) {
                texteFormat = " — IMAX";
            } else if (infosTexte.includes("3D")) {
                texteFormat = " — 3D";
            }

            html += `<li>${heure} — ${langue}${texteFormat}</li>`;
        }
        html += "</ul>";
    }
    return html;
}

// Clic sur un film -> affiche/masque ses horaires
function activerClics() {
    const films = document.querySelectorAll(".film");
    for (const film of films) {
        film.addEventListener("click", function () {
            const horaires = film.querySelector(".horaires");
            if (horaires.style.display === "none") {
                horaires.style.display = "block";
            } else {
                horaires.style.display = "none";
            }
        });
    }
}

// Lancement au chargement de la page
chargerSeances();
activerSelecteurJour();
activerBoutonFiltre();
activerFiltreCinema();
activerTri();

