from ingestion.diff_filter import extract_changed_files, filter_diff

_CODE_DIFF = """diff --git a/backend/auth.py b/backend/auth.py
index e69de29..4b825dc 100644
--- a/backend/auth.py
+++ b/backend/auth.py
@@ -1,3 +1,4 @@
 def login():
-    pass
+    return True
+
"""

_LOCKFILE_DIFF = """diff --git a/package-lock.json b/package-lock.json
index 1111111..2222222 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,2 +1,2 @@
-{"lockfileVersion": 2}
+{"lockfileVersion": 3}
"""

_NESTED_LOCKFILE_DIFF = """diff --git a/frontend/package-lock.json b/frontend/package-lock.json
index 1111111..2222222 100644
--- a/frontend/package-lock.json
+++ b/frontend/package-lock.json
@@ -1,2 +1,2 @@
-{"lockfileVersion": 2}
+{"lockfileVersion": 3}
"""


def test_small_real_diff_passes_through_unchanged():
    result = filter_diff(_CODE_DIFF)

    assert result == _CODE_DIFF


def test_lockfile_hunk_excluded_while_code_hunk_survives():
    raw_diff = _LOCKFILE_DIFF + _CODE_DIFF

    result = filter_diff(raw_diff)

    assert result == _CODE_DIFF
    assert "lockfileVersion" not in result


def test_nested_lockfile_is_also_excluded():
    raw_diff = _NESTED_LOCKFILE_DIFF + _CODE_DIFF

    result = filter_diff(raw_diff)

    assert result == _CODE_DIFF


def test_diff_whose_only_file_is_excluded_returns_empty_string():
    result = filter_diff(_LOCKFILE_DIFF)

    assert result == ""


def test_oversized_diff_is_truncated_with_omitted_count_stated():
    body_lines = [f"+line {i}" for i in range(500)]
    raw_diff = "diff --git a/big.py b/big.py\n" + "\n".join(body_lines)

    result = filter_diff(raw_diff)
    result_lines = result.splitlines()
    original_lines = raw_diff.splitlines()

    assert result_lines[0] == original_lines[0]
    assert result_lines[-1] == original_lines[-1]
    assert len(result_lines) < len(original_lines)

    omitted = len(original_lines) - 300 - 100
    assert f"[{omitted} lines omitted]" in result


def test_filter_diff_does_not_depend_on_a_separately_passed_file_list():
    # Regression test for the exact bug found in PR#114 review: filter_diff
    # used to take a `changed_files` list and zip() it positionally against
    # the diff's own sections. Any caller whose list was empty, shorter, or
    # differently ordered than the diff (e.g. github_client.list_commits,
    # which never populated CommitRef.files_changed) caused zip() to exhaust
    # immediately, silently dropping every hunk — extraction always saw an
    # empty diff. filter_diff now takes only the diff text itself.
    raw_diff = _LOCKFILE_DIFF + _CODE_DIFF

    result = filter_diff(raw_diff)

    assert result == _CODE_DIFF
    assert result != ""


def test_extract_changed_files_reads_paths_from_diff_headers():
    raw_diff = _LOCKFILE_DIFF + _CODE_DIFF

    assert extract_changed_files(raw_diff) == ["package-lock.json", "backend/auth.py"]


def test_extract_changed_files_on_empty_diff_returns_empty_list():
    assert extract_changed_files("") == []
