import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from research import create_pr, gh, note


PROJECT = "dasjjl-svg/KT_TABLE_TV"
ORIGIN = f"https://github.com/{PROJECT}"
REF = "refs/heads/main"
DESTINATION = Path("upstream/kt-table-tv")
NOTICES = {
    "LICENSE": "069387460fd8c3810bb4b7a725c32a69909335b0182cab68402524b4d3d5c7c0",
    "THIRD_PARTY_NOTICES.md": "8083eb2624531b1b48022a25280430ea5af5fac5c2e3f3e6443fcbe71e2bef8f",
}
SOURCE_FILE = re.compile(r"panel/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.(?:css|html|js|json|jsx|mjs)")
SETUP_FILES = {"scripts/setup.mjs", "scripts/host-check.mjs"}
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
LOCAL_FOLDERS = {Path("runtime"), Path("panel/node_modules"), Path("panel/dist")}


def git(*args, cwd=None, binary=False):
    return subprocess.run(["git", *args], cwd=cwd, check=True, stdout=subprocess.PIPE, text=not binary).stdout


def source_paths(entries):
    paths = []
    for entry in entries.split(b"\0"):
        if not entry:
            continue
        info, raw_path = entry.split(b"\t", 1)
        mode, kind, _ = info.split()
        path = raw_path.decode("utf-8")
        if mode not in {b"100644", b"100755"} or kind != b"blob":
            raise ValueError(f"Unexpected upstream file type: {path}")
        if path not in NOTICES and path not in SETUP_FILES and not SOURCE_FILE.fullmatch(path):
            raise ValueError(f"Unexpected upstream path: {path}")
        paths.append(path)
    required = set(NOTICES) | SETUP_FILES | {"panel/package.json", "panel/package-lock.json", "panel/server/index.mjs"}
    if not required <= set(paths):
        raise ValueError("Upstream archive is missing the license, notices, or panel entry point")
    return paths


def validate_notice(path, content):
    if hashlib.sha256(content).hexdigest() != NOTICES[path]:
        raise ValueError(f"{path} changed upstream. Review the new terms before syncing.")


def snapshot(checkout, staging):
    git("init", "--quiet", cwd=checkout)
    git("fetch", "--quiet", "--depth=1", "--no-tags", ORIGIN + ".git", REF, cwd=checkout)
    commit = git("rev-parse", "FETCH_HEAD", cwd=checkout).strip()
    paths = source_paths(git(
        "ls-tree", "-r", "-z", commit, "--", "panel", *sorted(SETUP_FILES), *NOTICES, cwd=checkout, binary=True,
    ))
    total_bytes = 0
    for path in paths:
        data = git("cat-file", "blob", f"{commit}:{path}", cwd=checkout, binary=True)
        if path in NOTICES:
            validate_notice(path, data)
        total_bytes += len(data)
        if total_bytes > 2_000_000 or b"\0" in data or data.startswith(b"version https://git-lfs.github.com/spec/"):
            raise ValueError(f"Unexpected large or binary content: {path}")
        data.decode("utf-8")
        destination = staging / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    record = {"origin": ORIGIN, "ref": REF, "commit": commit, "license": "MIT", "license_sha256": NOTICES}
    (staging / "UPSTREAM.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return commit


def archive_files(root):
    result = set()
    for path, directories, files in os.walk(root):
        relative = Path(path).relative_to(root)
        directories[:] = [name for name in directories if relative / name not in LOCAL_FOLDERS]
        result.update(relative / name for name in files)
    return result


def matches(staging):
    archived = archive_files(DESTINATION)
    expected = archive_files(staging)
    if archived != expected:
        return False
    record = json.loads((DESTINATION / "UPSTREAM.json").read_text(encoding="utf-8"))
    current = json.loads((staging / "UPSTREAM.json").read_text(encoding="utf-8"))
    if {**record, "commit": current["commit"]} != current:
        return False
    return all((DESTINATION / path).read_bytes() == (staging / path).read_bytes()
               for path in expected - {Path("UPSTREAM.json")})


def publish(commit):
    repo = os.environ["GITHUB_REPOSITORY"]
    branch = f"sync/kt-table-tv-{commit[:12]}"
    base = git("rev-parse", "HEAD").strip()
    git("switch", "-c", branch)
    git("add", "-A", "--", str(DESTINATION))
    git("-c", "user.name=github-actions[bot]", "-c", f"user.email={BOT_EMAIL}",
        "commit", "-m", f"Sync KT Table TV panel at {commit[:12]}")
    head = git("rev-parse", "HEAD").strip()
    remote = git("ls-remote", "--heads", "origin", f"refs/heads/{branch}").strip()
    if remote:
        git("fetch", "origin", branch)
        head = git("rev-parse", "FETCH_HEAD").strip()
        git("diff", "--exit-code", head, "HEAD")
    changed = git("diff", "--name-only", f"{base}...{head}").splitlines()
    if not changed or any(not path.startswith(f"{DESTINATION}/") for path in changed):
        raise ValueError("Sync PR must contain only the approved archive")
    if not remote:
        git("push", "origin", f"HEAD:refs/heads/{branch}")

    prs = json.loads(gh("pr", "list", "--repo", repo, "--head", branch, "--state", "all",
                        "--json", "url,state,headRefOid,isDraft,baseRefName", "--limit", "1"))
    if prs:
        pr = prs[0]
        if pr["state"] != "OPEN" or pr["isDraft"] or pr["headRefOid"] != head or pr["baseRefName"] != "main":
            raise ValueError("Existing sync PR was changed or closed. It needs review.")
        url = pr["url"]
    else:
        body = (
            f"## Summary\n\n\x60{DESTINATION}/\x60의 패널과 PC 설정 소스를 갱신합니다. "
            f"[원본 커밋]({ORIGIN}/commit/{commit})\n\n"
            "## Evidence\n\n"
            "- **이전** · 기존 아카이브와 원본 파일에 차이가 있습니다.\n"
            "- **이후** · 원본 파일 경로와 파일 유형을 확인하고 MIT 라이선스와 제3자 고지의 SHA-256을 대조했습니다.\n\n"
            "## Merge Danger\n\nGit에서 되돌릴 수 있습니다. 변경 범위는 KT 패널 아카이브입니다.\n"
        )
        url = create_pr(repo, branch, f"[Sync] KT Table TV 패널 {commit[:12]}", body)
    note(f"소스 동기화 PR · {url}")
    gh("pr", "merge", url, "--squash", "--match-head-commit", head)
    note(f"소스 동기화 병합 완료 · {url}")


def main():
    parser = argparse.ArgumentParser(description="Preserve the approved KT Table TV panel snapshot.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Validate upstream and show whether the archive would change.")
    mode.add_argument("--publish", action="store_true", help="Open and merge an archive-only PR in GitHub Actions.")
    args = parser.parse_args()
    if args.publish and (os.getenv("GITHUB_ACTIONS") != "true" or os.getenv("GITHUB_REF") != "refs/heads/main"):
        parser.error("--publish requires GitHub Actions on main")
    if not args.check and git("status", "--porcelain", "--", str(DESTINATION)):
        parser.error(f"{DESTINATION} has local changes. Commit or move them before syncing.")
    with tempfile.TemporaryDirectory(prefix="homelab-sync-") as directory:
        staging = Path(directory) / "snapshot"
        checkout = Path(directory) / "git"
        checkout.mkdir()
        commit = snapshot(checkout, staging)
        if matches(staging):
            note(f"KT Table TV 패널 · 소스와 라이선스 변경 없음 ({commit[:12]})")
            return
        note(f"KT Table TV 패널 · 보존할 새 스냅샷 {ORIGIN}/commit/{commit}")
        if args.check:
            return
        for path in archive_files(DESTINATION) - archive_files(staging):
            (DESTINATION / path).unlink()
        shutil.copytree(staging, DESTINATION, dirs_exist_ok=True)
    if args.publish:
        publish(commit)


if __name__ == "__main__":
    main()
