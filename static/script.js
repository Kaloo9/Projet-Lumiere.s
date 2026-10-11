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

// Affiche/masque le panneau de filtres quand on clique sur le bouton "Filtres"
function activerBoutonFiltre() {
    const bouton = document.getElementById("bouton-filtre");
    const panneau = document.querySelector(".panneau-filtres");

    bouton.addEventListener("click", function () {
        if (panneau.style.display === "none") {
            panneau.style.display = "block";
        } else {
            panneau.style.display = "none";
        }
    });

    // Ferme la liste si on clique n'importe où ailleurs sur la page
    document.addEventListener("click", function (event) {
        const clicDansLaListe = panneau.contains(event.target);
        const clicSurLeBouton = bouton.contains(event.target);
        if (!clicDansLaListe && !clicSurLeBouton) {
            panneau.style.display = "none";
        }
    });
}

// Clic sur un titre de section (Cinéma / Langue / Format) -> ouvre/ferme ses cases, indépendamment des autres
function activerDepliantsFiltres() {
    const titres = document.querySelectorAll(".titre-section");
    for (const titre of titres) {
        titre.addEventListener("click", function () {
            // On remonte à la section qui contient ce titre, puis on y cherche ses cases
            const options = titre.parentElement.querySelector(".options-filtre");

                        const fleche = titre.querySelector(".fleche");

            if (options.style.display === "none") {
                options.style.display = "block";
                fleche.textContent = "▾";   // ouvert
            } else {
                options.style.display = "none";
                fleche.textContent = "▸";   // fermé
            }
        });
    }
}

// À chaque case cochée/décochée : en mode période on relance un vrai fetch (filtre géré par le serveur),
// en mode jour on réaffiche juste depuis les données déjà en mémoire
function activerFiltreCinema() {
    const cases = document.querySelectorAll("#options-cinema input");
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


// Langue / format : toujours filtrés dans le navigateur -> on réaffiche depuis les données en mémoire, sans fetch
function activerFiltresLangueFormat() {
    const cases = document.querySelectorAll("#options-langue input, #options-format input");
    for (const uneCase of cases) {
        uneCase.addEventListener("change", function () {
            mettreAJourAffichage();
        });
    }
}


// Renvoie la liste des valeurs cochées dans un groupe de cases, ex: obtenirValeursCochees("#options-langue") -> ["VO", "VF"]
function obtenirValeursCochees(idGroupe) {
    const cases = document.querySelectorAll(`${idGroupe} input`);
    const valeurs = [];
    for (const uneCase of cases) {
        if (uneCase.checked) {
            valeurs.push(uneCase.value);
        }
    }
    return valeurs;
}

// Renvoie juste la liste des cinémas actuellement cochés
function obtenirCinemasCoches() {
    return obtenirValeursCochees("#options-cinema");
}

// Filtre un objet { cinéma: [séances] } : ne garde que les cinémas cochés, et dans chacun
// que les séances dont la langue ET le format sont cochés. Un cinéma sans séance restante disparaît.
function filtrerSeancesParCinema(seancesParCinema, cinemasCoches, languesCochees, formatsCoches) {
    const resultat = {};

    for (const [nomCinema, seances] of Object.entries(seancesParCinema)) {
        if (!cinemasCoches.includes(nomCinema)) {
            continue; // cinéma décoché -> on passe directement au cinéma suivant
        }

        const seancesGardees = [];
        for (const seance of seances) {
            if (languesCochees.includes(langueDe(seance)) && formatsCoches.includes(formatDe(seance))) {
                seancesGardees.push(seance);
            }
        }

        if (seancesGardees.length > 0) {   // .length = nombre d'éléments dans la liste
            resultat[nomCinema] = seancesGardees;
        }
    }
    return resultat;
}


// Ne garde, parmi les films en mémoire, que ceux qui ont encore au moins une séance après filtrage
function obtenirFilmsFiltres() {
    const cinemasCoches = obtenirCinemasCoches();
    const languesCochees = obtenirValeursCochees("#options-langue");
    const formatsCoches = obtenirValeursCochees("#options-format");

    const filmsFiltres = {};
    for (const [titre, infos] of Object.entries(dernieresDonnees)) {
        const seancesFiltrees = filtrerSeancesParCinema(infos.seances, cinemasCoches, languesCochees, formatsCoches);

        if (Object.keys(seancesFiltrees).length > 0) {   // reste-t-il au moins un cinéma ?
            // NOUVEL objet : mêmes infos que le film, mais seulement avec les séances gardées
            filmsFiltres[titre] = {
                poster: infos.poster,
                dateSortie: infos.dateSortie,
                seances: seancesFiltrees,
            };
        }
    }
    return filmsFiltres;
}

// Mode période : même filtrage qu'en mode jour, mais appliqué à chaque jour de chaque film.
// Un jour sans séance restante disparaît, puis un film sans jour restant disparaît.
function obtenirFilmsPeriodeFiltres() {
    const cinemasCoches = obtenirCinemasCoches();
    const languesCochees = obtenirValeursCochees("#options-langue");
    const formatsCoches = obtenirValeursCochees("#options-format");

    const filmsFiltres = {};
    for (const [titre, infos] of Object.entries(dernieresDonnees)) {

        const joursFiltres = {};
        for (const [jour, seancesDuJour] of Object.entries(infos.joursDiffusion)) {
            // seancesDuJour a la forme { cinéma: [séances] } -> on réutilise la fonction de l'étape 4
            const seancesFiltrees = filtrerSeancesParCinema(seancesDuJour, cinemasCoches, languesCochees, formatsCoches);

            if (Object.keys(seancesFiltrees).length > 0) {   // reste-t-il au moins un cinéma ce jour-là ?
                joursFiltres[jour] = seancesFiltrees;
            }
        }

        if (Object.keys(joursFiltres).length > 0) {   // reste-t-il au moins un jour ?
            // NOUVEL objet, comme à l'étape 4 : dernieresDonnees reste intact
            filmsFiltres[titre] = {
                poster: infos.poster,
                dateSortie: infos.dateSortie,
                joursDiffusion: joursFiltres,
            };
        }
    }
    return filmsFiltres;
}

// Trie un objet de films (titre -> infos) selon l'ordre choisi dans le <select>
function trierFilms(filmsObjet, ordre) {
    const entrees = Object.entries(filmsObjet); // tableau [[titre, infos], ...] pour pouvoir utiliser .sort()

    entrees.sort(function (a, b) {
        // Ordre alphabétique (choix par défaut) : on compare les titres, a[0] et b[0]
        if (ordre === "defaut") {
            return a[0].localeCompare(b[0], "fr"); // "fr" : É est rangé avec les E, À avec les A
        }

        // Sinon : tri par date de sortie, films sans date toujours en premier
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


// Fonction centrale : filtre (selon le mode), trie, puis affiche
function mettreAJourAffichage() {
    let films;
    if (modeActuel === "jour") {
        films = obtenirFilmsFiltres();
    } else {
        films = obtenirFilmsPeriodeFiltres();
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
            // Mode jour : comportement inchangé
            html += `
                <div class="film">
                    <img src="${infos.poster}" alt="${titre}">
                    <h3>${titre}</h3>
                    <div class="horaires" style="display: none;">
                        ${genererHorairesHTML(infos.seances)}
                    </div>
                </div>
            `;
        } else if (infos.joursDiffusion) {
            // Mode période : liste des jours où le film passe
            html += `
                <div class="film">
                    <img src="${infos.poster}" alt="${titre}">
                    <h3>${titre}</h3>
                    <div class="jours" style="display: none;">
                        ${genererJoursHTML(infos.joursDiffusion)}
                    </div>
                </div>
            `;
        }
    }

    // Plus aucun film après filtrage -> un message plutôt qu'une page vide (qui ressemblerait à un bug)
    if (html === "") {
        html = '<div class="aucun-resultat"><p>Aucune séance ne correspond à ta recherche.</p></div>';
    }

    conteneur.innerHTML = html;
    activerClics();
}

// Renvoie "VO" ou "VF" pour une séance (DUBBED et le rare LOCAL comptent comme VF)
function langueDe(seance) {
    if (seance.diffusionVersion === "ORIGINAL") {
        return "VO";
    }
    return "VF";
}

// Renvoie "4DX", "IMAX", "3D" ou "Standard" pour une séance
// (mêmes valeurs que les cases à cocher du filtre Format)
function formatDe(seance) {
    const infosTexte = `${seance.projection} ${seance.experience}`;

    if (infosTexte.includes("4DX")) {
        return "4DX";
    }
    if (infosTexte.includes("IMAX")) {
        return "IMAX";
    }
    if (infosTexte.includes("3D")) {
        return "3D";
    }
    return "Standard";
}


// Construit le HTML des horaires (par cinéma), avec langue (VF/VO), format (4DX/IMAX/3D) et lien de réservation
function genererHorairesHTML(seances) {
    let html = "";
    for (const [nomCinema, horaires] of Object.entries(seances)) {
        html += `<h4>${nomCinema}</h4><ul>`;
        for (const seance of horaires) {
            const heure = seance.startsAt.slice(11, 16);

            const langue = langueDe(seance);
            const format = formatDe(seance);

            let texteFormat = "";
            if (format !== "Standard") {
                texteFormat = ` — ${format}`;   // on n'affiche rien pour une séance standard, comme avant
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
        const jours = film.querySelector(".jours");
        const zoneAOuvrir = horaires || jours; // l'une des deux existe, jamais les deux

        if (!zoneAOuvrir) {
            continue;
        }

        film.addEventListener("click", function () {
            if (zoneAOuvrir.style.display === "none") {
                zoneAOuvrir.style.display = "block";
            } else {
                zoneAOuvrir.style.display = "none";
            }
        });
    }

    activerAccordeonJours();
}


function activerAccordeonJours() {
    const titresJours = document.querySelectorAll(".jour-titre");
    for (const titreJour of titresJours) {
        titreJour.addEventListener("click", function (event) {
            event.stopPropagation(); // empêche ce clic de remonter jusqu'à la carte film

            const jourItem = titreJour.parentElement;
            const horairesJour = jourItem.querySelector(".jour-horaires");
            const dejaOuvert = horairesJour.style.display === "block";

            // Ferme tous les jours de ce film avant d'ouvrir le nouveau
            const conteneurJours = jourItem.parentElement;
            const tousLesHoraires = conteneurJours.querySelectorAll(".jour-horaires");
            for (const h of tousLesHoraires) {
                h.style.display = "none";
            }

            if (!dejaOuvert) {
                horairesJour.style.display = "block";
            }
        });
    }
}

// Remet cases cochées, tri et sélecteur de période à leur état par défaut
function reinitialiserFiltresEtTri() {
    const cases = document.querySelectorAll(".panneau-filtres input");
    for (const uneCase of cases) {
        uneCase.checked = true;
    }
    document.getElementById("tri").value = "defaut";
    document.getElementById("periode").value = "";
}


function genererJoursHTML(joursDiffusion) {
    let html = "";
    const joursTries = Object.keys(joursDiffusion).sort(); // dates au format AAAA-MM-JJ -> tri alphabétique = tri chronologique

    for (const jour of joursTries) {
        const [annee, mois, jourNum] = jour.split("-");
        const dateAffichee = `${jourNum}/${mois}/${annee}`;

        html += `
            <div class="jour-item">
                <h4 class="jour-titre">${dateAffichee}</h4>
                <div class="jour-horaires" style="display: none;">
                    ${genererHorairesHTML(joursDiffusion[jour])}
                </div>
            </div>
        `;
    }
    return html;
}



// Lancement au chargement de la page
document.getElementById("jour").value = "";
reinitialiserFiltresEtTri();
chargerSeances();
activerSelecteurJour();
activerSelecteurPeriode();
activerBoutonFiltre();
activerDepliantsFiltres();
activerFiltreCinema();
activerFiltresLangueFormat();
activerTri();