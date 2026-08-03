"""Workarounds needed to run gltest's direct-mode fixtures on Windows."""

import os

_original_unlink = os.unlink


def _safe_unlink(path, *args, **kwargs):
    try:
        _original_unlink(path, *args, **kwargs)
    except PermissionError:
        # gltest's direct-mode loader injects the VM message via a temp
        # file duped onto fd 0, then unlinks it while the dup is still
        # open. On Windows that unlink fails with WinError 32. The dup'd
        # handle is closed right after by the same code path, so leaving
        # the file behind (OS temp cleanup handles it eventually) is safe.
        pass


os.unlink = _safe_unlink
