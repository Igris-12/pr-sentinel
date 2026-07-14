import pytest

pytest.importorskip("fastapi")
pytest.importorskip("radon")

from fastapi.testclient import TestClient

import backend.main as main


def test_analyze_returns_risk_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    diff = "\n".join(
        [
            "diff --git a/foo.py b/foo.py",
            "index 123..456 100644",
            "--- a/foo.py",
            "+++ b/foo.py",
            "@@",
            "+def foo(x):",
            "+    if x > 0:",
            "+        return 1",
            "+    return 0",
        ]
    )

    def fake_gemini_call(_: str, __: main.StaticMetrics) -> dict[str, object]:
        return {
            "riskScore": 7.5,
            "riskLabel": "HIGH",
            "confidence": 0.82,
            "rationale": ["Complex control flow."],
            "radar": {
                "dependencyRisk": 2,
                "logicRisk": 7,
                "dataExposure": 1,
                "testingCoverage": 3,
            },
            "blastRadius": {
                "affectedServiceCount": 1,
                "affectedFiles": ["foo.py"],
                "graphSnapshot": None,
            },
            "staticMetrics": {
                "linesAdded": 0,
                "linesRemoved": 0,
                "filesChanged": 0,
                "cyclomaticComplexityDelta": 0,
                "churnHistoryScore": 0,
                "vulnerabilityFlags": [],
            },
            "recommendedReviewers": ["alice"],
            "assignedReviewer": "alice",
            "assignmentMethod": "ai_suggested",
            "diffAnnotations": [
                {"file": "foo.py", "line": 1, "severity": "HIGH", "note": "Complex logic"}
            ],
            "similarHistoricalPRs": [
                {"prNumber": 123, "similarity": 0.8, "outcome": "merged"}
            ],
        }

    monkeypatch.setattr(main, "_call_gemini", fake_gemini_call)

    client = TestClient(main.app)
    response = client.post("/api/analyze", json={"diff": diff})

    assert response.status_code == 200
    payload = response.json()
    assert payload["riskScore"] == 7.5
    assert payload["riskLabel"] == "HIGH"
    assert payload["staticMetrics"] == {
        "linesAdded": 4,
        "linesRemoved": 0,
        "filesChanged": 1,
        "cyclomaticComplexityDelta": 2,
        "churnHistoryScore": 0,
        "vulnerabilityFlags": [],
    }
    assert payload["geminiModelVersion"] == "gemini-2.0-flash"
    assert "analyzedAt" in payload
