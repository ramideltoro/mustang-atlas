# Reviewed applicability guard deployed

Application 29939036515961a02b815b2cc3b9c22721763802 is live with image sha256:dcb10993d03bfd1c36c60b9d8eb680b5a5487af6345bcafb79e1ac56fdd97038. Trusted supporting-source validation now uses the same hash-bound engine applicability corrections as the public catalog, including standard versus SVT hub sources.

All 308 tests and CI 40503358317 passed. The candidate image validated the production catalog before activation; all 150 published article endpoints passed afterward. Content remains 147 rewrites plus three preserved detailed guides. Previous image is retained as mustang-atlas-web:before-20261027-applicability; source backup is /srv/mustang-atlas-runtime-20261027-applicability/runtime-before.tar.gz.
