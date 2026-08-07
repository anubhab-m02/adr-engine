import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config_store


def test_unseen_repo_defaults_to_allowed(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    assert config_store.get_cloud_synthesis_allowed("owner/repo") is True


def test_private_repo_defaults_to_disallowed(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_repo_privacy("owner/repo", private=True)

    assert config_store.get_cloud_synthesis_allowed("owner/repo") is False


def test_public_repo_defaults_to_allowed(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_repo_privacy("owner/repo", private=False)

    assert config_store.get_cloud_synthesis_allowed("owner/repo") is True


def test_explicit_override_wins_over_private_derived_default(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_cloud_synthesis_allowed("owner/repo", True)
    config_store.set_repo_privacy("owner/repo", private=True)

    assert config_store.get_cloud_synthesis_allowed("owner/repo") is True


def test_explicit_override_wins_over_public_derived_default(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_cloud_synthesis_allowed("owner/repo", False)
    config_store.set_repo_privacy("owner/repo", private=False)

    assert config_store.get_cloud_synthesis_allowed("owner/repo") is False


def test_reindex_updates_derived_default_when_no_override_exists(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_repo_privacy("owner/repo", private=False)
    config_store.set_repo_privacy("owner/repo", private=True)

    assert config_store.get_cloud_synthesis_allowed("owner/repo") is False


def test_repo_settings_do_not_clobber_each_other(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_repo_privacy("owner/repo-a", private=True)
    config_store.set_repo_privacy("owner/repo-b", private=False)

    assert config_store.get_cloud_synthesis_allowed("owner/repo-a") is False
    assert config_store.get_cloud_synthesis_allowed("owner/repo-b") is True
