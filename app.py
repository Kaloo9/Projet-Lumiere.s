from flask import Flask, jsonify, render_template
from allocineAPI.allocineAPI import allocineAPI, URLs
from datetime import date

app = Flask(__name__)
api = allocineAPI()

CINEMAS = {
    "Pathé Bellecour": "P0012",
    "Pathé Carré de Soie": "P8507",
    "Institut Lumière": "P0050",
    "UGC Ciné Cité Lyon Part-Dieu": "P0036",
    "UGC Ciné Cité Internationale": "P0671",
    "Cinéma Comœdia": "P3757",
}

def get_seances_detaillees(id_cinema, date_str):
    # Comme api.get_showtime(), mais garde en plus "projection" et "experience"
    # (le format de la séance), que la fonction officielle de la librairie jette.
    resultat = []
    lst_internal_ids = []
    page, totalPages = 0, 1

    while page < totalPages:
        json_data = api._get_json_request(URLs.showtime_url(id_cinema, date_str, page + 1))
        page = int(json_data["pagination"]["page"])
        totalPages = int(json_data["pagination"]["totalPages"])

        for element in json_data["results"]:
            titre = element["movie"]["title"]
            seances = []

            for cle_version in element["showtimes"].keys():
                for seance in element["showtimes"][cle_version]:
                    if seance["internalId"] not in lst_internal_ids:
                        lst_internal_ids.append(seance["internalId"])
                        seances.append({
                            "startsAt": seance["startsAt"],
                            "diffusionVersion": seance["diffusionVersion"],
                            "projection": seance["projection"],   # liste, ex: ["DIGITAL"], ["IMAX"]
                            "experience": seance["experience"],   # ex: null, ou "4DX"
                        })

            resultat.append({"title": titre, "showtimes": seances})

    return resultat


@app.route("/")
def accueil():
    return render_template("index.html")

@app.route("/api/seances")
def seances():
    today = date.today().isoformat()
    films = {}

    for nom_cinema, id_cinema in CINEMAS.items():
        horaires = get_seances_detaillees(id_cinema, today)   # <-- notre fonction, plus get_showtime()
        infos_films = api.get_movies(id_cinema, today)

        affiches = {}
        for film in infos_films:
            affiches[film["title"]] = film["urlPoster"]

        for entree in horaires:
            titre = entree["title"]
            if titre not in films:
                films[titre] = {
                    "poster": affiches.get(titre),
                    "seances": {}
                }
            films[titre]["seances"][nom_cinema] = entree["showtimes"]

    return jsonify(films)

if __name__ == "__main__":
    app.run(debug=True)

    