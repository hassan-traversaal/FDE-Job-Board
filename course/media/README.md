# media/

The recordings stream from GCS by default (see the root README). Files here are
an optional override, for offline demos. Name them by session id:

```
media/s1.mp4    Foundations of Claude Code         (Zoom: Session 1/*_3440x1440.mp4)
media/s2.mp4    From skills to subagents           (Session 2/*_1842x956.mp4)
media/s3.m4a    Multi-agent systems and agent teams (session 3 has audio only)
media/s4.mp4    Evals and deployment               (Session 4/*_2560x1440.mp4)
media/s5.mp4    Preparing for the CCAF exam        (Session 5/*_2560x1440.mp4)
```

`.mp4 .webm .m4v .mov .m4a .mp3` are all picked up. No restart is needed:
the next page load of that session finds the file, swaps the preview player
for the real one, and keeps every chapter, transcript line and bot citation
pointing at the same seconds.

Until a file is here, that session plays in **preview**: the frame from each
minute of the class with the transcript as captions.

Everything in this folder except this README is gitignored. Set `MEDIA_DIR` in
`.env` to keep the files somewhere else.
