#!/usr/bin/env python3
"""Back up the exact delivered rc.6 files to one GitHub branch (no force push)."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

REPO = "https://github.com/YuZhou0311/dsh-academic-ppt.git"
BRANCH = "backup/rc6-20261031"
VERSION = "0.10.0-rc.6"
PREFIX = f"dsh-academic-ppt-{VERSION}/"
EXPECTED = {
    f"dsh-academic-ppt-{VERSION}-source.zip": "b1864c4b539c7d0c3cc8c9e5d8a318c8f93af8be2f5e43f35dfd62ecb31f9565",
    f"dsh-academic-ppt-{VERSION}.tgz": "4b4e0298948a8db40c6ab9d65aca8332c0ed6c074799037f9d201c282a093530",
}
OPTIONAL = {
    "DSH-rc6-验证记录.zip": "4eb4275934a0e5031c927a0300964a2a90378c67685779ffb5be4d2a33e581b7",
}
SOURCE_DIRS = ("src", "bin", "skills", "examples", "docs", "evals", "test", "scripts")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, check=True,
                            stdout=subprocess.PIPE, text=True, encoding="utf-8")
    return result.stdout.strip()


def validated_sources(directory: Path) -> tuple[dict[str, bytes], list[dict]]:
    records = []
    for name, expected in {**EXPECTED, **OPTIONAL}.items():
        path = directory / name
        if name in OPTIONAL and not path.exists():
            continue
        if not path.is_file():
            raise ValueError(f"Missing file: {path}")
        actual = sha256(path)
        if actual != expected:
            raise ValueError(f"SHA-256 mismatch: {name}; do not upload this file.")
        records.append({"name": name, "bytes": path.stat().st_size, "sha256": actual})

    files: dict[str, bytes] = {}
    with zipfile.ZipFile(directory / f"dsh-academic-ppt-{VERSION}-source.zip") as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            if not member.filename.startswith(PREFIX):
                raise ValueError("Unexpected source archive root")
            name = member.filename[len(PREFIX):]
            path = PurePosixPath(name)
            mode = (member.external_attr >> 16) & 0o170000
            if (path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name
                    or not path.parts or path.parts[0] in {".git", "node_modules"}
                    or mode == 0o120000 or name in files):
                raise ValueError(f"Unsafe archive member: {name}")
            if path.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2"}:
                raise ValueError("Font files must not be uploaded")
            files[name] = archive.read(member)
    if len(files) != 782 or json.loads(files["package.json"])["version"] != VERSION:
        raise ValueError("Unexpected rc.6 source snapshot")

    count = 0
    with tarfile.open(directory / f"dsh-academic-ppt-{VERSION}.tgz", "r:gz") as archive:
        for member in archive:
            if not member.isfile():
                continue
            if not member.name.startswith("package/"):
                raise ValueError("Unexpected install archive root")
            name = member.name[len("package/"):]
            content = archive.extractfile(member)
            if content is None or files.get(name) != content.read():
                raise ValueError(f"Installer/source mismatch: {name}")
            count += 1
    if count != 780:
        raise ValueError(f"Unexpected installer file count: {count}")
    return files, records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--files-dir", type=Path, default=Path.cwd(),
                        help="Directory containing the original rc.6 source ZIP and TGZ")
    parser.add_argument("--verify-only", action="store_true",
                        help="Verify local files only; do not contact or write GitHub")
    args = parser.parse_args()
    directory = args.files_dir.expanduser().resolve()
    files, records = validated_sources(directory)
    print("Verified: 782 source files; 780 installer files match byte-for-byte.")
    if args.verify_only:
        print(json.dumps(records, ensure_ascii=False, indent=2))
        return 0
    if shutil.which("git") is None:
        raise ValueError("Git is required. Install Git and use its normal GitHub sign-in.")

    # Work only in a fresh temporary clone; never change the user's working copy.
    work = Path(tempfile.mkdtemp(prefix="dsh-rc6-backup-"))
    checkout = work / "repo"
    print(f"Temporary clone: {checkout}")
    print(f"Target branch only: {BRANCH}; no main changes, tags, or releases.")
    git("clone", "--depth", "1", "--single-branch", "--branch", BRANCH, REPO, str(checkout))
    if git("branch", "--show-current", cwd=checkout) != BRANCH:
        raise ValueError("Unexpected checkout branch")

    for name in SOURCE_DIRS:
        old = checkout / name
        if old.exists():
            shutil.rmtree(old)
    for name, data in files.items():
        destination = checkout / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    backup = checkout / "backups" / VERSION
    backup.mkdir(parents=True, exist_ok=True)
    for item in records:
        shutil.copyfile(directory / item["name"], backup / item["name"])
    manifest = {
        "version": VERSION, "branch": BRANCH,
        "status": "complete-source-and-original-installer",
        "artifacts": records,
        "sourceFiles": [{"path": name, "bytes": len(data),
                         "sha256": hashlib.sha256(data).hexdigest()}
                        for name, data in sorted(files.items())],
        "installerFileCount": 780,
        "scope": "Backup only; no release publication and no new model-quality claim",
    }
    (backup / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (backup / "SHA256SUMS").write_text(
        "".join(f'{item["sha256"]}  {item["name"]}\n' for item in records), encoding="utf-8")
    (checkout / "BACKUP_RC6_STATUS.md").write_text(
        "# rc.6 完整备份已同步\n\n"
        "分支：`backup/rc6-20261031`。根目录为已交付的 0.10.0-rc.6 源码。\n\n"
        "原始源码 ZIP、安装 TGZ、逐文件 manifest.json 与 SHA256SUMS 位于 "
        "`backups/0.10.0-rc.6/`；若提供了原始验证 ZIP，它也存放在该目录。\n\n"
        "源码 782 个文件；安装包 780 个文件均与源码对应文件逐字节一致。"
        "原有 .github 工作流及 Git 忽略文件保留。未修改 main，未创建 tag 或 Release。\n\n"
        "这只是已交付候选版的持久备份，不是新的功能或真实模型质量验收。\n",
        encoding="utf-8")

    # Keep this helper under backups, outside the byte-for-byte source snapshot.
    shutil.copyfile(Path(__file__).resolve(), backup / "sync-rc6-backup.py")
    git("add", "--all", cwd=checkout)
    git("-c", "user.name=DSH Backup", "-c", "user.email=backup@localhost",
        "commit", "-m", "backup: preserve exact rc.6 source and install package [skip ci]",
        cwd=checkout)
    commit = git("rev-parse", "HEAD", cwd=checkout)
    # Normal push only: a concurrent remote update causes refusal, never overwrite.
    git("push", "origin", f"HEAD:refs/heads/{BRANCH}", cwd=checkout)
    remote = git("ls-remote", "--heads", "origin", f"refs/heads/{BRANCH}", cwd=checkout)
    if not remote or remote.split()[0] != commit:
        raise ValueError("Push returned, but remote readback does not match; verify on GitHub.")
    print(f"Backup confirmed on GitHub: {commit}")
    print("https://github.com/YuZhou0311/dsh-academic-ppt/tree/backup/rc6-20261031")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, zipfile.BadZipFile, tarfile.TarError,
            subprocess.CalledProcessError) as exc:
        print(f"Backup did not finish: {exc}", file=sys.stderr)
        raise SystemExit(1)
