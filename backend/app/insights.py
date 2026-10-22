from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class SalaryStats:
    headcount: int
    total_usd: int
    average_usd: int
    min_usd: int
    p25_usd: int
    median_usd: int
    p75_usd: int
    max_usd: int


@dataclass(frozen=True)
class Band:
    from_usd: int
    to_usd: int  # exclusive, except that the last band also holds the maximum
    count: int


def percentile(sorted_values: list[int], pct: float) -> float:
    # linear interpolation, same as numpy's default
    if not sorted_values:
        raise ValueError("percentile of empty data")
    rank = (len(sorted_values) - 1) * pct / 100
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * (rank - low)


def summarize(values: Iterable[int]) -> SalaryStats | None:
    ordered = sorted(values)
    if not ordered:
        return None
    total = sum(ordered)
    return SalaryStats(
        headcount=len(ordered),
        total_usd=total,
        average_usd=round(total / len(ordered)),
        min_usd=ordered[0],
        p25_usd=round(percentile(ordered, 25)),
        median_usd=round(percentile(ordered, 50)),
        p75_usd=round(percentile(ordered, 75)),
        max_usd=ordered[-1],
    )


def summarize_by(pairs: Iterable[tuple[str, int]]) -> dict[str, SalaryStats]:
    groups: dict[str, list[int]] = defaultdict(list)
    for key, usd in pairs:
        groups[key].append(usd)
    return {key: summarize(values) for key, values in groups.items()}


def distribution(values: Iterable[int], bucket_size: int) -> list[Band]:
    if bucket_size <= 0:
        raise ValueError("bucket_size must be positive")
    counts: dict[int, int] = defaultdict(int)
    for value in values:
        counts[value // bucket_size] += 1
    if not counts:
        return []
    return [
        Band(i * bucket_size, (i + 1) * bucket_size, counts.get(i, 0))
        for i in range(max(counts) + 1)
    ]
