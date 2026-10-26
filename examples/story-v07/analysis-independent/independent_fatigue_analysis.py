#!/usr/bin/env python3
"""Rebuild the independent descriptive audit from the two authorized inputs.

Run with TMPDIR set to <repo>/.test-output/tmp and PYTHONDONTWRITEBYTECODE=1.
This script reads only protocol.md and fatigue.csv from the authorized input directory.
The only output is fatigue_summary.json next to this script.
No additional hypothesis tests or model fits are performed.
"""

import argparse
import csv
import hashlib
import io
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from scipy import stats


def summarize(records):
    values = [record["cycles_observed"] for record in records]
    return {
        "n": len(values),
        "failed": sum(record["endpoint"] == "failed" for record in records),
        "runout": sum(record["endpoint"] == "runout" for record in records),
        "mean_observed_cycles": statistics.mean(values),
        "sample_sd_observed_cycles": statistics.stdev(values),
        "median_observed_cycles": statistics.median(values),
        "min_observed_cycles": min(values),
        "max_observed_cycles": max(values),
        "sum_observed_cycles": sum(values),
    }


def main():
    output_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=output_dir.parent / "sources")
    input_dir = parser.parse_args().input_dir.resolve()
    csv_path = input_dir / "fatigue.csv"
    protocol_path = input_dir / "protocol.md"
    csv_bytes = csv_path.read_bytes()
    protocol_bytes = protocol_path.read_bytes()
    records = list(csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig"))))
    for record in records:
        record["cycles_observed"] = int(record["cycles_observed"])
        record["stress_MPa"] = int(record["stress_MPa"])

    grouped = defaultdict(list)
    for record in records:
        key = (record["batch"], record["process"], record["stress_MPa"])
        grouped[key].append(record)
    group_summaries = [
        {"batch": batch, "process": process, "stress_MPa": stress, **summarize(group)}
        for (batch, process, stress), group in sorted(grouped.items())
    ]

    pooled = {}
    for label, predicate in [
        ("all_stresses", lambda record: True),
        ("200_MPa_only", lambda record: record["stress_MPa"] == 200),
    ]:
        process_summaries = {
            process: summarize([
                record for record in records
                if predicate(record) and record["process"] == process
            ])
            for process in ["conventional", "modified"]
        }
        conventional_mean = process_summaries["conventional"]["mean_observed_cycles"]
        modified_mean = process_summaries["modified"]["mean_observed_cycles"]
        difference = modified_mean - conventional_mean
        pooled[label] = {
            "processes": process_summaries,
            "modified_minus_conventional_observed_mean_cycles": difference,
            "relative_observed_mean_difference_percent": 100 * difference / conventional_mean,
            "causal_interpretation": False,
        }

    a_conventional = summarize(grouped[("A", "conventional", 200)])
    b_conventional = summarize(grouped[("B", "conventional", 200)])
    b_modified = summarize(grouped[("B", "modified", 200)])
    batch_difference = (
        b_conventional["mean_observed_cycles"] - a_conventional["mean_observed_cycles"]
    )

    n_con = b_conventional["n"]
    n_mod = b_modified["n"]
    variance_con = statistics.variance([
        record["cycles_observed"] for record in grouped[("B", "conventional", 200)]
    ])
    variance_mod = statistics.variance([
        record["cycles_observed"] for record in grouped[("B", "modified", 200)]
    ])
    mean_difference = b_modified["mean_observed_cycles"] - b_conventional["mean_observed_cycles"]
    variance_of_difference = variance_con / n_con + variance_mod / n_mod
    standard_error = math.sqrt(variance_of_difference)
    degrees_of_freedom = variance_of_difference ** 2 / (
        (variance_con / n_con) ** 2 / (n_con - 1)
        + (variance_mod / n_mod) ** 2 / (n_mod - 1)
    )
    alpha = 0.05
    t_critical = float(stats.t.ppf(1 - alpha / 2, degrees_of_freedom))
    half_width = t_critical * standard_error

    result = {
        "identity": "教学模拟数据；不对应真实实验、机构、项目或论文",
        "sources": {
            "protocol_path": str(protocol_path),
            "protocol_sha256": hashlib.sha256(protocol_bytes).hexdigest(),
            "csv_path": str(csv_path),
            "csv_sha256": hashlib.sha256(csv_bytes).hexdigest(),
        },
        "definitions": {
            "unit": "cycles",
            "sd": "sample standard deviation; denominator n - 1",
            "runout": "administrative right censoring at 500000 cycles; not an observed failure",
            "observed_time_mean": (
                "Mean of cycles_observed. With only a common administrative cutoff at 500000, "
                "this is the empirical mean of min(T, 500000), not the unrestricted mean failure lifetime."
            ),
        },
        "record_count": len(records),
        "unique_specimen_ids": len({record["specimen_id"] for record in records}),
        "endpoint_counts": dict(Counter(record["endpoint"] for record in records)),
        "group_summaries": group_summaries,
        "runout_records": [record for record in records if record["endpoint"] == "runout"],
        "pooled_observed_time_summaries_not_causal": pooled,
        "conventional_A_B_comparison_at_200_MPa": {
            "A": a_conventional,
            "B": b_conventional,
            "B_minus_A_mean_cycles": batch_difference,
            "relative_to_A_percent": 100 * batch_difference / a_conventional["mean_observed_cycles"],
            "interpretation": "Descriptive batch-associated difference; no random cross-batch allocation.",
        },
        "B_200_MPa_Welch_mean_difference_interval": {
            "contrast": "modified minus conventional",
            "n_conventional": n_con,
            "n_modified": n_mod,
            "sample_variance_conventional": variance_con,
            "sample_variance_modified": variance_mod,
            "mean_difference_cycles": mean_difference,
            "relative_mean_difference_percent": 100 * mean_difference / b_conventional["mean_observed_cycles"],
            "standard_error_cycles": standard_error,
            "welch_satterthwaite_df": degrees_of_freedom,
            "alpha_two_sided": alpha,
            "t_critical": t_critical,
            "half_width_cycles": half_width,
            "confidence_interval_cycles": [mean_difference - half_width, mean_difference + half_width],
            "limitations": [
                "Both groups have 12 independent specimens and all observed failures; no censoring in B.",
                "Approximate raw-scale mean inference under distributional and sampling assumptions.",
                "No randomized process allocation; the interval does not quantify confounding or selection bias.",
                "A confidence interval containing zero establishes neither equality nor a useful benefit.",
            ],
        },
    }
    output_path = output_dir / "fatigue_summary.json"
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(output_path))
    print(json.dumps({
        "mean_difference_cycles": mean_difference,
        "confidence_interval_cycles": result["B_200_MPa_Welch_mean_difference_interval"]["confidence_interval_cycles"],
        "B_minus_A_conventional_mean_cycles": batch_difference,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
