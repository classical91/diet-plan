# Manual test notes

No CI checks are configured for this repo.

Manual browser checks for `/work-meals`:

1. Open `/work-meals` on mobile width.
2. Scroll to the Dinner section.
3. Confirm `Dinner week generator` is visible above the manual protein/carb/veg builder.
4. Choose `Generated dinners only`, tap `Replace week`, then click each day. The Night dinner card should show a generated dinner.
5. In Night, choose `From my list`, add simple dinner titles such as `Turkey burger` and `Lean burger` — type the title and press Enter (leaving the field or typing a trailing comma also saves it) — then return to Dinner.
6. Choose `My dinner list only`, tap `Replace week`, then confirm dinners use your saved list titles.
7. Choose `Mix generated + my dinner list`, tap `Replace week`, then confirm the week alternates generated dinners and saved-list dinners.
8. Clear one dinner, tap `Fill blanks`, and confirm only the empty dinner is filled.
9. Leave Night on `At work` and confirm a generated dinner still shows in the Night slot card. Clear that dinner and confirm the packable night suggestions come back.
10. In any slot choose `Type my own`, enter a title with an apostrophe such as `Shepherd's pie`, switch modes and reload the page, then confirm the text is still intact.
