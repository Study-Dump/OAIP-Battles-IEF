"""Объединяет результаты двух команд и обновляет results.json / history.json."""

import argparse
import json
import os
from datetime import datetime, timezone


def score(team):
    """(доля пройденных, -среднее время). Больше — лучше."""
    if team["total"] == 0:
        return (-1.0, 0.0)
    tests = [t for t in team["tests"] if not t.get("skipped")]
    avg = sum(t["time_sec"] for t in tests) / team["total"]
    return (team["passed"] / team["total"], -avg)


def load_history(path):
    try:
        with open(path, encoding="utf-8") as f:
            history = json.load(f)
        if isinstance(history, dict) and isinstance(history.get("battles"), list):
            return history
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return {"battles": []}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--a", required=True)
    parser.add_argument("--b", required=True)
    parser.add_argument("--battle", required=True)
    parser.add_argument("--out", default="site/results.json")
    args = parser.parse_args()

    with open(args.a, encoding="utf-8") as f:
        team_a = json.load(f)
    with open(args.b, encoding="utf-8") as f:
        team_b = json.load(f)

    sa, sb = score(team_a), score(team_b)
    if sa > sb:
        winner = team_a["team"]
    elif sb > sa:
        winner = team_b["team"]
    else:
        winner = None

    now = datetime.now(timezone.utc)
    entry = {
        "id": f"{args.battle.replace('/', '-')}-{now.strftime('%Y%m%dT%H%M%S%fZ')}",
        "battle": args.battle,
        "timestamp": now.isoformat(),
        "winner": winner,
        "teams": [team_a, team_b],
    }

    site_dir = os.path.dirname(args.out) or "."
    os.makedirs(site_dir, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(entry, f, indent=2, ensure_ascii=False)

    history_path = os.path.join(site_dir, "history.json")
    history = load_history(history_path)
    history["battles"].append(entry)
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

    print(f"{args.battle}: winner = {winner or 'draw'}")


if __name__ == "__main__":
    main()
