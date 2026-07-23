async function chargerSeances() {
    const reponse = await fetch("/api/seances");
    const donnees = await reponse.json();
    afficherFilms(donnees);
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

            const proj = seance.projection[0]; // ex: "DIGITAL", "IMAX"

            let texteExperience = "";
            if (seance.experience) {
                texteExperience = ` — ${seance.experience}`;
            }

            html += `<li>${heure} — ${langue} — ${proj}${texteExperience}</li>`;
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

