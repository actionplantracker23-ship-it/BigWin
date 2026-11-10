"""Construit data/bf_provinces.json (chemins SVG des 45 provinces du Burkina Faso).

Source : geoBoundaries (gbOpen, BFA ADM2, version simplifiée, licence CC BY 4.0).
Usage : python3 scripts/build_map.py geoBoundaries-BFA-ADM2_simplified.geojson > data/bf_provinces.json
"""
import json
import math
import sys

LON0, LAT0 = -5.6, 15.15          # coin haut-gauche
KX = math.cos(math.radians(12.3))  # correction de latitude
ECHELLE = 60                       # unités SVG par degré
TOLERANCE = 0.012                  # simplification (degrés)


def projeter(lon, lat):
    return round((lon - LON0) * KX * ECHELLE, 1), round((LAT0 - lat) * ECHELLE, 1)


def rdp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norme = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norme
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(points[: idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]


def anneau(coords):
    pts = [tuple(c[:2]) for c in coords]
    milieu = len(pts) // 2  # anneau fermé : on simplifie les deux moitiés séparément
    pts = rdp(pts[: milieu + 1], TOLERANCE)[:-1] + rdp(pts[milieu:], TOLERANCE)
    if len(pts) < 4:
        return ""
    xy = [projeter(*p) for p in pts]
    return "M" + "L".join(f"{x:g},{y:g}" for x, y in xy) + "Z"


def main(chemin):
    geo = json.load(open(chemin, encoding="utf-8"))
    provinces = {}
    for f in geo["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        d = "".join(anneau(p[0]) for p in polys)
        provinces[f["properties"]["shapeName"]] = d
    largeur = round((2.45 - LON0) * KX * ECHELLE)
    hauteur = round((LAT0 - 9.35) * ECHELLE)
    print(json.dumps({
        "source": "geoBoundaries gbOpen BFA ADM2 (CC BY 4.0)",
        "projection": {"lon0": LON0, "lat0": LAT0, "kx": KX, "echelle": ECHELLE},
        "viewBox": [0, 0, largeur, hauteur],
        "provinces": provinces,
    }, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main(sys.argv[1])
