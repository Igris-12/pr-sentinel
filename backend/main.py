import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from enum import Enum
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from radon.complexity import cc_visit


class AnalyzeRequest(BaseModel):
    diff: str


class RiskLabel(str, Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"
    critical = "CRITICAL"


class Severity(str, Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"
    critical = "CRITICAL"


class AssignmentMethod(str, Enum):
    ai_suggested = "ai_suggested"
    heuristic = "heuristic"
    manual = "manual"


class Radar(BaseModel):
    dependencyRisk: float = Field(0, ge=0, le=10)
    logicRisk: float = Field(0, ge=0, le=10)
    dataExposure: float = Field(0, ge=0, le=10)
    testingCoverage: float = Field(0, ge=0, le=10)


class BlastRadius(BaseModel):
    affectedServiceCount: int = 0
    affectedFiles: list[str] = Field(default_factory=list)
    graphSnapshot: str | None = None


class VulnerabilityFlag(BaseModel):
    severity: Severity
    message: str
    line: int | None = None


class StaticMetrics(BaseModel):
    linesAdded: int = 0
    linesRemoved: int = 0
    filesChanged: int = 0
    cyclomaticComplexityDelta: int = 0
    churnHistoryScore: float = 0
    vulnerabilityFlags: list[VulnerabilityFlag] = Field(default_factory=list)


class DiffAnnotation(BaseModel):
    file: str
    line: int
    severity: str
    note: str


class SimilarHistoricalPR(BaseModel):
    prNumber: int
    similarity: float
    outcome: str


class AnalyzeResponse(BaseModel):
    riskScore: float = Field(..., ge=0, le=10)
    riskLabel: RiskLabel
    confidence: float = Field(0, ge=0, le=1)
    rationale: list[str] = Field(default_factory=list)
    radar: Radar = Field(default_factory=Radar)
    blastRadius: BlastRadius = Field(default_factory=BlastRadius)
    staticMetrics: StaticMetrics = Field(default_factory=StaticMetrics)
    recommendedReviewers: list[str] = Field(default_factory=list)
    assignedReviewer: str | None = None
    assignmentMethod: AssignmentMethod | None = None
    diffAnnotations: list[DiffAnnotation] = Field(default_factory=list)
    similarHistoricalPRs: list[SimilarHistoricalPR] = Field(default_factory=list)
    analyzedAt: datetime
    geminiModelVersion: str


app = FastAPI()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    static_metrics = _calculate_static_metrics(payload.diff)
    gemini_payload = _call_gemini(payload.diff, static_metrics)
    if not isinstance(gemini_payload, dict):
        raise HTTPException(status_code=502, detail="Gemini response was not JSON.")

    gemini_payload["staticMetrics"] = static_metrics.model_dump()
    gemini_payload["analyzedAt"] = datetime.now(timezone.utc)
    gemini_payload["geminiModelVersion"] = GEMINI_MODEL
    try:
        return AnalyzeResponse.model_validate(gemini_payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini response did not match PRSentinel schema.",
        ) from exc


def _calculate_static_metrics(diff: str) -> StaticMetrics:
    added_lines = _extract_added_lines(diff)
    removed_lines = _extract_removed_lines(diff)
    files_changed = _count_files_changed(diff)
    complexity = _calculate_complexity(added_lines)
    return StaticMetrics(
        linesAdded=len(added_lines),
        linesRemoved=len(removed_lines),
        filesChanged=files_changed,
        cyclomaticComplexityDelta=complexity,
        churnHistoryScore=0,
        vulnerabilityFlags=[],
    )


def _calculate_complexity(added_lines: list[str]) -> int:
    code = "\n".join(added_lines)
    if not code.strip():
        return 0
    try:
        results = cc_visit(code)
    except Exception:
        # radon only parses valid Python code. If this is a PR for TypeScript/C++ etc.,
        # it will throw a SyntaxError. Just return 0 complexity in that case.
        return 0
    return sum(block.complexity for block in results)


def _call_gemini(diff: str, static_metrics: StaticMetrics) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set.")

    prompt = (
        "You are PRSentinel's risk analysis engine. "
        "Return a JSON object that matches the PRSentinel risk score schema. "
        "Use riskScore 0-10, riskLabel (LOW|MEDIUM|HIGH|CRITICAL), and confidence 0-1. "
        "You MUST evaluate and score all 4 radar risk dimensions (dependencyRisk, logicRisk, dataExposure, testingCoverage) on a scale of 0 to 10. Do not leave them as 0 unless there is truly zero risk. "
        "Return only JSON."
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            f"{prompt}\n\n"
                            f"Static metrics: {json.dumps(static_metrics.model_dump())}\n\n"
                            f"Diff:\n{diff}"
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json",
            "response_schema": _gemini_response_schema(),
        },
    }
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={api_key}"
    )

    max_retries = 3
    base_delay = 1
    for attempt in range(max_retries):
        try:
            request = Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))

            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except HTTPError as exc:
            if exc.code == 429 and attempt < max_retries - 1:
                # Gemini Free Tier limit requires waiting ~35-60 seconds when exhausted
                delay = 40
                print(f"Rate limited by Gemini API. Waiting {delay} seconds...")
                time.sleep(delay)
                continue
            raise HTTPException(
                status_code=502, detail=f"Gemini request failed: {exc.code}"
            ) from exc
        except (URLError, json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
            raise HTTPException(
                status_code=502, detail="Gemini response malformed or request failed."
            ) from exc

    raise HTTPException(status_code=502, detail="Gemini request failed after retries.")


def _gemini_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "riskScore": {"type": "number", "minimum": 0, "maximum": 10},
            "riskLabel": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "rationale": {"type": "array", "items": {"type": "string"}},
            "radar": {
                "type": "object",
                "properties": {
                    "dependencyRisk": {"type": "number", "minimum": 0, "maximum": 10},
                    "logicRisk": {"type": "number", "minimum": 0, "maximum": 10},
                    "dataExposure": {"type": "number", "minimum": 0, "maximum": 10},
                    "testingCoverage": {"type": "number", "minimum": 0, "maximum": 10},
                },
                "required": ["dependencyRisk", "logicRisk", "dataExposure", "testingCoverage"]
            },
            "blastRadius": {
                "type": "object",
                "properties": {
                    "affectedServiceCount": {"type": "integer", "minimum": 0},
                    "affectedFiles": {"type": "array", "items": {"type": "string"}},
                    "graphSnapshot": {"type": "string"},
                },
            },
            "staticMetrics": {
                "type": "object",
                "properties": {
                    "linesAdded": {"type": "integer", "minimum": 0},
                    "linesRemoved": {"type": "integer", "minimum": 0},
                    "filesChanged": {"type": "integer", "minimum": 0},
                    "cyclomaticComplexityDelta": {"type": "integer", "minimum": 0},
                    "churnHistoryScore": {"type": "number", "minimum": 0},
                    "vulnerabilityFlags": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "severity": {
                                    "type": "string",
                                    "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                                },
                                "message": {"type": "string"},
                                "line": {"type": "integer"},
                            },
                            "required": ["severity", "message"],
                        },
                    },
                },
            },
            "recommendedReviewers": {"type": "array", "items": {"type": "string"}},
            "assignedReviewer": {"type": "string"},
            "assignmentMethod": {
                "type": "string",
                "enum": ["ai_suggested", "heuristic", "manual"],
            },
            "diffAnnotations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "line": {"type": "integer"},
                        "severity": {"type": "string"},
                        "note": {"type": "string"},
                    },
                    "required": ["file", "line", "severity", "note"],
                },
            },
            "similarHistoricalPRs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "prNumber": {"type": "integer"},
                        "similarity": {"type": "number"},
                        "outcome": {"type": "string"},
                    },
                    "required": ["prNumber", "similarity", "outcome"],
                },
            },
        },
        "required": ["riskScore", "riskLabel", "confidence", "radar", "rationale"],
    }


def _extract_added_lines(diff: str) -> list[str]:
    added_lines: list[str] = []
    for line in diff.splitlines():
        if line.startswith(("diff ", "index ", "--- ", "+++ ", "@@")):
            continue
        if line.startswith("+") and not line.startswith("+++"):
            added_lines.append(line[1:])
    return added_lines


def _extract_removed_lines(diff: str) -> list[str]:
    removed_lines: list[str] = []
    for line in diff.splitlines():
        if line.startswith(("diff ", "index ", "--- ", "+++ ", "@@")):
            continue
        if line.startswith("-") and not line.startswith("---"):
            removed_lines.append(line[1:])
    return removed_lines


def _count_files_changed(diff: str) -> int:
    return sum(1 for line in diff.splitlines() if line.startswith("diff --git "))
