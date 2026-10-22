import pytest

from app.insights import Band, distribution, percentile, summarize, summarize_by


class TestPercentile:
    def test_single_value(self):
        assert percentile([42], 90) == 42

    def test_median_of_odd_count_is_middle_value(self):
        assert percentile([1, 2, 9], 50) == 2

    def test_median_of_even_count_interpolates(self):
        assert percentile([10, 20, 30, 40], 50) == 25

    def test_quartiles_interpolate_between_ranks(self):
        data = [10, 20, 30, 40, 50]
        assert percentile(data, 25) == 20
        assert percentile(data, 75) == 40
        assert percentile([0, 100], 25) == 25

    def test_extremes(self):
        assert percentile([5, 6, 7], 0) == 5
        assert percentile([5, 6, 7], 100) == 7

    def test_empty_data_is_an_error(self):
        with pytest.raises(ValueError):
            percentile([], 50)


class TestSummarize:
    def test_empty_returns_none(self):
        assert summarize([]) is None

    def test_computes_all_statistics_regardless_of_input_order(self):
        stats = summarize([50, 10, 40, 20, 30])

        assert (stats.headcount, stats.total_usd, stats.average_usd) == (5, 150, 30)
        assert (stats.min_usd, stats.p25_usd, stats.median_usd, stats.p75_usd, stats.max_usd) == (
            10, 20, 30, 40, 50,
        )

    def test_average_is_rounded_to_whole_usd(self):
        assert summarize([1, 2]).average_usd == 2  # 1.5 rounds half to even -> 2

    def test_median_is_resistant_to_outliers_unlike_average(self):
        stats = summarize([100, 100, 100, 100, 10_000])

        assert stats.median_usd == 100
        assert stats.average_usd == 2_080


class TestSummarizeBy:
    def test_groups_and_summarises_each_key(self):
        result = summarize_by([("US", 100), ("IN", 10), ("US", 300), ("IN", 30)])

        assert set(result) == {"US", "IN"}
        assert result["US"].average_usd == 200
        assert result["IN"].headcount == 2


class TestDistribution:
    def test_counts_values_into_fixed_width_bands(self):
        bands = distribution([5, 15, 16, 25, 99], bucket_size=10)

        assert bands[0] == Band(0, 10, 1)
        assert bands[1] == Band(10, 20, 2)
        assert bands[2] == Band(20, 30, 1)
        assert bands[-1] == Band(90, 100, 1)

    def test_includes_empty_bands_between_populated_ones(self):
        bands = distribution([1, 35], bucket_size=10)

        assert [b.count for b in bands] == [1, 0, 0, 1]

    def test_boundary_value_belongs_to_the_upper_band(self):
        assert distribution([10], bucket_size=10)[-1] == Band(10, 20, 1)

    def test_empty_input_gives_no_bands(self):
        assert distribution([], bucket_size=10) == []

    def test_rejects_non_positive_bucket_size(self):
        with pytest.raises(ValueError):
            distribution([1], bucket_size=0)
