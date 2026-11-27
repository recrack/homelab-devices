import tempfile
import unittest
from pathlib import Path

from research import candidate, canonical, dc_rows, new_candidates, reviewed_rows
from sync_kt_panel import archive_files, source_paths, validate_notice


class ResearchTests(unittest.TestCase):
    def test_dc_addresses_and_search_result_deduplicate(self):
        html = """<tr class="ub-content us-post" data-no="123">
        <td class="gall_subject">일반</td>
        <td class="gall_tit ub-word"><a href="/example"><em></em>토스 프론트 &amp; HA</a></td>
        <td class="gall_date" title="2026-11-20 18:02:12">11.20</td></tr>"""
        self.assertEqual(list(dc_rows(html)), [("123", "토스 프론트 & HA", "2026-11-20")])
        desktop = "https://gall.dcinside.com/mgallery/board/view/?id=sff&no=123&page=1"
        mobile = "https://m.dcinside.com/board/sff/123?recommend=1"
        items = [candidate("DC SFF", "토스 프론트", url) for url in (desktop, mobile)]
        self.assertEqual(canonical(desktop), canonical(mobile))
        self.assertEqual(len(new_candidates(items, set())), 1)
        self.assertEqual(new_candidates(items, {canonical(desktop)}), [])

    def test_repository_and_release_have_different_identities(self):
        self.assertEqual(
            canonical("https://github.com/Owner/Project/blob/main/README.md"),
            "https://github.com/owner/project",
        )
        self.assertEqual(
            canonical("https://github.com/Owner/Project/releases/tag/v1.0"),
            "https://github.com/owner/project/releases/tag/v1.0",
        )
        self.assertEqual(canonical("https://m.cafe.naver.com/stsmarthome/123?from=search"),
                         "https://cafe.naver.com/stsmarthome/123")
        self.assertIsNone(canonical("https://github.com.example.com/owner/project"))

    def test_model_must_cite_collected_evidence(self):
        item = candidate("DC SFF", "토스 프론트", "https://m.dcinside.com/board/sff/123",
                         "PLF02WH에서 USB 마우스가 동작했습니다.")
        row = {
            "id": 1, "model": "PLF02WH", "finding": "작성자는 USB 마우스가 동작했다고 보고했습니다.",
            "support": item["evidence"], "limits": "다른 펌웨어에서는 확인되지 않았습니다.",
        }
        self.assertEqual(len(reviewed_rows([item], [row, row])), 1)
        self.assertEqual(reviewed_rows([item], [{**row, "support": "다른 기기에서 작동했습니다."}]), [])
        self.assertEqual(reviewed_rows([item], [{**row, "id": 2}]), [])


class SyncTests(unittest.TestCase):
    def test_rejects_symlinks_and_changed_license(self):
        with self.assertRaisesRegex(ValueError, "Unexpected upstream file type"):
            source_paths(b"120000 blob deadbeef\tpanel/source.mjs\0")
        with self.assertRaisesRegex(ValueError, "Unexpected upstream path"):
            source_paths(b"100644 blob deadbeef\tpanel/../bad.mjs\0")
        with self.assertRaisesRegex(ValueError, "LICENSE changed"):
            validate_notice("LICENSE", b"changed terms")

    def test_snapshot_excludes_local_settings_and_build_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for path in ("panel/index.html", "runtime/setup.json", "panel/node_modules/pkg/index.js", "panel/dist/index.html"):
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.touch()
            self.assertEqual(archive_files(root), {Path("panel/index.html")})


if __name__ == "__main__":
    unittest.main()
