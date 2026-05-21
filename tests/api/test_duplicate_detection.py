from app.schemas import DuplicateCheckRequest
from app.services.duplicate_detection import (
    DuplicateCandidate,
    calculate_duplicate_similarity,
    calculate_text_similarity,
    rank_duplicate_candidates,
)


def test_calculate_text_similarity_ignores_stop_words():
    assert calculate_text_similarity("the login bug in the app", "login app bug") == 1.0


def test_duplicate_similarity_rewards_repro_steps_and_embedding():
    score = calculate_duplicate_similarity(
        "Login button not working",
        "Clicking login does nothing",
        "Login button not working",
        "Clicking login does nothing",
        request_repro_steps="Open login page\nClick login button",
        candidate_repro_steps="Open login page\nClick login button",
        request_embedding=[1.0, 0.0, 0.0],
        candidate_embedding=[1.0, 0.0, 0.0],
    )

    assert score == 1.0


def test_rank_duplicate_candidates_orders_best_match_first():
    request = DuplicateCheckRequest(
        title="Login button not working",
        description="Clicking login does nothing",
        repro_steps="Open login page\nClick login button",
    )
    candidates = [
        DuplicateCandidate(
            id=1,
            title="Login button not working",
            description="Clicking login does nothing",
            severity="high",
            type="ui",
            status="open",
            source="internal",
            embedding=[1.0, 0.0, 0.0],
            repro_steps="Open login page\nClick login button",
        ),
        DuplicateCandidate(
            id=2,
            title="Crash on export",
            description="Exporting a report throws an exception",
            severity="medium",
            type="backend",
            status="open",
            source="internal",
            embedding=[0.0, 1.0, 0.0],
            repro_steps="Open reports page\nClick export",
        ),
    ]

    result = rank_duplicate_candidates(
        request,
        candidates,
        request_embedding=[1.0, 0.0, 0.0],
    )

    assert result.is_duplicate is True
    assert len(result.similar_bugs) == 1
    assert result.similar_bugs[0].id == 1
    assert result.similar_bugs[0].similarity >= 0.82


def test_rank_duplicate_candidates_filters_low_scores():
    request = DuplicateCheckRequest(
        title="Login button not working",
        description="Clicking login does nothing",
    )
    candidates = [
        DuplicateCandidate(
            id=3,
            title="Settings page layout issue",
            description="The layout shifts on mobile",
            severity="low",
            type="ui",
            status="open",
            source="internal",
            embedding=[0.0, 1.0, 0.0],
        )
    ]

    result = rank_duplicate_candidates(
        request,
        candidates,
        request_embedding=[1.0, 0.0, 0.0],
    )

    assert result.is_duplicate is False
    assert result.similar_bugs == []
