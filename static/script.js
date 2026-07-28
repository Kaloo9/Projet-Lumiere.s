async function chargerSeances(jour) {
    let url = "/api/seances";
    if (jour) {
        url += `?jour=${jour}`;
    }
    const reponse = await fetch(url);
    const donnees = await reponse.json();
    afficherFilms(donnees);
}

function activerSelecteurJour() {
    const inputJour = document.getElementById("jour");
    inputJour.addEventListener("change", function () {
        chargerSeances(inputJour.value);
    });
}

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
    activerClics();
}


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

            html += `<li>${heure} — ${langue}${texteFormat}</li>`;
        }
        html += "</ul>";
    }
    return html;
}

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

chargerSeances();
activerSelecteurJour();


