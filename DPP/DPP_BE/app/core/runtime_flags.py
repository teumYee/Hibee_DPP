import os


def _env_flag(name: str, default: str = "0") -> bool:
    value = str(os.getenv(name, default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


DEV_RELAXED_MODE = _env_flag("APP_DEV_MODE", "0")
