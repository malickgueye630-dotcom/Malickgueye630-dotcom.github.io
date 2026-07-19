#!/usr/bin/env python3
"""Phonétique française du Coran (script Uthmani vocalisé) et de tout texte
arabe vocalisé. Conventions pour un francophone : ou = و bref, oû = long,
â/î longues, ch = ش, kh = خ, gh = غ, dj rendu j, article assimilé (ar-Rahmân).
Le texte arabe n'est jamais modifié : ceci est une aide à la lecture générée
selon des règles régulières et vérifiées sur des sourates témoins."""
import re

CONS = {
    'ء': "'", 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'ch', 'ص': 's',
    'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': "'", 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
    'أ': "'", 'إ': "'", 'ؤ': "'", 'ئ': "'",
}
SUN = set('تثدذرزسشصضطظلن')

FATHA, DAMMA, KASRA = 'َ', 'ُ', 'ِ'
SUKUN, SHADDA = 'ْ', 'ّ'
TAN_F, TAN_D, TAN_K = 'ً', 'ٌ', 'ٍ'
ALIF, ALIF_MAQ, WASLA, MADDA_L, TA_MARB = 'ا', 'ى', 'ٱ', 'آ', 'ة'
DAGGER = 'ٰ'

HARAKA = set('ًٌٍَُِّْٰ')


def normalize_uthmani(t: str) -> str:
    t = t.replace(' ', ' ').replace('ـ', '')
    # signes de pause et marques coraniques sans valeur phonétique simple
    t = re.sub(r'[ۖ-ۜۘۛ۞ࣰۭ۠ۢ-ࣿ]', '', t)
    t = t.replace('ۡ', SUKUN)          # petit sukun uthmani
    t = t.replace('ٓ', '')             # maddah : la longueur vient de l'alif
    t = t.replace('ٔ', '')             # hamza suscrite décorative
    t = t.replace('ٞ', TAN_F)          # variante de fathatan
    t = t.replace('ٖ', KASRA + 'ۦ')  # alif souscrit ≈ î
    t = t.replace('ٗ', DAMMA + 'ۥ')  # damma inversée ≈ oû
    return re.sub(r'\s+', ' ', t).strip()


def ar_to_fr(text: str) -> str:
    text = normalize_uthmani(text)
    chars = list(text)
    out, latin = [], ''
    hyphen_next = False  # article assimilé : la solaire doublée s'écrit « r-r »

    def flush():
        nonlocal latin
        if latin:
            out.append(latin)
            latin = ''

    def prev_ends_vowel():
        if latin:
            return bool(re.search(r'[aiouâîû]$', latin))
        if len(out) >= 2 and out[-1] == ' ':
            return bool(re.search(r'[aiouâîû]$', out[-2]))
        return False

    i = 0
    n = len(chars)
    while i < n:
        c = chars[i]
        if c == ' ' or not ('؀' <= c <= 'ۿ'):
            flush()
            if c != ' ':
                out.append(c)
            elif out and out[-1] != ' ':
                out.append(' ')
            i += 1
            continue
        if c in HARAKA:
            i += 1
            continue

        j = i + 1
        marks = ''
        while j < n and chars[j] in HARAKA:
            marks += chars[j]
            j += 1
        nxt = chars[j] if j < n else ''

        shadda = SHADDA in marks
        vowel = ('a' if FATHA in marks else
                 'i' if KASRA in marks else
                 'ou' if DAMMA in marks else
                 'an' if TAN_F in marks else
                 'in' if TAN_K in marks else
                 'oun' if TAN_D in marks else '')
        if DAGGER in marks:
            vowel = 'â'

        # petites lettres de prolongation
        if c == 'ۥ':  # petit waw
            latin = re.sub(r'ou$', 'oû', latin) if latin.endswith('ou') else latin + 'oû'
            i = j
            continue
        if c in ('ۦ', 'ۧ'):  # petit ya
            latin = re.sub(r'i$', 'î', latin) if latin.endswith('i') else latin + 'î'
            i = j
            continue

        if c in (ALIF, WASLA):
            word_start = not latin and (not out or out[-1] == ' ')
            # wasla : voyelle élidée après un mot finissant par une voyelle
            elide = c == WASLA and word_start and prev_ends_vowel()
            # alif de soutien du tanwin (كُفُوًا) : muet
            if not word_start and not marks and re.search(r'(an|in|oun)$', latin):
                i = j
                continue
            # article après préposition attachée (bi-, wa-, fa-, li-…) : alif muet
            if not word_start and not marks and nxt == 'ل' and re.search(r'(a|i|ou)$', latin):
                jj = j + 1
                lam_marks = ''
                while jj < n and chars[jj] in HARAKA:
                    lam_marks += chars[jj]
                    jj += 1
                after = jj
                a2 = after + 1
                after_marks = ''
                while a2 < n and chars[a2] in HARAKA:
                    after_marks += chars[a2]
                    a2 += 1
                if not lam_marks and after < n and chars[after] in SUN and SHADDA in after_marks:
                    hyphen_next = True
                    i = j + 1  # article assimilé : saute alif + lam
                    continue
                if not lam_marks or lam_marks == SUKUN:
                    latin += 'l-'
                    i = j + 1
                    continue
            if word_start:
                if not elide:
                    latin += vowel or 'a'
                # article « al » : assimilation devant lettre solaire chaddée
                if nxt == 'ل':
                    jj = j + 1
                    lam_marks = ''
                    while jj < n and chars[jj] in HARAKA:
                        lam_marks += chars[jj]
                        jj += 1
                    after = jj
                    a2 = after + 1
                    after_marks = ''
                    while a2 < n and chars[a2] in HARAKA:
                        after_marks += chars[a2]
                        a2 += 1
                    if not lam_marks and after < n and chars[after] in SUN and SHADDA in after_marks:
                        hyphen_next = True
                        i = j + 1
                        continue
                    if lam_marks == SUKUN:  # article lunaire : al-qamar, l-hayyou
                        latin += 'l-'
                        i = j + 1
                        continue
            elif latin.endswith('a'):
                latin = latin[:-1] + 'â'
            else:
                latin += 'â'
            i = j
            continue
        if c == MADDA_L:
            latin = (latin[:-1] + 'â') if latin.endswith('a') else latin + 'â'
            i = j
            continue
        if c == ALIF_MAQ:
            if latin.endswith('a'):
                latin = latin[:-1]
            latin += 'â'
            i = j
            continue
        if c == TA_MARB:
            latin += ('t' + vowel) if vowel else 'h'
            i = j
            continue

        base = CONS.get(c, '')
        if c == 'و' and not marks:
            if latin.endswith('ou'):
                latin = latin[:-2] + 'oû'
                i = j
                continue
        if c == 'ي' and not marks:
            if latin.endswith('i'):
                latin = latin[:-1] + 'î'
                i = j
                continue
        word_start_cons = not latin and (not out or out[-1] == ' ')
        if shadda and (not word_start_cons or hyphen_next):
            # article assimilé : « r-r », sauf pour Allah (ll)
            base = (base + '-' + base) if (hyphen_next and c != 'ل') else base + base
        hyphen_next = False

        latin += base + vowel

        # voyelle longue : fatha + alif de prolongation
        if vowel == 'a' and nxt in (ALIF, ALIF_MAQ):
            k = j + 1
            has_marks = False
            while k < n and chars[k] in HARAKA:
                has_marks = True
                k += 1
            if not has_marks or nxt == ALIF_MAQ:
                latin = latin[:-1] + 'â'
                i = j + 1
                continue
        i = j

    flush()
    s = ''.join(out)
    s = re.sub(r"''", "'", s)
    s = re.sub(r"(^| )'", r'\1', s)
    s = re.sub(r' +', ' ', s).strip()
    # lisibilité française : Allah unifié avec â long, majuscule
    s = s.replace('llah', 'llâh')
    s = re.sub(r'\ballâh', 'Allâh', s)
    s = re.sub(r'\bllâh', 'Llâh', s)
    return s


if __name__ == '__main__':
    import json, sys
    tests = [
        "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ",
        "ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ",
        "قُلۡ هُوَ ٱللَّهُ أَحَدٌ",
        "إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ",
        "وَلَقَدۡ جَآءَكُمۡ مُّوسَىٰ بِٱلۡبَيِّنَٰتِ",
    ]
    for t in tests:
        print(ar_to_fr(t))
