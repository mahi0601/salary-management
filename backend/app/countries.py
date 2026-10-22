# Rates are hard-coded on purpose. We only compare pay across countries here,
# nobody is paying anyone off these numbers, and a live FX feed would make
# the reports change under you. Rough 2025 values.
from dataclasses import dataclass


@dataclass(frozen=True)
class Country:
    code: str
    name: str
    currency: str
    usd_rate: float  # USD per 1 unit of local currency


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
    return round(amount * COUNTRIES[country_code].usd_rate)
