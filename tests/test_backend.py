"""Minimal backend unit tests.

These are light-weight and focus on pure helpers that do not require
loading large models, so they can run quickly once pytest is available
in your environment.
"""

from workflow.worker_workflow import _haversine_km


def test_haversine_zero_distance():
	"""Distance between identical coordinates should be ~0 km."""
	d = _haversine_km(23.2599, 77.4126, 23.2599, 77.4126)
	assert abs(d) < 1e-6


def test_haversine_symmetric():
	"""Distance should be symmetric between A->B and B->A."""
	bhopal = (23.2599, 77.4126)
	other = (23.2700, 77.4400)
	d1 = _haversine_km(*bhopal, *other)
	d2 = _haversine_km(*other, *bhopal)
	assert abs(d1 - d2) < 1e-6
