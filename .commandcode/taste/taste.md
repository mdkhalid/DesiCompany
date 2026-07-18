# i18n
- Use ₹ (Indian Rupee) instead of $ for all currency display since the application is used in India. Confidence: 0.85

# git
- Before pushing code, run both builds and tests to verify the app does not break. Confidence: 0.70

# workspace
- Write project documentation and guides within the project workspace directory (e.g., docs/), not to external locations like user home directories, so the user can find them. Confidence: 0.70

# communication
- When walking through multi-step processes (especially deployment guides), break them down into sequential bite-sized steps and guide one at a time rather than presenting the full guide at once. Confidence: 0.65

# coding
- When fixing a bug, check the entire codebase for all occurrences of the same issue and verify the fix by grepping for remaining instances and running all related tests — fix every instance, verify thoroughly, and only then declare it done. Confidence: 0.85
