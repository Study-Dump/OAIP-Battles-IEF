"""Прогон тестов одной команды.

Тест — каталог с input.txt и expected_output.txt. Решение запускается в пустом
временном каталоге, куда кладётся input.txt; ответ берётся из output.txt, а если
файл не создан — из stdout. Содержимое input.txt также подаётся на stdin.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

from compare import compare_outputs

TIMEOUT_SEC = 5
OUTPUT_LIMIT = 5000
STDERR_LIMIT = 2000


def _read(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def collect_tests(tests_dir, author_prefix):
    if not os.path.isdir(tests_dir):
        return []
    tests = []
    for name in sorted(os.listdir(tests_dir)):
        path = os.path.join(tests_dir, name)
        if os.path.isdir(path) and name.startswith(author_prefix + "_"):
            tests.append((name, path))
    return tests


def run_test(solution, test_dir, timeout_sec=TIMEOUT_SEC):
    input_path = os.path.join(test_dir, "input.txt")
    expected_path = os.path.join(test_dir, "expected_output.txt")
    if not (os.path.isfile(input_path) and os.path.isfile(expected_path)):
        return {"skipped": True, "reason": "missing input.txt or expected_output.txt"}

    input_content = _read(input_path)
    expected = _read(expected_path)
    base = {
        "skipped": False,
        "input": input_content[:OUTPUT_LIMIT],
        "expected_output": expected[:OUTPUT_LIMIT],
    }

    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, "input.txt"), "w", encoding="utf-8") as f:
            f.write(input_content)

        start = time.perf_counter()
        try:
            proc = subprocess.run(
                [os.path.abspath(solution)],
                cwd=tmp,
                input=input_content,
                text=True,
                capture_output=True,
                timeout=timeout_sec,
            )
            elapsed = time.perf_counter() - start
        except subprocess.TimeoutExpired:
            return {
                **base,
                "passed": False,
                "reason": "timeout",
                "time_sec": timeout_sec,
                "actual_output": "",
            }
        except OSError as exc:
            return {
                **base,
                "passed": False,
                "reason": "runtime_error",
                "time_sec": 0,
                "actual_output": "",
                "stderr": str(exc)[:STDERR_LIMIT],
            }

        output_path = os.path.join(tmp, "output.txt")
        actual = _read(output_path) if os.path.isfile(output_path) else proc.stdout

        result = {
            **base,
            "time_sec": round(elapsed, 4),
            "actual_output": actual[:OUTPUT_LIMIT],
        }

        if proc.returncode != 0:
            result.update(
                {
                    "passed": False,
                    "reason": "runtime_error",
                    "exit_code": proc.returncode,
                    "stderr": proc.stderr[:STDERR_LIMIT],
                }
            )
            return result

        passed, diff = compare_outputs(actual, expected)
        result.update(
            {"passed": passed, "reason": "ok" if passed else "output_mismatch"}
        )
        if diff:
            result["diff"] = diff
        return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--solution", required=True)
    parser.add_argument("--tests-dir", required=True)
    parser.add_argument("--author-prefix", required=True, help="например 04 для team4")
    parser.add_argument("--team", required=True)
    parser.add_argument("--opponent", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    if (args.author_prefix.lstrip("0") or "0") == (args.team.lstrip("0") or "0"):
        print(
            f"warning: team{args.team} cannot attack itself; tests skipped",
            file=sys.stderr,
        )
        tests = []
    else:
        tests = []
        for name, path in collect_tests(args.tests_dir, args.author_prefix):
            result = run_test(args.solution, path)
            result.update({"author": args.opponent, "name": name, "path": path})
            tests.append(result)

    passed = sum(1 for t in tests if t.get("passed"))
    total = sum(1 for t in tests if not t.get("skipped"))

    data = {
        "team": args.team,
        "attacked_by": args.opponent,
        "tests": tests,
        "passed": passed,
        "total": total,
    }
    if total == 0:
        data["note"] = "no tests from opponent"

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"team{args.team} (attacked by team{args.opponent}): {passed}/{total} passed")


if __name__ == "__main__":
    main()
