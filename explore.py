from allocineAPI.allocineAPI import allocineAPI

api = allocineAPI()

# Étape 1 : chercher Lyon parmi les grandes villes
'''print("=== Recherche de Lyon dans get_top_villes() ===")
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
        print(c)'''


from datetime import date

#print("\n=== Séances du jour, Institut Lumière (P0050) ===")
print("\n=== Séances du jour, UGC PART-DIEU (P0036) ===")
today = date.today().isoformat()  # format YYYY-MM-DD
#seances = api.get_showtime("P0050", today)
seances = api.get_showtime("P0036", today)  # UGC Ciné Cité Lyon Part-Dieu
for s in seances:
    print(s)


