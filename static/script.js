let dernieresDonnees = null; // mémorise les dernières données reçues du serveur, pour filtrer/trier sans refaire de fetch
let modeActuel = "jour"; // "jour" ou "periode"

function afficherChargement(avecAvertissement) {
    let html = '<div class="etat-chargement"><p>Chargement des séances...</p>';
    if (avecAvertissement) {
        html += '<p class="avertissement">(Cela risque de prendre un petit moment... Si vous souhaitez gagner du temps, réduisez le nombre de cinémas ou la période).</p>';
    }
    html += '</div>';
    document.getElementById("seances").innerHTML = html;
}


// Va chercher les séances d'un jour précis (ou aujourd'hui si absent)
async function chargerSeances(jour) {
    afficherChargement();
    let url = "/api/seances";
    if (jour) {
        url += `?jour=${jour}`;
    }
    const reponse = await fetch(url);
    const donnees = await reponse.json();
    dernieresDonnees = donnees;
    modeActuel = "jour";
    mettreAJourAffichage();
}

// Va chercher les films d'une période (1/2/3 semaines), pour les cinémas cochés
async function chargerFilmsPeriode(semaines) {
    afficherChargement(true);

    const cinemasCoches = obtenirCinemasCoches();
    const cinemasParam = encodeURIComponent(cinemasCoches.join(","));

    const reponse = await fetch(`/api/films-periode?semaines=${semaines}&cinemas=${cinemasParam}`);
    const donnees = await reponse.json();

    dernieresDonnees = donnees;
    modeActuel = "periode";
    mettreAJourAffichage();
}

// Affiche/masque la liste de cases à cocher quand on clique sur le bouton "Par cinéma :"
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

    // Ferme la liste si on clique n'importe où ailleurs sur la page
    document.addEventListener("click", function (event) {
        const clicDansLaListe = listeCinemas.contains(event.target);
        const clicSurLeBouton = bouton.contains(event.target);
        if (!clicDansLaListe && !clicSurLeBouton) {
            listeCinemas.style.display = "none";
        }
    });
}

// À chaque case cochée/décochée : en mode période on relance un vrai fetch (filtre géré par le serveur),
// en mode jour on réaffiche juste depuis les données déjà en mémoire
function activerFiltreCinema() {
    const cases = document.querySelectorAll(".liste-cinemas input");
    for (const uneCase of cases) {
        uneCase.addEventListener("change", function () {
            if (modeActuel === "periode") {
                chargerFilmsPeriode(document.getElementById("periode").value);
            } else {
                mettreAJourAffichage();
            }
        });
    }
}

// Renvoie juste la liste des cinémas actuellement cochés
function obtenirCinemasCoches() {
    const cases = document.querySelectorAll(".liste-cinemas input");
    const cinemasCoches = [];
    for (const uneCase of cases) {
        if (uneCase.checked) {
            cinemasCoches.push(uneCase.value);
        }
    }
    return cinemasCoches;
}

// Ne garde, parmi les films en mémoire (dernieresDonnees), que ceux présents dans au moins un cinéma coché
function obtenirFilmsFiltres() {
    const cinemasCoches = obtenirCinemasCoches();

    const filmsFiltres = {};
    for (const [titre, infos] of Object.entries(dernieresDonnees)) {
        for (const nomCinema of Object.keys(infos.seances)) {
            if (cinemasCoches.includes(nomCinema)) {
                filmsFiltres[titre] = infos;
                break;
            }
        }
    }
    return filmsFiltres;
}

// Trie un objet de films (titre -> infos) par date de sortie, selon l'ordre choisi dans le <select>
function trierFilms(filmsObjet, ordre) {
    if (ordre === "defaut") {
        return filmsObjet;
    }

    const entrees = Object.entries(filmsObjet);

    entrees.sort(function (a, b) {
        const dateA = a[1].dateSortie;
        const dateB = b[1].dateSortie;

        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return -1;
        if (dateB === null) return 1;

        if (ordre === "sortie-asc") {
            return dateA < dateB ? -1 : 1;
        } else {
            return dateA > dateB ? -1 : 1;
        }
    });

    const filmsTries = {};
    for (const [titre, infos] of entrees) {
        filmsTries[titre] = infos;
    }
    return filmsTries;
}

// Fonction centrale : filtre (seulement en mode jour), trie, puis affiche
function mettreAJourAffichage() {
    let films = dernieresDonnees;

    if (modeActuel === "jour") {
        films = obtenirFilmsFiltres(); // en mode "periode", le backend a déjà filtré par cinéma
    }

    const ordre = document.getElementById("tri").value;
    const filmsTries = trierFilms(films, ordre);
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
        document.getElementById("periode").value = "";
        chargerSeances(inputJour.value);
    });
}

// Recharge les films d'une période quand on change l'option du sélecteur de période
function activerSelecteurPeriode() {
    const selectPeriode = document.getElementById("periode");
    selectPeriode.addEventListener("change", function () {
        if (selectPeriode.value) {
            document.getElementById("jour").value = "";
            chargerFilmsPeriode(selectPeriode.value);
        }
    });
}

// Construit la grille de films (affiche + titre) et l'injecte dans le DOM
function afficherFilms(donnees) {
    const conteneur = document.getElementById("seances");
    let html = "";

    for (const [titre, infos] of Object.entries(donnees)) {
        if (infos.seances) {
            html += `
                <div class="film">
                    <img src="${infos.poster}" alt="${titre}">
                    <h3>${titre}</h3>
                    <div class="horaires" style="display: none;">
                        ${genererHorairesHTML(infos.seances)}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="film">
                    <img src="${infos.poster}" alt="${titre}">
                    <h3>${titre}</h3>
                </div>
            `;
        }
    }

    conteneur.innerHTML = html;
    activerClics();
}

// Construit le HTML des horaires (par cinéma), avec langue (VF/VO), format (4DX/IMAX/3D) et lien de réservation
function genererHorairesHTML(seances) {
    let html = "";
    for (const [nomCinema, horaires] of Object.entries(seances)) {
        html += `<h4>${nomCinema}</h4><ul>`;
        for (const seance of horaires) {
            const heure = seance.startsAt.slice(11, 16);

            let langue;
            if (seance.diffusionVersion === "ORIGINAL") {
                langue = "VO";
            } else {
                langue = "VF";
            }

            const infosTexte = `${seance.projection} ${seance.experience}`;

            let texteFormat = "";
            if (infosTexte.includes("4DX")) {
                texteFormat = " — 4DX";
            } else if (infosTexte.includes("IMAX")) {
                texteFormat = " — IMAX";
            } else if (infosTexte.includes("3D")) {
                texteFormat = " — 3D";
            }

            let contenuSeance = `${heure} — ${langue}${texteFormat}`;

            if (seance.lienReservation) {
                contenuSeance = `<a href="${seance.lienReservation}" target="_blank" rel="noopener">${contenuSeance}</a>`;
            }

            html += `<li>${contenuSeance}</li>`;
        }
        html += "</ul>";
    }
    return html;
}

// Clic sur un film -> affiche/masque ses horaires (ignore les films sans horaires, mode période)
function activerClics() {
    const films = document.querySelectorAll(".film");
    for (const film of films) {
        const horaires = film.querySelector(".horaires");
        if (!horaires) {
            continue;
        }
        film.addEventListener("click", function () {
            if (horaires.style.display === "none") {
                horaires.style.display = "block";
            } else {
                horaires.style.display = "none";
            }
        });
    }
}

// Remet cases cochées, tri et sélecteur de période à leur état par défaut
function reinitialiserFiltresEtTri() {
    const cases = document.querySelectorAll(".liste-cinemas input");
    for (const uneCase of cases) {
        uneCase.checked = true;
    }
    document.getElementById("tri").value = "defaut";
    document.getElementById("periode").value = "";
}

// Lancement au chargement de la page
document.getElementById("jour").value = "";
reinitialiserFiltresEtTri();
chargerSeances();
activerSelecteurJour();
activerSelecteurPeriode();
activerBoutonFiltre();
activerFiltreCinema();
activerTri();
