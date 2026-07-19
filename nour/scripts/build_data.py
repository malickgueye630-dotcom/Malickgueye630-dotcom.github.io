#!/usr/bin/env python3
"""
Génère les données de l'application Nour à partir de sources ouvertes :

- Coran : paquet npm `quran-json` (v3.1.2, licence CC BY-SA 4.0)
    * Texte arabe Uthmani : The Noble Qur'an Encyclopedia (quranenc.com)
    * Traduction française : Muhammad Hamidullah
    * Translittération : Tanzil.net
- Métadonnées (juz, hizb, sajda) : paquet npm `quran-meta` (v6, MIT)
- Hadiths : paquets npm `sahih-al-bukhari`, `sahih-muslim`, `sunan-abi-dawud`,
  `jami-al-tirmidhi`, `sunan-al-nasai`, `sunan-ibn-majah` (AGPL-3.0),
  texte arabe + traduction anglaise, découpés par chapitre.

Usage : python3 build_data.py <dossier_sources> <dossier_sortie_data>
Le dossier_sources doit contenir les tarballs npm extraits (voir README).
"""
import gzip
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from phonetics_fr import ar_to_fr  # phonétique française générée depuis l'arabe vocalisé

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])

COMPACT = dict(ensure_ascii=False, separators=(",", ":"))


def write(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, **COMPACT), encoding="utf-8")


# ---------------------------------------------------------------- Coran
def parse_ts_list(ts_source: str, name: str):
    m = re.search(rf"export const {name}[^=]*=\s*\[(.*?)\]\s*as const", ts_source, re.S)
    body = re.sub(r"//.*", "", m.group(1))
    return [int(x) for x in re.findall(r"-?\d+", body)]


def build_quran():
    fr = json.loads((SRC / "qj/package/dist/quran_fr.json").read_text())
    tr = json.loads((SRC / "qj/package/dist/quran_transliteration.json").read_text())
    hafs = (SRC / "qm/package/src/lists/HafsLists.ts").read_text()

    juz = parse_ts_list(hafs, "JuzList")
    hizb_quarters = parse_ts_list(hafs, "HizbQuarterList")
    sajda = parse_ts_list(hafs, "SajdaList")
    pages = parse_ts_list(hafs, "PageList")

    index = []
    search_fr = []
    offset = 0
    for s_fr, s_tr in zip(fr, tr):
        n = s_fr["id"]
        verses = []
        for v_fr, v_tr in zip(s_fr["verses"], s_tr["verses"]):
            assert v_fr["id"] == v_tr["id"]
            assert v_fr["text"] == v_tr["text"], f"texte arabe divergent {n}:{v_fr['id']}"
            # [arabe, traduction française, phonétique française]
            verses.append([v_fr["text"], v_fr["translation"], ar_to_fr(v_fr["text"])])
            search_fr.append([n, v_fr["id"], v_fr["translation"]])
        write(OUT / f"quran/s/{n}.json", {
            "n": n,
            "name": s_fr["name"],
            "phonetic": s_fr["transliteration"],
            "fr": s_fr["translation"],
            "type": s_fr["type"],
            "verses": verses,
        })
        index.append({
            "n": n,
            "name": s_fr["name"],
            "phonetic": s_fr["transliteration"],
            "fr": s_fr["translation"],
            "type": s_fr["type"],
            "verses": s_fr["total_verses"],
            "start": offset,  # ayahs cumulées avant la sourate (id global = start + numéro)
        })
        offset += s_fr["total_verses"]

    assert offset == 6236
    write(OUT / "quran/index.json", {
        "surahs": index,
        "juz": juz,            # id global (1-indexé) du 1er verset de chaque juz
        "hizbQuarters": hizb_quarters,
        "sajda": sajda,
        "pages": pages,        # 604 pages du mushaf (id global du 1er verset)
    })
    write(OUT / "quran/search-fr.json", search_fr)

    # index phonétique : translittération brute par verset (normalisée côté client)
    phonetic = []
    for s in tr:
        for v in s["verses"]:
            phonetic.append([s["id"], v["id"], v["transliteration"]])
    write(OUT / "quran/phonetic.json", phonetic)

    # index arabe sans diacritiques pour la recherche dans le texte arabe
    def strip_ar(t):
        t = re.sub(r"[ً-ٰٟۖ-ۭـ]", "", t)
        t = (t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا")
              .replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي"))
        return t
    search_ar = []
    for s_fr in fr:
        for v in s_fr["verses"]:
            search_ar.append([s_fr["id"], v["id"], strip_ar(v["text"])])
    write(OUT / "quran/search-ar.json", search_ar)
    print(f"Coran : 114 sourates, {offset} versets (+ index phonétique + index arabe)")


# ---------------------------------------------------------------- Hadiths
COLLECTIONS = [
    ("bukhari",  "sahih-al-bukhari/package/data/bukhari.json.gz",  "Sahih al-Bukhari",   "صحيح البخاري",       "sahih"),
    ("muslim",   "sm/package/data/muslim.json.gz",                 "Sahih Muslim",       "صحيح مسلم",          "sahih"),
    ("abudawud", "sunan-abi-dawud/package/data/dawud.json.gz",     "Sunan Abi Dawud",    "سنن أبي داود",       "mixed"),
    ("tirmidhi", "jami-al-tirmidhi/package/data/tirmidhi.json.gz", "Jami' at-Tirmidhi",  "جامع الترمذي",       "mixed"),
    ("nasai",    "sunan-al-nasai/package/data/nasai.json.gz",      "Sunan an-Nasa'i",    "سنن النسائي",        "mixed"),
    ("ibnmajah", "sunan-ibn-majah/package/data/majah.json.gz",     "Sunan Ibn Majah",    "سنن ابن ماجه",       "mixed"),
]


def build_hadith():
    catalog = []
    for key, rel, name, name_ar, grade in COLLECTIONS:
        d = json.loads(gzip.open(SRC / rel).read())
        chapters = d["chapters"]
        hadiths = d["hadiths"]
        # certains recueils ont un chapitre sans id (ex. an-Nasa'i) : on lui en attribue un
        next_id = max((c["id"] for c in chapters if isinstance(c["id"], int)), default=0) + 1
        remap = {}
        for c in chapters:
            if not isinstance(c["id"], int):
                remap[c["id"]] = next_id
                c["id"] = next_id
                next_id += 1
        if remap:
            for h in hadiths:
                if h.get("chapterId") in remap:
                    h["chapterId"] = remap[h["chapterId"]]
        by_chapter = {}
        for h in hadiths:
            en = h.get("english") or {}
            if isinstance(en, str):
                narrator, text = "", en
            else:
                narrator, text = en.get("narrator", ""), en.get("text", "")
            by_chapter.setdefault(h["chapterId"], []).append(
                [h["id"], h.get("arabic", ""), narrator.strip(), text.strip()])
        chap_meta = []
        for c in chapters:
            items = by_chapter.get(c["id"], [])
            if not items:
                continue
            write(OUT / f"hadith/{key}/{c['id']}.json", items)
            chap_meta.append({
                "id": c["id"], "ar": c["arabic"], "en": c["english"],
                "count": len(items),
                "first": items[0][0], "last": items[-1][0],
            })
        catalog.append({
            "key": key, "name": name, "nameAr": name_ar,
            "grade": grade, "total": len(hadiths), "chapters": chap_meta,
        })
        print(f"{name} : {len(hadiths)} hadiths, {len(chap_meta)} chapitres")
    write(OUT / "hadith/index.json", catalog)


if __name__ == "__main__":
    build_quran()
    build_hadith()
