__all__ = [
    "generate_pattern_candidates",
    "run_deterministic_check",
    "run_llm_judge",
    "run_checkin_pipeline",
    "generate_report",
    "run_report_judge",
    "run_report_pipeline",
]


def __getattr__(name):
    if name == "generate_pattern_candidates":
        from .checkin_writer import generate_pattern_candidates
        return generate_pattern_candidates
    if name == "run_deterministic_check":
        from .deterministic_check import run_deterministic_check
        return run_deterministic_check
    if name == "run_llm_judge":
        from .llm_judge import run_llm_judge
        return run_llm_judge
    if name == "run_checkin_pipeline":
        from .checkin_pipeline import run_checkin_pipeline
        return run_checkin_pipeline
    if name == "generate_report":
        from .report_writer import generate_report
        return generate_report
    if name == "run_report_judge":
        from .report_judge import run_report_judge
        return run_report_judge
    if name == "run_report_pipeline":
        from .report_pipeline import run_report_pipeline
        return run_report_pipeline
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
