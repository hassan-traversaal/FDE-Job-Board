"""Logs that are safe to keep.

uvicorn's access log prints each request with its query string, and two kinds
of request carry a Clerk session token there (?__clerk_token=, auth.TOKEN_PARAM):
the bot's EventSource and the <video> source, neither of which can send a
header. Locally that log is a terminal; deployed, the platform keeps it. This
filter blanks the token in every record before a handler formats it, so the
"never logged" promise in auth.py holds there too.
"""
from __future__ import annotations

import logging
import re

from .auth import TOKEN_PARAM

_TOKEN_RE = re.compile(rf"({re.escape(TOKEN_PARAM)}=)[^&\s\"']+")


def redact(text: str) -> str:
    return _TOKEN_RE.sub(r"\1[redacted]", text)


class RedactTokens(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(a) if isinstance(a, str) else a for a in record.args)
        return True


def install() -> None:
    """On the loggers that see request lines. A logger's filters survive
    uvicorn's own logging setup, whichever order the two run in."""
    for name in ("uvicorn.access", "uvicorn.error"):
        logging.getLogger(name).addFilter(RedactTokens())
