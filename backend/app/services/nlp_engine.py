import re
from collections import Counter

from app.models.schemas import NLPResult

TOKEN_PATTERN = re.compile(r"[\w'-]+", re.UNICODE)

POSITIVE_TERMS = {
    "good": 0.45,
    "great": 0.7,
    "improved": 0.55,
    "progress": 0.5,
    "affordable": 0.6,
    "jobs": 0.35,
    "salama": 0.45,
    "vizuri": 0.55,
    "bora": 0.45,
    "nafuu": 0.55,
    "imeweza": 0.6,
}
NEGATIVE_TERMS = {
    "bad": -0.45,
    "worse": -0.65,
    "crisis": -0.8,
    "failed": -0.65,
    "corrupt": -0.75,
    "expensive": -0.55,
    "shortage": -0.6,
    "unsafe": -0.7,
    "ghali": -0.55,
    "ufisadi": -0.75,
    "noma": -0.5,
    "mbaya": -0.6,
    "hakuna": -0.35,
    "imeharibika": -0.65,
}
SHENG_TERMS = {"manze", "rada", "noma", "msee", "wasee", "sina", "mbao", "chapaa", "hii", "maze", "mbogi"}
SWAHILI_TERMS = {"serikali", "wananchi", "bei", "maisha", "afya", "usalama", "elimu", "kilimo", "barabara", "kazi"}

ISSUE_TERMS: dict[str, set[str]] = {
    "economy": {"economy", "inflation", "price", "prices", "tax", "taxes", "bei", "ghali", "chapaa", "cost"},
    "healthcare": {"health", "hospital", "clinic", "medicine", "doctor", "afya", "dawa"},
    "infrastructure": {"road", "roads", "water", "power", "electricity", "barabara", "maji", "stima"},
    "corruption": {"corruption", "corrupt", "bribe", "scandal", "ufisadi", "hongo"},
    "education": {"school", "teacher", "university", "education", "elimu", "shule"},
    "youth_employment": {"youth", "jobs", "employment", "unemployed", "kazi", "vijana"},
    "security": {"security", "crime", "police", "unsafe", "attack", "usalama", "wizi"},
    "local_leadership": {"governor", "mca", "leader", "county", "serikali", "uongozi"},
    "agriculture": {"farmer", "farming", "fertilizer", "maize", "agriculture", "kilimo", "mbolea"},
}


class NLPEngine:
    """Deterministic multilingual baseline suitable for the MVP and test fixtures.

    Production deployments can replace this class behind the same result contract
    with a fine-tuned transformer without changing the worker or API layers.
    """

    model_version = "pulse-lexicon-ke-1.0"

    def analyze(self, text: str) -> NLPResult:
        tokens = [token.lower() for token in TOKEN_PATTERN.findall(text)]
        counts = Counter(tokens)
        sheng_hits = sorted(set(tokens) & SHENG_TERMS)
        swahili_hits = sorted(set(tokens) & SWAHILI_TERMS)
        language = "sheng" if len(sheng_hits) >= 1 else "sw" if len(swahili_hits) >= 2 else "en"

        term_weights = POSITIVE_TERMS | NEGATIVE_TERMS
        matched = sorted(token for token in counts if token in term_weights)
        weighted_score = sum(term_weights[token] * min(counts[token], 2) for token in matched)
        score = max(-1.0, min(1.0, weighted_score / max(1.0, len(matched) ** 0.5)))

        axis_counts = {
            axis: sum(counts[term] for term in terms)
            for axis, terms in ISSUE_TERMS.items()
        }
        issue_axis = max(axis_counts, key=axis_counts.get)
        if axis_counts[issue_axis] == 0:
            issue_axis = "local_leadership"

        evidence_count = len(matched) + axis_counts[issue_axis] + len(sheng_hits) + len(swahili_hits)
        confidence = min(0.96, 0.52 + evidence_count * 0.055)
        return NLPResult(
            language=language,
            sheng_detected=bool(sheng_hits),
            issue_axis=issue_axis,  # type: ignore[arg-type]
            score=round(score, 4),
            confidence=round(confidence, 4),
            matched_terms=sorted(set(matched + sheng_hits + swahili_hits)),
        )


nlp_engine = NLPEngine()

