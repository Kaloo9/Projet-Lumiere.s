'''from allocineAPI.allocineAPI import allocineAPI

api = allocineAPI()

# Étape 1 : chercher Lyon parmi les grandes villes
print("=== Recherche de Lyon dans get_top_villes() ===")
villes = api.get_top_villes()
lyon = None
for v in villes:
    if "lyon" in v["name"].lower():
        print(v)
        lyon = v

if lyon is None:
    print("Lyon non trouvé dans le top villes, liste complète :")
    print(villes)


# Étape 2 : lister les cinémas de Lyon
print("\n=== Cinémas de Lyon ===")
if lyon is not None:
    cinemas = api.get_cinema(lyon["id"])
    for c in cinemas:
        print(c)

print("\n=== Circuits disponibles ===")
circuits = api.get_circuit()
for c in circuits:
    print(c)

print("\n=== Cinémas Pathé (recherche Carré de Soie) ===")
cinemas_pathe = api.get_cinema("circuit-81002")
for c in cinemas_pathe:
    if "soie" in c["name"].lower() or "vaulx" in c["address"].lower():
        print(c)


from datetime import date

#print("\n=== Séances du jour, Institut Lumière (P0050) ===")
print("\n=== Séances du jour, UGC PART-DIEU (P0036) ===")
today = date.today().isoformat()  # format YYYY-MM-DD
#seances = api.get_showtime("P0050", today)
seances = api.get_showtime("P0036", today)  # UGC Ciné Cité Lyon Part-Dieu
for s in seances:
    print(s)'''


'''from allocineAPI.allocineAPI import allocineAPI, URLs
from datetime import date
import json

api = allocineAPI()
today = date.today().isoformat()

# on appelle la même URL que get_showtime(), mais SANS le filtrage de la librairie
data = api._get_json_request(URLs.showtime_url("P0036", today, 1))
premier_film = data["results"][0]

print(json.dumps(premier_film, indent=2, ensure_ascii=False))

from allocineAPI.allocineAPI import allocineAPI, URLs
from datetime import date

api = allocineAPI()

# Même requête que get_seances_detaillees(), pour l'Institut Lumière, aujourd'hui
data = api._get_json_request(URLs.showtime_url("P0036", date.today().isoformat(), 1))

# On regarde les 2 premiers films reçus
for element in data["results"][:2]:
    film = element["movie"]
    if film is None:
        continue
    print("Titre :", film.get("title"))
    print("  Toutes les infos disponibles :", sorted(film.keys()))
    print("  id :", film.get("id"), "| internalId :", film.get("internalId"))
    print("  stats (notes ?) :", film.get("stats"))
    print()'''

import requests
from datetime import date

url = f"https://www.allocine.fr/_/showtimes/theater-P0036/d-{date.today().isoformat()}/p-1"

# Test 1 : comme la librairie aujourd'hui (carte d'identité par défaut "python-requests")
r1 = requests.get(url)
print("Carte par défaut :", r1.status_code)

# Test 2 : Lumi se présente honnêtement, avec son propre nom
r2 = requests.get(url, headers={"User-Agent": "Lumi/1.0 (projet perso, seances cinema Lyon)"})
print("Carte Lumi :", r2.status_code)
