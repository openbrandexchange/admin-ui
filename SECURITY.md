# Security policy

## Reporting a vulnerability

Please report security problems privately to **security@openbrandexchange.com**. Do not open a public issue, pull request or discussion for them.

Include what you found, how to reproduce it (the smallest steps, requests or a proof of concept), which version or commit you tested, and what an attacker could do with it. If you would like to be credited, say how.

What happens next:

| When | What |
|---|---|
| within 3 working days | we confirm we received your report |
| within 10 working days | we tell you whether we can reproduce it and how serious we think it is |
| within 90 days | a fix is released, or we agree a later date with you |

We will keep you informed, and we ask you not to disclose the problem until a fix is available (coordinated disclosure). We will not take legal action against research done in good faith that respects user privacy, does not degrade the service and stays within this policy.

## Supported versions

Security fixes go into the latest release. While the project is 0.x, only the newest minor version gets fixes; upgrade to it (release notes in [CHANGELOG.md](CHANGELOG.md)).

## Scope

This repository is the browser interface that every Open Brand Exchange portal serves. In scope, for example: cross-site scripting, anything that leaks a session, CSRF token or one-time secret, unsafe handling of links or files, and anything that makes the UI need a weaker Content-Security-Policy than the one in [docs/node-integration.md](docs/node-integration.md).

Problems in a portal implementation (authentication, access control, the API itself) belong to that implementation's repository, but you may report them to the same address and we will forward them.

This project is published by the Open Brand Exchange Foundation (in formation).
