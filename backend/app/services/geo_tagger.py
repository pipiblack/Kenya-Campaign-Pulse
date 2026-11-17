import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import Constituency, County, Ward


@dataclass(frozen=True, slots=True)
class GeoMatch:
    county_id: UUID | None = None
    constituency_id: UUID | None = None
    ward_id: UUID | None = None
    confidence: float = 0.0
    label: str | None = None


def _contains_place(text: str, place: str) -> bool:
    return bool(re.search(rf"(?<!\w){re.escape(place.lower())}(?!\w)", text.lower()))


class GeoTagger:
    async def tag(self, session: AsyncSession, text: str) -> GeoMatch:
        wards = (
            await session.execute(
                select(Ward.id, Ward.constituency_id, Ward.name, Constituency.county_id)
                .join(Constituency, Constituency.id == Ward.constituency_id)
                .where(Ward.name.ilike(f"%{self._longest_token(text)}%"))
                .limit(30)
            )
        ).all()
        for ward_id, constituency_id, name, county_id in wards:
            if len(name) >= 5 and _contains_place(text, name):
                return GeoMatch(county_id, constituency_id, ward_id, 0.92, name)

        constituencies = (await session.execute(select(Constituency).order_by(Constituency.name))).scalars().all()
        for constituency in constituencies:
            if len(constituency.name) >= 5 and _contains_place(text, constituency.name):
                return GeoMatch(constituency.county_id, constituency.id, None, 0.84, constituency.name)

        counties = (await session.execute(select(County).order_by(County.name))).scalars().all()
        for county in counties:
            if _contains_place(text, county.name):
                return GeoMatch(county.id, None, None, 0.8, county.name)
        return GeoMatch()

    @staticmethod
    def _longest_token(text: str) -> str:
        tokens = re.findall(r"[A-Za-z'-]{4,}", text)
        return max(tokens, key=len, default="zzzz-no-match")


geo_tagger = GeoTagger()

