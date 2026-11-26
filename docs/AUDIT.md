# Audit checkpoint — 26 November 2026

Public source: https://github.com/anshuman-pandey/reply-sprout

Reviewed source head: `16861ba705343349cb389d35e4801fed51dc0dad`. Latest recorded [CI run](https://github.com/anshuman-pandey/reply-sprout/actions/runs/43703043041) is success at this head.

Fresh local core check:

```text
✔ variables deduplicate and replace literal values without executing markup (1.714914ms)
✔ missing and inherited variable values are rejected (0.537645ms)
✔ invalid variable syntax is rejected (0.335489ms)
✔ imports validate every item before returning (0.621832ms)
✔ duplicate IDs and oversize backups are rejected (8.081099ms)
✔ merge deduplicates identical records and rejects conflicting versions (0.300884ms)
✔ search combines words with collection filter (0.713129ms)
✔ stale drafts cannot overwrite newer saved revisions (11.05416ms)
✔ quota failure does not mutate previous library (3.294162ms)
✔ corrupt storage requires explicit recovery and exact raw comparison (1.164546ms)
✔ unsupported locking refuses unsafe writes (1.115097ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 183.25258
```

Releases: None returned by GitHub. No hosted demo URL was verified. A source archive or preview release is not a hosted deployment.

Remaining checks:

- hosted HTTPS static deployment
- Firefox and Safari
- physical mobile input

This refresh corrects the publication checkpoint and preserves the earlier dated workflow results. It does not claim fresh browser, hardware or production security acceptance. Next: complete the listed acceptance checks and verify a persistent HTTPS deployment where required.
