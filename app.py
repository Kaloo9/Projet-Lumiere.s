from flask import Flask, jsonify, render_template, request
from allocineAPI.allocineAPI import allocineAPI, URLs
from datetime import date, datetime, timedelta

DUREE_CACHE = timedelta(hours=1)
cache_films_jour = {}  # { (id_cinema, jour): {"donnees": ..., "recupere_le": datetime} }


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
            if element["movie"] is None:
                continue  # pas un vrai film (créneau vide ou "à venir"), on passe au suivant

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
                            "lienReservation": lien_reservation(seance.get("data", {})),
                        })

            resultat.append({"title": titre, "showtimes": seances})

    return resultat

def lien_reservation(data):
    # data : le champ "data" d'une séance, contient éventuellement "ticketing" (liste de billetteries)
    ticketing = data.get("ticketing")
    if not ticketing:
        return None  # pas de billetterie dispo pour cette séance

    for billetterie in ticketing:
        if billetterie["provider"] == "default":
            return billetterie["urls"][0]  # on préfère le lien direct du cinéma

    return ticketing[0]["urls"][0]  # sinon, on prend le premier lien disponible


def date_sortie_la_plus_ancienne(releases):
    # releases : liste de dicts {"releaseName": ..., "releaseDate": ...}
    # releaseDate peut être None (pas renseigné) -> on l'ignore avant de chercher le minimum.
    dates = [r["releaseDate"] for r in releases if r["releaseDate"] is not None]
    if dates:
        return min(dates)
    return None



def films_dun_jour(id_cinema, jour):
    cle = (id_cinema, jour)

    if cle in cache_films_jour:
        en_cache = cache_films_jour[cle]
        if datetime.now() - en_cache["recupere_le"] < DUREE_CACHE:
            return en_cache["donnees"]  # encore frais, pas besoin de rappeler Allociné

    # Pas en cache (ou périmé) -> on va chercher en direct, comme avant
    horaires = get_seances_detaillees(id_cinema, jour)
    infos_films = api.get_movies(id_cinema, jour)

    affiches = {}
    dates_sortie = {}
    for film in infos_films:
        affiches[film["title"]] = film["urlPoster"]
        dates_sortie[film["title"]] = date_sortie_la_plus_ancienne(film["releases"])

    resultat = {}
    for entree in horaires:
        titre = entree["title"]
        resultat[titre] = {
            "poster": affiches.get(titre),
            "dateSortie": dates_sortie.get(titre),
            "seances": entree["showtimes"],
        }

    cache_films_jour[cle] = {"donnees": resultat, "recupere_le": datetime.now()}
    return resultat


@app.route("/")
def accueil():
    return render_template("index.html")


@app.route("/api/seances")
def seances():
    jour = request.args.get("jour", date.today().isoformat())
    films = {}

    for nom_cinema, id_cinema in CINEMAS.items():
        films_du_cinema = films_dun_jour(id_cinema, jour)
        for titre, infos in films_du_cinema.items():
            if titre not in films:
                films[titre] = {
                    "poster": infos["poster"],
                    "dateSortie": infos["dateSortie"],
                    "seances": {}
                }
            films[titre]["seances"][nom_cinema] = infos["seances"]

    return jsonify(films)


@app.route("/api/films-periode")
def films_periode():
    semaines = int(request.args.get("semaines", 1))
    nb_jours = semaines * 7

    cinemas_param = request.args.get("cinemas")
    if cinemas_param is not None:
        # paramètre envoyé (même vide = aucun cinéma coché) -> on respecte le choix
        noms_cinemas = cinemas_param.split(",") if cinemas_param else []
    else:
        # paramètre absent -> comportement par défaut, tous les cinémas
        noms_cinemas = list(CINEMAS.keys())

    films = {}
    for i in range(nb_jours):
        jour = (date.today() + timedelta(days=i)).isoformat()
        for nom_cinema in noms_cinemas:
            id_cinema = CINEMAS[nom_cinema]
            infos_films = api.get_movies(id_cinema, jour)
            for film in infos_films:
                titre = film["title"]
                if titre not in films:
                    films[titre] = {
                        "poster": film["urlPoster"],
                        "dateSortie": date_sortie_la_plus_ancienne(film["releases"]),
                    }

    return jsonify(films)

if __name__ == "__main__":
    app.run(debug=True)

    