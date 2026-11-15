from flask import Flask, jsonify, render_template, request
from allocineAPI.allocineAPI import allocineAPI, URLs
from datetime import date, datetime, timedelta
import requests


DUREE_CACHE = timedelta(hours=6)  # les programmes de cinéma changent peu dans une journée
cache_films_jour = {}  # { (id_cinema, jour): {"donnees": ..., "recupere_le": datetime} }

# Préchargement : à l'ouverture de Lumi, on remplit le cache avec la période maximale.
# Mettre False pendant qu'on travaille sur le code (Flask redémarre et vide le cache à chaque sauvegarde).
PRECHARGEMENT_ACTIF = False
SEMAINES_MAX = 3

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

# Depuis novembre 2026, Allociné refuse la "carte d'identité" par défaut de Python (python-requests) -> erreur 403.
# Lumi se présente donc honnêtement, avec son propre nom.
EN_TETES_ALLOCINE = {"User-Agent": "Lumi/1.0 (projet perso, seances cinema Lyon)"}

def jours_de_la_periode(semaines):
    # "N semaines" = la fin de la semaine en cours (jusqu'à dimanche) + N semaines complètes
    # Renvoie la liste des jours au format "AAAA-MM-JJ"
    aujourdhui = date.today()
    jours_restants = 6 - aujourdhui.weekday()   # weekday() : lundi = 0, ..., dimanche = 6
    nb_jours = jours_restants + 1 + semaines * 7

    jours = []
    for i in range(nb_jours):
        jours.append((aujourdhui + timedelta(days=i)).isoformat())
    return jours


def requete_allocine(url):
    # Remplace api._get_json_request() de la librairie, qui n'envoie aucun en-tête
    reponse = requests.get(url, headers=EN_TETES_ALLOCINE)
    if reponse.status_code != 200:
        raise Exception(f"Erreur Allociné {reponse.status_code}")
    return reponse.json()



def get_seances_detaillees(id_cinema, date_str):
    # Comme api.get_showtime(), mais garde en plus "projection" et "experience"
    # (le format de la séance), que la fonction officielle de la librairie jette.
    resultat = []
    lst_internal_ids = []
    page, totalPages = 0, 1

    while page < totalPages:
        json_data = requete_allocine(URLs.showtime_url(id_cinema, date_str, page + 1))
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

            # L'affiche et les dates de sortie sont déjà dans element["movie"] :
            # plus besoin d'appeler api.get_movies() (qui plante si un film n'a aucune sortie)
            film = element["movie"]

            affiche = None
            if film.get("poster"):                  # poster peut être None
                affiche = film["poster"].get("url")

            # Lien vers la fiche du film sur Allociné, construit à partir de son identifiant
            id_allocine = film.get("internalId")
            lien_allocine = None
            if id_allocine:
                lien_allocine = f"https://www.allocine.fr/film/fichefilm_gen_cfilm={id_allocine}.html"
            
            resultat.append({
                "title": titre,
                "poster": affiche,
                "dateSortie": date_sortie_la_plus_ancienne(film.get("releases") or []),
                "lienAllocine": lien_allocine,
                "showtimes": seances,
            })

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
    # releases : liste brute d'Allociné, chaque élément a "releaseDate" = {"date": "AAAA-MM-JJ"} ou None
    dates = []
    for r in releases:
        if r.get("releaseDate") and r["releaseDate"].get("date"):
            dates.append(r["releaseDate"]["date"])
    if dates:
        return min(dates)
    return None   # liste vide -> pas de plantage, juste "pas de date"


def films_dun_jour(id_cinema, jour):
    cle = (id_cinema, jour)

    if cle in cache_films_jour:
        en_cache = cache_films_jour[cle]
        if datetime.now() - en_cache["recupere_le"] < DUREE_CACHE:
            return en_cache["donnees"]  # encore frais, pas besoin de rappeler Allociné

    horaires = get_seances_detaillees(id_cinema, jour)  # contient maintenant aussi poster, dateSortie et lienAllocine

    resultat = {}
    for entree in horaires:
        resultat[entree["title"]] = {
            "poster": entree["poster"],
            "dateSortie": entree["dateSortie"],
            "lienAllocine": entree["lienAllocine"],
            "seances": entree["showtimes"],
        }

    cache_films_jour[cle] = {"donnees": resultat, "recupere_le": datetime.now()}
    return resultat


@app.route("/")
def accueil():
    # On transmet la date du jour au HTML, pour bloquer les dates passées dans le calendrier
    return render_template("index.html", aujourdhui=date.today().isoformat())


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
                    "lienAllocine": infos["lienAllocine"],
                    "seances": {}
                }
            films[titre]["seances"][nom_cinema] = infos["seances"]

    return jsonify(films)



@app.route("/api/films-periode")
def films_periode():
    semaines = int(request.args.get("semaines", 1))

    cinemas_param = request.args.get("cinemas")
    if cinemas_param is not None:
        noms_cinemas = cinemas_param.split(",") if cinemas_param else []
    else:
        noms_cinemas = list(CINEMAS.keys())

    films = {}
    for jour in jours_de_la_periode(semaines):
        for nom_cinema in noms_cinemas:
            print(f"Récupération : {nom_cinema} - {jour}")  # gardé volontairement : montre la progression des longues requêtes
            id_cinema = CINEMAS[nom_cinema]
            films_du_jour = films_dun_jour(id_cinema, jour)

            for titre, infos in films_du_jour.items():
                if titre not in films:
                    films[titre] = {
                        "poster": infos["poster"],
                        "dateSortie": infos["dateSortie"],
                        "lienAllocine": infos["lienAllocine"],
                        "joursDiffusion": {}
                    }

                if jour not in films[titre]["joursDiffusion"]:
                    films[titre]["joursDiffusion"][jour] = {}

                films[titre]["joursDiffusion"][jour][nom_cinema] = infos["seances"]

    return jsonify(films)


@app.route("/api/prechargement")
def prechargement():
    # Remplit le cache avec toute la période maximale (6 cinémas), sans rien renvoyer de lourd
    if not PRECHARGEMENT_ACTIF:
        return jsonify({"precharge": False})

    jours = jours_de_la_periode(SEMAINES_MAX)
    for jour in jours:
        for nom_cinema, id_cinema in CINEMAS.items():
            print(f"Préchargement : {nom_cinema} - {jour}")
            films_dun_jour(id_cinema, jour)  # on n'utilise pas le résultat : le but est juste de remplir le cache

    return jsonify({"precharge": True, "nbJours": len(jours)})


if __name__ == "__main__":
    app.run(debug=True)

    