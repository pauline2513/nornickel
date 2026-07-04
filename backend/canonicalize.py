"""Приведение имён сущностей к каноничному виду:
нижний регистр + лемматизация каждого слова (pymorphy3).
«Сжигание элементарной серы» -> «сжигание элементарный сера»
Одинаковые по смыслу написания схлопываются в одну вершину при MERGE.
"""

import re
from functools import lru_cache

import pymorphy3

_morph = None
_WORD_RE = re.compile(r"[а-яёa-z0-9]+(?:-[а-яёa-z0-9]+)*", re.IGNORECASE)


def _get_morph():
    global _morph
    if _morph is None:
        _morph = pymorphy3.MorphAnalyzer()
    return _morph


def _lemma(word: str) -> str:
    return _get_morph().parse(word)[0].normal_form


def canonical_name(text: str) -> str:
    words = _WORD_RE.findall(text.lower())
    return " ".join(_lemma(w) for w in words).replace("ё", "е").strip()
