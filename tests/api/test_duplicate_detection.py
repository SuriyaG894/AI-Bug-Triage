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


def test_calculate_text_similarity_ignores_html_tags():
    assert calculate_text_similarity("<p>the <b>login</b> bug in the app</p>", "login app bug") == 1.0


def test_rank_duplicate_candidates_deduplicates_by_external_id():
    request = DuplicateCheckRequest(
        title="Validation Section issue",
        description="Cannot edit validation items",
        repro_steps="Open validation section and try adding an item",
    )
    # Candidate 1: Local bug pushed to ADO (external_id = "106")
    cand1 = DuplicateCandidate(
        id=55,
        title="Validation Section issue",
        description="Cannot edit validation items",
        severity="medium",
        type="ui",
        status="open",
        source="internal",
        external_id="106",
        repro_steps="Open validation section and try adding an item",
    )
    # Candidate 2: ADO work item (external_id = "106") representing the same bug
    cand2 = DuplicateCandidate(
        id=None,
        title="Validation Section issue",
        description="Cannot edit validation items",
        severity="",
        type="",
        status="active",
        source="azure_devops",
        external_id="106",
        repro_steps="Open validation section and try adding an item",
    )

    result = rank_duplicate_candidates(
        request,
        [cand1, cand2],
        visible_threshold=0.35,
    )

    # It should have grouped them, kept only the azure_devops candidate, and preserved high similarity
    assert len(result.similar_bugs) == 1
    bug = result.similar_bugs[0]
    assert bug.source == "azure_devops"
    assert bug.external_id == "106"
    assert bug.id is None
    assert bug.similarity >= 0.90


def test_parse_ado_description_similarity():
    from app.services.integrations.field_mapping import parse_ado_description

    ado_description = """
    <h3>Description</h3>
    The validation section is broken.
    <h3>Expected Result</h3>
    Should be able to add validation items.
    <h3>Actual Result</h3>
    Cannot add validation items.
    <h3>Steps to Reproduce</h3>
    1. Go to edit mode.
    2. Try to add validation item.
    """

    parsed = parse_ado_description(ado_description)
    assert "broken" in parsed["description"]
    assert "Expected Result" not in parsed["description"]
    assert "validation item" in parsed["repro_steps"]


def test_parse_ado_description_paragraph_headers():
    from app.services.integrations.field_mapping import parse_ado_description

    ado_description = """
    <p><b>Description:</b></p>
    <p>This is a native ADO bug report description content.</p>
    <p><strong>Steps to reproduce:</strong></p>
    <ol>
      <li>Step 1</li>
      <li>Step 2</li>
    </ol>
    <p><u>Expected Result:</u></p>
    <p>Expected behavior content</p>
    <p><strong>Actual Result:</strong></p>
    <p>Actual behavior content</p>
    <table>
      <tr><td><b>Priority:</b></td><td>high</td></tr>
    </table>
    """

    parsed = parse_ado_description(ado_description)
    assert "This is a native ADO bug report description content." in parsed["description"]
    assert "Expected behavior content" in parsed["expected_result"]
    assert "Actual behavior content" in parsed["actual_result"]
    assert "<li>Step 1</li>" in parsed["repro_steps"]
    assert "Priority:" not in parsed["description"]
    assert "Priority:" not in parsed["repro_steps"]
    assert "Priority:" not in parsed["expected_result"]
    assert "Priority:" not in parsed["actual_result"]


def test_ado_to_local_repro_steps_fallback():
    from app.services.integrations.field_mapping import ado_to_local

    # Case 1: repro_steps not in description, but in Microsoft.VSTS.TCM.ReproSteps
    fields = {
        "System.Title": "Sample Bug",
        "System.Description": "<p><b>Description:</b></p><p>This is just description.</p>",
        "Microsoft.VSTS.TCM.ReproSteps": "<p>Repro steps from fallback field.</p>"
    }
    result = ado_to_local(fields)
    assert "This is just description" in result["description"]
    assert "Repro steps from fallback field" in result["repro_steps"]

    # Case 2: repro_steps parsed from description, fallback field also present (description takes priority)
    fields = {
        "System.Title": "Sample Bug 2",
        "System.Description": "<p><b>Description:</b></p><p>This is description.</p><p><b>Steps to reproduce:</b></p><p>Steps in description.</p>",
        "Microsoft.VSTS.TCM.ReproSteps": "<p>Repro steps fallback.</p>"
    }
    result = ado_to_local(fields)
    assert "Steps in description" in result["repro_steps"]


def test_parse_ado_description_wrapped_container():
    from app.services.integrations.field_mapping import parse_ado_description

    ado_description = '<div><span><strong>Description</strong></span> <p>The system allows uploading files with unsupported/invalid formats in the "Attach files as context" section.<br/>There is no validation message or restriction enforced, even though supported formats are mentioned (PDF, Word, TXT, PNG, JPG). </p><span><strong>Steps to Reproduce</strong></span> <ol><li>Navigate to<span>\\xa0</span><strong>Draft User Story</strong> </li><li>Go to<span>\\xa0</span><strong>Attach files as context</strong> </li><li>Upload a file with unsupported format (e.g.,<span>\\xa0</span>.exe,<span>\\xa0</span>.csv,<span>\\xa0</span>.zip) </li><li>Observe the behavior </li> </ol><span><strong>Actual Result</strong></span> <ul><li>Invalid file is successfully uploaded </li><li>No error message or validation popup is shown </li> </ul><span><strong>Expected Result</strong></span> <ul><li>System should<span>\\xa0</span><strong>restrict unsupported file formats</strong> </li><li>Show proper validation message like:<br/><em>"Invalid file format. Please upload only PDF, Word, TXT, PNG, or JPG files."</em> </li> </ul><br/> </div>'

    parsed = parse_ado_description(ado_description)
    assert "The system allows uploading files" in parsed["description"]
    assert "Navigate to" in parsed["repro_steps"]
    assert "Invalid file is successfully uploaded" in parsed["actual_result"]
    assert "System should" in parsed["expected_result"]



