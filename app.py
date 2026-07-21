from flask import Flask, jsonify, render_template
from allocineAPI.allocineAPI import allocineAPI
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

@app.route("/")
def accueil():
    return render_template("index.html")

@app.route("/api/seances")
def seances():
    today = date.today().isoformat()
    resultat = {}
    for nom_cinema, id_cinema in CINEMAS.items():
        resultat[nom_cinema] = api.get_showtime(id_cinema, today)
    return jsonify(resultat)

if __name__ == "__main__":
    app.run(debug=True)

