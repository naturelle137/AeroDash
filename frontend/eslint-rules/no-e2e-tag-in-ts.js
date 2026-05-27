/**
 * @fileoverview ESLint rule — disallow `@E2E-XX-NNN@` traceability tags in
 * TypeScript COMMENTS. Per `docs/stc.md` and `CLAUDE.md` the E2E layer is
 * documented in `.feature` files (living documentation): the `.ts` step
 * definitions adjacent to those features are wiring, not the trace anchor.
 *
 * The trace scanner only collects E2E tags from `*.feature`, but treats
 * any `//`/`<!--` line in a `.ts` file as a candidate carrier for OTHER
 * tag types. An `@E2E-…@` comment in a `.ts` file is therefore both
 * outside the supported scan path AND a strong signal that an author has
 * pasted a feature-file tag into the wrong layer — silently breaking the
 * REQ → UJ → E2E chain.
 *
 * The rule deliberately only inspects comments. String/template literals
 * containing the pattern (e.g. trace-CLI tests that exercise the
 * `@E2E-…@` regex against synthetic input) are inert data: the scanner
 * ignores them, and they are routine in test fixtures.
 *
 * Wired into `frontend/eslint.config.ts` under the `aerodash/` plugin
 * namespace; see issue #265.
 */

const TAG_PATTERN = /@E2E-[A-Z]+-\d+@/

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        '`@E2E-…@` tags belong in `.feature` files (living documentation), not in TypeScript comments.',
      recommended: true,
    },
    messages: {
      unexpectedInComment:
        '`@E2E-…@` tag `{{tag}}` is not allowed inside a TypeScript comment. Move it to the matching `.feature` file.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode()
        for (const comment of sourceCode.getAllComments()) {
          const match = TAG_PATTERN.exec(comment.value)
          if (!match) continue
          context.report({
            loc: comment.loc,
            messageId: 'unexpectedInComment',
            data: { tag: match[0] },
          })
        }
      },
    }
  },
}
