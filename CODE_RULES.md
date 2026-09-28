# Scope and ratchet

New features belong in `src/features/<capability>/index.js`; network access belongs in `src/services`. Never put service credentials in frontend code. The composition root wires modules without business rules.

New authored modules stay below 400 lines, functions below 60. Imported templates/styles/visual widgets are an explicit migration baseline, not evidence of compliance with new-code budgets. Do not expand inherited inline style/event strings, globals or oversized widgets. Refactor the affected feature before extending it.

The independent check rejects Imweb hosts in deployable output, broken local imports and service-to-feature imports. Its negative control proves a forbidden host is rejected. It tests consultation success, failed HTTP/application responses and disabled transport without sending email.

Do not publish archives, original runtime, login mocks or the unused consultation-original module. Keep one script entry per page. Preserve original routes and layout during migration.
