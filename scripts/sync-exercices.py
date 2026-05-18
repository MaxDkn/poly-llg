#!/usr/bin/env python3
"""
Valide data.yml et merge les exercices dans data/exercices.yml.

Usage:
  python3 scripts/sync-exercices.py          # valide + aperçu
  python3 scripts/sync-exercices.py --merge  # valide + merge
  python3 scripts/sync-exercices.py --check  # valide seulement
"""

import sys
import yaml
import argparse
from pathlib import Path

ROOT = Path(__file__).parent.parent
SOURCE = ROOT / "data.yml"
TARGET = ROOT / "data" / "exercices.yml"

VALID_LEVELS = {1, 2, 3, 4, 5}


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def validate(data: dict) -> list[str]:
    errors = []

    if not isinstance(data, dict) or "exercices" not in data:
        return ["Le fichier doit avoir une clé racine 'exercices'"]

    exercices = data["exercices"]
    if not isinstance(exercices, list):
        return ["'exercices' doit être une liste"]

    seen_nums = {}

    for i, ex in enumerate(exercices):
        prefix = f"Exercice #{i + 1}"

        if not isinstance(ex, dict):
            errors.append(f"{prefix}: doit être un dict, reçu {type(ex).__name__}")
            continue

        # num
        if "num" not in ex:
            errors.append(f"{prefix}: champ 'num' manquant")
        elif not isinstance(ex["num"], int) or ex["num"] <= 0:
            errors.append(f"{prefix}: 'num' doit être un entier positif (reçu {ex['num']!r})")
        else:
            n = ex["num"]
            if n in seen_nums:
                errors.append(f"{prefix}: num={n} en doublon avec l'exercice #{seen_nums[n] + 1}")
            else:
                seen_nums[n] = i

        # level
        if "level" not in ex:
            errors.append(f"{prefix} (num={ex.get('num', '?')}): champ 'level' manquant")
        elif ex["level"] not in VALID_LEVELS:
            errors.append(
                f"{prefix} (num={ex.get('num', '?')}): 'level' doit être dans {sorted(VALID_LEVELS)}, reçu {ex['level']!r}"
            )

        # content
        if "content" not in ex:
            errors.append(f"{prefix} (num={ex.get('num', '?')}): champ 'content' manquant")
        elif not isinstance(ex["content"], str) or not ex["content"].strip():
            errors.append(f"{prefix} (num={ex.get('num', '?')}): 'content' doit être une chaîne non vide")

        # champs inconnus
        known = {"num", "level", "content"}
        extra = set(ex.keys()) - known
        if extra:
            errors.append(
                f"{prefix} (num={ex.get('num', '?')}): champs inconnus : {', '.join(sorted(extra))}"
            )

    return errors


def find_missing(nums: list[int]) -> list[int]:
    if not nums:
        return []
    full = set(range(1, max(nums) + 1))
    return sorted(full - set(nums))


def format_ranges(nums: list[int]) -> str:
    if not nums:
        return ""
    parts = []
    start = nums[0]
    end = nums[0]
    for n in nums[1:]:
        if n == end + 1:
            end = n
        else:
            parts.append(f"{start}-{end}" if end - start >= 1 else str(start))
            start = end = n
    parts.append(f"{start}-{end}" if end - start >= 1 else str(start))
    return ", ".join(parts)


def merge(source_exs: list[dict], target_exs: list[dict]) -> tuple[list[dict], list[int]]:
    existing_nums = {ex["num"] for ex in target_exs}
    new_exs = [ex for ex in source_exs if ex["num"] not in existing_nums]
    merged = sorted(target_exs + new_exs, key=lambda e: e["num"])
    return merged, [ex["num"] for ex in new_exs]


def dump_yaml(data: dict, path: Path) -> None:
    class IndentedDumper(yaml.Dumper):
        pass

    def str_representer(dumper, data):
        if "\n" in data:
            return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
        return dumper.represent_scalar("tag:yaml.org,2002:str", data)

    IndentedDumper.add_representer(str, str_representer)

    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(
            data,
            f,
            Dumper=IndentedDumper,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--merge", action="store_true", help="merge dans data/exercices.yml après validation")
    group.add_argument("--check", action="store_true", help="validation seulement, sans merge")
    args = parser.parse_args()

    # --- Validation ---
    print(f"Validation de {SOURCE.relative_to(ROOT)} ...\n")
    try:
        source_data = load_yaml(SOURCE)
    except yaml.YAMLError as e:
        print(f"ERREUR YAML : {e}")
        sys.exit(1)

    errors = validate(source_data)

    if errors:
        print(f"  {len(errors)} erreur(s) trouvée(s) :\n")
        for err in errors:
            print(f"  ✗ {err}")
        sys.exit(1)

    source_exs = source_data["exercices"]
    print(f"  ✓ {len(source_exs)} exercices valides\n")

    nums = sorted(ex["num"] for ex in source_exs if isinstance(ex.get("num"), int))
    missing = find_missing(nums)
    if missing:
        print(f"  Exercices manquants ({len(missing)}) : {format_ranges(missing)}\n")
    else:
        print(f"  Aucun exercice manquant (1 → {max(nums)})\n")

    if args.check:
        return

    # --- Merge preview / apply ---
    try:
        target_data = load_yaml(TARGET)
        target_exs = target_data.get("exercices", []) or []
    except FileNotFoundError:
        target_exs = []

    merged_exs, added_nums = merge(source_exs, target_exs)

    if not added_nums:
        print(f"  data/exercices.yml est déjà à jour ({len(target_exs)} exercices).")
        return

    print(f"  {len(added_nums)} nouvel(aux) exercice(s) à ajouter : nums {added_nums}\n")

    if not args.merge:
        print("  (lancez avec --merge pour appliquer)")
        return

    dump_yaml({"exercices": merged_exs}, TARGET)
    print(f"  ✓ data/exercices.yml mis à jour → {len(merged_exs)} exercices au total")


if __name__ == "__main__":
    main()
