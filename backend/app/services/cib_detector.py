from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher


@dataclass(frozen=True, slots=True)
class CIBFinding:
    coordinated: bool
    coordination_score: float
    threat_level: int
    evidence: dict[str, object]


class CIBDetector:
    """MVP heuristic combining text duplication, cadence and author concentration."""

    def inspect(self, samples: list[tuple[str, str, datetime]]) -> CIBFinding:
        if len(samples) < 4:
            return CIBFinding(False, 0.0, 1, {"reason": "insufficient_sample", "sample_size": len(samples)})

        authors = Counter(author for author, _, _ in samples)
        timestamps = sorted(timestamp for _, _, timestamp in samples)
        span_seconds = max(1.0, (timestamps[-1] - timestamps[0]).total_seconds())
        cadence = min(1.0, len(samples) / max(5.0, span_seconds / 20.0))

        similarities: list[float] = []
        texts = [text.casefold() for _, text, _ in samples[-40:]]
        for index, text in enumerate(texts):
            for other in texts[index + 1 :]:
                similarities.append(SequenceMatcher(None, text, other).ratio())
        duplicate_ratio = sum(score >= 0.82 for score in similarities) / max(1, len(similarities))
        author_concentration = max(authors.values()) / len(samples)
        score = min(1.0, duplicate_ratio * 0.55 + cadence * 0.3 + author_concentration * 0.15)
        threat = 4 if score >= 0.85 else 3 if score >= 0.68 else 2 if score >= 0.48 else 1
        return CIBFinding(
            coordinated=score >= 0.68,
            coordination_score=round(score, 4),
            threat_level=threat,
            evidence={
                "sample_size": len(samples),
                "duplicate_ratio": round(duplicate_ratio, 4),
                "cadence_score": round(cadence, 4),
                "author_concentration": round(author_concentration, 4),
                "top_authors": authors.most_common(5),
            },
        )


cib_detector = CIBDetector()

