# PRSentinel Documentation

## Risk Scores Interpretation

Risk scores range from 0 to 10. They are calculated based on multiple factors:
- **Logic Risk:** Complexity and potential for logical errors.
- **Dependency Risk:** Changes to critical dependencies.
- **Data Exposure:** Access to sensitive data or PII.
- **Testing Coverage:** Whether the new code is adequately tested.

### Best Practices for Code Merging Discussions

1. **Review High Risk PRs First:** PRs with a risk score > 7 should be prioritized for deep-dive reviews.
2. **Use Rationale for Context:** Don't just look at the score; read the rationale bullet points to understand *why* a PR is considered risky.
3. **Validate with PROutcomes:** Regularly check the PROutcome data to see if the risk scores accurately predicted post-merge issues.
4. **Actionable Retrospectives:** Use the Sprint and ActionItem system to track improvements identified during retrospectives.
