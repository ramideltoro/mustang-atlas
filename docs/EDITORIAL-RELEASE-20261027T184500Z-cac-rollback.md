# Targeted editorial rollback

Restored the prior published version of `job-8c9389c74879e8f2` after a supplemental readability/access review found that the new CAC outlet-pipe guide mixed raised-vehicle work with engine-side access and left cooling-fan isolation unresolved. The original independent technical review is retained as an audit artifact; it did not catch these coordination defects.

Only this article was reverted. Full 950-guide validation, production validation and the changed public route passed before and after atomic activation. The remaining release stays live: 366 rewritten articles, comprising 186 practical guides and 180 references. Exact rollback manifest and checks are retained privately under `work/editorial-releases/20261027T184500Z-cac-rollback`.

New main workshop candidates now require a separate exact-guide-hash supervisory approval before either release counting or snapshot preparation. Secondary guides use their existing exact approval map. Unchanged public content is not relabeled as newly supervised. Source hashes, independent technical review and complete-catalog checks remain mandatory. The corrected procedure must receive a new full reader-facing sequence check before publication.
