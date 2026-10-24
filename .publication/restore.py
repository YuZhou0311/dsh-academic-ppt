#!/usr/bin/env python3
"""Verify an isolated transfer pack and fast-forward one explicitly allowed ref.

--verify-only verifies and imports local objects, but performs no network request,
push, ref update, checkout, configuration change, or credential modification.
The checkout must already contain baseCommit (use fetch-depth: 0 in the workflow).
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit


ALLOWED_REPOSITORY = "YuZhou0311/dsh-academic-ppt"
ALLOWED_REF = "refs/heads/feat/research-native-rebuild"
RAW_PART_BYTES = 240000
MAX_PARTS = 1000
SHA1 = re.compile(r"[0-9a-f]{40}\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")


class TransferError(Exception):
    """An intentionally non-sensitive, user-readable verification failure."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise TransferError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Manifest contains a duplicate JSON key.")
        result[key] = value
    return result


def read_regular(path: Path, limit: int) -> bytes:
    """Reject links, directories and special files before bounded reading."""
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    require(not path.is_symlink(), "Transfer input must not be a symbolic link.")
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        raise TransferError("Cannot open a required transfer input.") from error
    with os.fdopen(descriptor, "rb") as stream:
        metadata = os.fstat(stream.fileno())
        require(stat.S_ISREG(metadata.st_mode), "Transfer input must be a regular file.")
        require(0 < metadata.st_size <= limit, "Transfer input size is outside its bound.")
        data = stream.read(limit + 1)
    require(len(data) == metadata.st_size, "Transfer input changed while reading.")
    return data


def load_manifest(directory: Path) -> dict:
    raw = read_regular(directory / "manifest.json", 1024 * 1024)
    try:
        manifest = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise TransferError("Manifest is not valid UTF-8 JSON.") from error
    required = {"schemaVersion", "repository", "targetRef", "baseCommit", "targetCommit", "targetTree", "packSha256", "packBytes", "parts"}
    require(isinstance(manifest, dict) and set(manifest) == required, "Manifest has missing or unexpected fields.")
    require(type(manifest["schemaVersion"]) is int and manifest["schemaVersion"] == 1, "Unsupported manifest schema.")
    require(manifest["repository"] == ALLOWED_REPOSITORY, "Repository is not allowed.")
    require(manifest["targetRef"] == ALLOWED_REF, "Target ref is not allowed.")
    for key in ("baseCommit", "targetCommit", "targetTree"):
        require(isinstance(manifest[key], str) and SHA1.fullmatch(manifest[key]) is not None, "Invalid Git object identifier.")
    require(manifest["targetCommit"] != manifest["baseCommit"], "Target must differ from the stated base.")
    require(isinstance(manifest["packSha256"], str) and SHA256.fullmatch(manifest["packSha256"]) is not None, "Invalid pack SHA-256.")
    require(type(manifest["packBytes"]) is int and 12 < manifest["packBytes"] <= RAW_PART_BYTES * MAX_PARTS, "Invalid pack byte count.")
    parts = manifest["parts"]
    require(isinstance(parts, list) and 1 <= len(parts) <= MAX_PARTS, "Invalid number of parts.")
    total = 0
    for index, part in enumerate(parts):
        require(isinstance(part, dict) and set(part) == {"path", "size", "sha256", "decodedSize"}, "Part record has missing or unexpected fields.")
        require(part["path"] == f"parts/part{index:03d}.b64", "Part names must be a consecutive, zero-based sequence.")
        require(type(part["decodedSize"]) is int and 0 < part["decodedSize"] <= RAW_PART_BYTES, "Invalid decoded part size.")
        require(index == len(parts) - 1 or part["decodedSize"] == RAW_PART_BYTES, "Only the final part may be short.")
        require(type(part["size"]) is int and part["size"] == 4 * ((part["decodedSize"] + 2) // 3), "Invalid encoded part size.")
        require(isinstance(part["sha256"], str) and SHA256.fullmatch(part["sha256"]) is not None, "Invalid part SHA-256.")
        total += part["decodedSize"]
    require(total == manifest["packBytes"], "Declared part sizes do not equal the pack size.")
    parts_dir = directory / "parts"
    require(parts_dir.is_dir() and not parts_dir.is_symlink(), "Parts directory must be a real directory.")
    expected_names = {f"part{index:03d}.b64" for index in range(len(parts))}
    require({path.name for path in parts_dir.iterdir()} == expected_names, "Parts directory contains missing or unexpected entries.")
    return manifest


def restore_pack(directory: Path, manifest: dict, destination: Path) -> None:
    digest = hashlib.sha256()
    total = 0
    with destination.open("xb") as output:
        for part in manifest["parts"]:
            # load_manifest accepted only the literal parts/partNNN.b64 sequence.
            encoded = read_regular(directory / part["path"], 4 * ((RAW_PART_BYTES + 2) // 3))
            require(len(encoded) == part["size"], "Encoded part size does not match the manifest.")
            require(hashlib.sha256(encoded).hexdigest() == part["sha256"], "Encoded part SHA-256 mismatch.")
            try:
                decoded = base64.b64decode(encoded, validate=True)
            except (ValueError, base64.binascii.Error) as error:
                raise TransferError("Part is not valid base64.") from error
            require(base64.b64encode(decoded) == encoded, "Part has a non-canonical base64 encoding.")
            require(len(decoded) == part["decodedSize"], "Decoded part size does not match the manifest.")
            digest.update(decoded)
            total += len(decoded)
            output.write(decoded)
    require(total == manifest["packBytes"], "Restored pack byte count mismatch.")
    require(digest.hexdigest() == manifest["packSha256"], "Restored pack SHA-256 mismatch.")
    with destination.open("rb") as stream:
        require(stream.read(4) == b"PACK", "Restored data is not a Git pack.")


def git(repository: Path, *arguments: str, stdin=None, timeout: int = 180) -> str:
    environment = os.environ.copy()
    environment["GIT_TERMINAL_PROMPT"] = "0"
    try:
        result = subprocess.run(["git", "-C", str(repository), *arguments], stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise TransferError("Git operation could not complete within its bound.") from error
    # Never echo subprocess stderr, remote URLs, headers, credential helpers or env.
    require(result.returncode == 0, f"Git {arguments[0]} failed (exit {result.returncode}); sensitive command output was not logged.")
    try:
        return result.stdout.decode("utf-8").strip()
    except UnicodeDecodeError as error:
        raise TransferError("Git returned unexpected binary output.") from error


def verify_local_objects(directory: Path, manifest: dict, pack: Path) -> Path:
    require(not any(os.environ.get(key) for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES")), "Explicit Git directory/object overrides are not allowed.")
    repository = Path(git(directory, "rev-parse", "--show-toplevel")).resolve()
    require(directory.is_relative_to(repository), "Helper must run from within the intended checkout.")
    require(git(repository, "rev-parse", "--show-object-format") == "sha1", "Unexpected Git object format.")
    require(git(repository, "cat-file", "-t", manifest["baseCommit"]) == "commit", "Base commit must already exist in this checkout.")
    with pack.open("rb") as stream:
        git(repository, "index-pack", "--stdin", "--strict", stdin=stream)
    target = manifest["targetCommit"]
    require(git(repository, "cat-file", "-t", target) == "commit", "Target object is not a commit.")
    require(git(repository, "rev-parse", f"{target}^{{tree}}") == manifest["targetTree"], "Target tree does not match the manifest.")
    require(git(repository, "rev-list", "--parents", "-n", "1", target).split() == [target, manifest["baseCommit"]], "Target must have the stated base as its single direct parent.")
    git(repository, "merge-base", "--is-ancestor", manifest["baseCommit"], target)
    return repository


def verify_remote_identity(repository: Path, manifest: dict) -> None:
    context = os.environ.get("GITHUB_REPOSITORY")
    require(context is None or context == ALLOWED_REPOSITORY, "Workflow repository context does not match the allowed repository.")
    push_urls = git(repository, "remote", "get-url", "--all", "--push", "origin").splitlines()
    require(len(push_urls) == 1, "Origin must have exactly one push destination.")
    url = urlsplit(push_urls[0])
    path = url.path.removesuffix(".git")
    require(url.scheme == "https" and url.netloc.lower() == "github.com" and url.username is None and url.password is None and not url.query and not url.fragment and path.lower() == "/" + ALLOWED_REPOSITORY.lower(), "Origin push destination does not match the allowed repository.")
    # Check fetch/ls-remote destination too; a separate pushurl must not mask it.
    fetch_urls = git(repository, "remote", "get-url", "--all", "origin").splitlines()
    require(len(fetch_urls) == 1, "Origin must have exactly one read destination.")
    fetch_url = urlsplit(fetch_urls[0])
    fetch_path = fetch_url.path.removesuffix(".git")
    require(fetch_url.scheme == "https" and fetch_url.netloc.lower() == "github.com" and fetch_url.username is None and fetch_url.password is None and not fetch_url.query and not fetch_url.fragment and fetch_path.lower() == "/" + ALLOWED_REPOSITORY.lower(), "Origin read destination does not match the allowed repository.")


def remote_head(repository: Path, target_ref: str) -> str:
    lines = git(repository, "ls-remote", "--refs", "--exit-code", "origin", target_ref).splitlines()
    require(len(lines) == 1, "Expected exactly one existing target ref.")
    fields = lines[0].split()
    require(len(fields) == 2 and SHA1.fullmatch(fields[0]) is not None and fields[1] == target_ref, "Unexpected remote ref response.")
    return fields[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true", help="Verify/import local objects without any network or ref write.")
    arguments = parser.parse_args()
    directory = Path(__file__).resolve().parent
    manifest = load_manifest(directory)
    with tempfile.TemporaryDirectory(prefix=".restore-", dir=directory) as temporary:
        pack = Path(temporary) / "transport.pack"
        restore_pack(directory, manifest, pack)
        repository = verify_local_objects(directory, manifest, pack)
    if arguments.verify_only:
        status = "verified-locally-no-network-no-ref-write"
    else:
        verify_remote_identity(repository, manifest)
        before = remote_head(repository, manifest["targetRef"])
        require(before in {manifest["baseCommit"], manifest["targetCommit"]}, "Remote target moved; refusing to overwrite or force it.")
        if before == manifest["targetCommit"]:
            status = "already-at-target"
        else:
            # No force, no lease/overwrite mode, no local ref update, no checkout.
            # Git's normal fast-forward check also rejects a conflicting remote race.
            git(repository, "push", "--no-force", "--no-mirror", "--no-follow-tags", "--porcelain", "origin", f"{manifest['targetCommit']}:{manifest['targetRef']}")
            require(remote_head(repository, manifest["targetRef"]) == manifest["targetCommit"], "Remote verification after push did not match target.")
            status = "published-fast-forward"
    print(json.dumps({"status": status, "repository": ALLOWED_REPOSITORY, "targetRef": ALLOWED_REF, "targetCommit": manifest["targetCommit"], "targetTree": manifest["targetTree"], "packSha256": manifest["packSha256"], "packBytes": manifest["packBytes"], "parts": len(manifest["parts"])}, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except TransferError as error:
        print(f"Transfer refused: {error}", file=sys.stderr)
        sys.exit(1)
