"""
math_symbols_3d.py
------------------
Script Blender pour générer des meshs 3D à partir de symboles logiques :
  - ∀  (pour tout)
  - ∃  (il existe)
  - ∀̄  (négation de ∀, avec barre surmontante)
  - ∃̄  (négation de ∃, avec barre surmontante)
  - Φ  (phi majuscule, fonction propositionnelle)

UTILISATION :
  1. Ouvrir Blender
  2. Aller dans l'éditeur de script (Scripting)
  3. Coller ce fichier ou l'ouvrir via Text > Open
  4. Ajuster les paramètres dans la section CONFIG ci-dessous
  5. Cliquer sur Run Script (ou Alt+P)

Testé sur Blender 4.3
"""

import bpy
import bmesh
import mathutils
import math
import os


# ─────────────────────────────────────────────
#  CONFIG — modifie ces valeurs selon tes besoins
# ─────────────────────────────────────────────

EXTRUDE_DEPTH    = 0.1    # Épaisseur d'extrusion (en unités Blender)
FONT_SIZE        = 1.0    # Taille des glyphes
SPACING_X        = 1.6    # Espacement horizontal entre les symboles
BAR_HEIGHT       = 0.07   # Épaisseur de la barre de négation
BAR_MARGIN_X     = 0.08   # Débordement latéral de la barre
BAR_GAP          = 0.06   # Distance entre le sommet du glyphe et la barre
RESOLUTION       = 12     # Résolution des courbes (plus = plus lisse)
CLEAR_SCENE      = True   # Supprimer les objets existants avant de créer

# Police : None = recherche automatique (DejaVu embarquée dans Blender)
# Pour forcer une police : FONT_PATH = "/chemin/vers/ta/police.ttf"
FONT_PATH        = None


# ─────────────────────────────────────────────
#  Symboles à générer
#  (nom_objet, caractère_unicode, avec_barre)
# ─────────────────────────────────────────────

SYMBOLS = [
    ("sym_forall",     "\u2200", False),
    ("sym_exists",     "\u2203", False),
    ("sym_forall_neg", "\u2200", True),
    ("sym_exists_neg", "\u2203", True),
    ("sym_phi",        "\u03a6", False),
]


# ─────────────────────────────────────────────
#  Fonctions utilitaires
# ─────────────────────────────────────────────

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def load_font():
    """
    Trouve DejaVu Sans dans les ressources embarquées de Blender 4.x,
    ou dans les polices système en dernier recours.
    Blender 4.x embarque DejaVu dans <blender>/4.x/datafiles/fonts/
    """
    if FONT_PATH:
        return bpy.data.fonts.load(FONT_PATH)

    # 1. Chercher dans les dossiers de ressources Blender
    search_roots = []
    for scope in ('LOCAL', 'USER', 'SYSTEM'):
        try:
            search_roots.append(bpy.utils.resource_path(scope))
        except Exception:
            pass

    candidates = ["DejaVuSans.ttf", "droidsans.ttf", "NotoSans-Regular.ttf"]

    for root in search_roots:
        for dirpath, _, filenames in os.walk(root):
            for candidate in candidates:
                if candidate in filenames:
                    full_path = os.path.join(dirpath, candidate)
                    print(f"   Police trouvee : {full_path}")
                    return bpy.data.fonts.load(full_path)

    # 2. Polices système selon l'OS
    system_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
    ]
    for p in system_paths:
        if os.path.exists(p):
            print(f"   Police systeme : {p}")
            return bpy.data.fonts.load(p)

    raise FileNotFoundError(
        "Aucune police trouvee automatiquement.\n"
        "=> Renseigne FONT_PATH en tete de script avec le chemin "
        "vers un fichier .ttf sur ton systeme."
    )


def create_text_object(name, character, font, x_offset):
    """
    Cree un objet Text Blender pour un glyphe, le convertit en mesh extrude.
    """
    bpy.ops.object.text_add(location=(x_offset, 0, 0))
    obj = bpy.context.active_object
    obj.name = name + "_curve"

    curve = obj.data
    curve.body         = character
    curve.font         = font
    curve.size         = FONT_SIZE
    curve.extrude      = EXTRUDE_DEPTH / 2
    curve.resolution_u = RESOLUTION
    curve.fill_mode    = 'BOTH'
    curve.align_x      = 'CENTER'
    curve.align_y      = 'CENTER'

    bpy.ops.object.convert(target='MESH')
    obj.name = name

    return obj


def get_bounding_box(obj):
    """Retourne (min_x, max_x, min_y, max_y, max_z) en coordonnees monde."""
    verts = [obj.matrix_world @ mathutils.Vector(v.co) for v in obj.data.vertices]
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    zs = [v.z for v in verts]
    return min(xs), max(xs), min(ys), max(ys), max(zs)


def create_negation_bar(name, glyph_obj):
    """
    Cree un mesh rectangulaire (barre de negation) au-dessus du glyphe.
    """
    min_x, max_x, min_y, max_y, max_z = get_bounding_box(glyph_obj)

    bar_x0 = min_x - BAR_MARGIN_X
    bar_x1 = max_x + BAR_MARGIN_X
    bar_y0 = max_y + BAR_GAP
    bar_y1 = bar_y0 + BAR_HEIGHT
    bar_z0 = -EXTRUDE_DEPTH / 2
    bar_z1 =  EXTRUDE_DEPTH / 2

    mesh = bpy.data.meshes.new(name + "_bar_mesh")
    bm = bmesh.new()

    v = [
        bm.verts.new((bar_x0, bar_y0, bar_z0)),
        bm.verts.new((bar_x1, bar_y0, bar_z0)),
        bm.verts.new((bar_x1, bar_y1, bar_z0)),
        bm.verts.new((bar_x0, bar_y1, bar_z0)),
        bm.verts.new((bar_x0, bar_y0, bar_z1)),
        bm.verts.new((bar_x1, bar_y0, bar_z1)),
        bm.verts.new((bar_x1, bar_y1, bar_z1)),
        bm.verts.new((bar_x0, bar_y1, bar_z1)),
    ]

    for indices in [(0,1,2,3),(4,7,6,5),(0,4,5,1),(2,6,7,3),(0,3,7,4),(1,5,6,2)]:
        bm.faces.new([v[i] for i in indices])

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    bar_obj = bpy.data.objects.new(name + "_bar", mesh)
    bpy.context.collection.objects.link(bar_obj)

    return bar_obj


def group_with_empty(name, *objects):
    """Groupe plusieurs objets sous un Empty parent."""
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    parent = bpy.context.active_object
    parent.name = name + "_group"

    for obj in objects:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()

    return parent


# ─────────────────────────────────────────────
#  Génération principale
# ─────────────────────────────────────────────

def generate_symbols():
    if CLEAR_SCENE:
        clear_scene()

    font = load_font()
    created = []

    for i, (sym_name, character, with_bar) in enumerate(SYMBOLS):
        x_pos = i * SPACING_X
        print(f"[{i+1}/{len(SYMBOLS)}] '{sym_name}' (U+{ord(character):04X}, barre={with_bar})")

        bpy.ops.object.select_all(action='DESELECT')
        glyph = create_text_object(sym_name, character, font, x_pos)

        if with_bar:
            bar   = create_negation_bar(sym_name, glyph)
            group = group_with_empty(sym_name, glyph, bar)
            created.append(group)
            print(f"   => groupe '{group.name}'")
        else:
            created.append(glyph)
            print(f"   => '{glyph.name}'")

    print("\nTermine. Objets crees :")
    for obj in created:
        print(f"  - {obj.name}")

    bpy.ops.object.select_all(action='DESELECT')
    for obj in created:
        obj.select_set(True)


if __name__ == "__main__":
    generate_symbols()
