"""Сравнение вывода решения с эталоном.

Числа сравниваются с допуском EPS (абсолютная разница), остальные токены —
как строки. Пробелы и переводы строк нормализуются, порядок строк важен.
"""

import math

EPS = 1e-6


def normalize_line(line):
    return line.replace("\r", "").rstrip()


def _as_float(token):
    try:
        return float(token)
    except ValueError:
        return None


def line_matches(actual_line, expected_line):
    a_tokens = actual_line.split()
    e_tokens = expected_line.split()
    if len(a_tokens) != len(e_tokens):
        return False

    for a, e in zip(a_tokens, e_tokens):
        a_num, e_num = _as_float(a), _as_float(e)
        if a_num is not None and e_num is not None:
            if math.isnan(a_num) or math.isnan(e_num):
                return False
            if abs(a_num - e_num) > EPS:
                return False
        elif a != e:
            return False
    return True


def compare_outputs(actual, expected):
    """Возвращает (passed, diff). diff — None при совпадении."""
    a_lines = [normalize_line(line) for line in actual.splitlines()]
    e_lines = [normalize_line(line) for line in expected.splitlines()]

    for i, (a, e) in enumerate(zip(a_lines, e_lines)):
        if not line_matches(a, e):
            return False, {
                "first_diff_line": i + 1,
                "actual_line": a,
                "expected_line": e,
            }

    if len(a_lines) != len(e_lines):
        line = min(len(a_lines), len(e_lines))
        return False, {
            "first_diff_line": line + 1,
            "actual_line": a_lines[line] if line < len(a_lines) else "",
            "expected_line": e_lines[line] if line < len(e_lines) else "",
        }

    return True, None


if __name__ == "__main__":
    assert compare_outputs("1 2\n", "1.0000001 2")[0]
    assert compare_outputs("0.5\n", "5e-1\n")[0]
    assert not compare_outputs("1 2", "1 3")[0]
    assert not compare_outputs("1 2 3", "1 2")[0]
    assert not compare_outputs("nan", "1")[0]
    bad, diff = compare_outputs("a b", "a c")
    assert bad is False and diff["first_diff_line"] == 1
    assert diff["actual_line"] == "a b"
    print("compare.py self-check OK")
