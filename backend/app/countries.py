"""Supported countries, their currencies and static USD conversion rates.

Rates are deliberately static (see docs/01-requirements.md): insights are for
comparing pay across countries, not for accounting, and a live FX feed would
add an external dependency and non-deterministic numbers.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Country:
    code: str
    name: str
    currency: str
    usd_rate: float  # 1 unit of local currency in USD


COUNTRIES: dict[str, Country] = {
    c.code: c
    for c in (
        Country("US", "United States", "USD", 1.0),
        Country("GB", "United Kingdom", "GBP", 1.27),
        Country("DE", "Germany", "EUR", 1.08),
        Country("FR", "France", "EUR", 1.08),
        Country("CA", "Canada", "CAD", 0.73),
        Country("AU", "Australia", "AUD", 0.66),
        Country("SG", "Singapore", "SGD", 0.74),
        Country("JP", "Japan", "JPY", 0.0067),
        Country("IN", "India", "INR", 0.012),
        Country("BR", "Brazil", "BRL", 0.18),
    )
}


def to_usd(amount: int, country_code: str) -> int:
    """Convert an annual salary in local currency to whole USD."""
    return round(amount * COUNTRIES[country_code].usd_rate)
