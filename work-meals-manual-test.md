# Manual test notes

No CI checks are configured for this repo. The checks below were also run as a
headless Chromium script (Playwright) against `npm run dev` on port 3000.

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
11. Add `Chicken burger` to the night list and generate from `My dinner list only`. The dinner card should read chicken breast, not lean beef. `Turkey burger` should read turkey, `Lean burger` lean beef.
12. Add a title the app cannot read, such as `Pasta bolognese`. The card should still show the title, and the Dinner balance box should ask for the missing parts rather than inventing a protein or defaulting the vegetable to broccoli.
13. With the night list empty, choose `Mix generated + my dinner list` and tap `Replace week`. The week should fill with generated dinners and say so, rather than refusing. `My dinner list only` should still refuse with an empty list.
14. With the source set to `Generated dinners only`, tap `Plan my week` in the top toolbar and confirm it honours that choice.
15. Plan a full week, clear only Monday, Wednesday and Friday, then choose
    `Mix generated + my dinner list` and tap `Fill blanks`. Those three should alternate
    generated → my list → generated based on the order they are filled, not on the weekday.
16. Open `/weekly-calendar` and confirm a planned dinner shows in Night whether that night is
    `At work` or `At home`. Setting the night to `Hide` should still suppress it.
17. Confirm a title-only dinner such as `Pasta bolognese` shows by name in `/weekly-calendar`
    with no invented protein, carb or vegetable.
18. Open `/work-meals?day=thu` and confirm Thursday is the selected day.
19. In `Generate ideas with AI`, enter an Anthropic API key and generate ideas for a day with
    at least one `At work` slot. Ideas should appear as tickable items in those slots, and any
    ticked idea should also show for that day in `/weekly-calendar`.
20. In `Get AI feedback on my week`, tap `Get feedback` and confirm the response renders below
    the button (needs the key from the panel underneath).
