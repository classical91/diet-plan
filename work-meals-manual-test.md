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
10. In any slot choose `From my list` and add a title with an apostrophe such as `Shepherd's pie`, switch modes and reload the page, then confirm the entry is still intact and still selected.
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
19. In `Generate ideas with AI`, generate ideas for a day with at least one `At work` slot.
    Ideas should appear as tickable items in those slots, and any ticked idea should also show
    for that day in `/weekly-calendar`.
20. In `Get AI feedback on my week`, tap `Get feedback` and confirm the response renders below
    the button.
21. Start the server with `ANTHROPIC_API_KEY` set. The key field should be hidden, the note
    should say the server key is in use, and both panels should work without typing a key.
22. Start the server without `ANTHROPIC_API_KEY`. The key field should appear with a note that
    the key stays in this browser. Tapping `Generate ideas` with the field empty should say
    `Enter your API key first.`; entering a key should work and reveal `Forget key`, which
    clears the stored key for good (confirm it stays cleared after a reload).
23. In the dinner generator set `Template` to `Simple dinner` and tap `Replace week`. Every
    dinner should be one easy main — `Frozen pizza`, `Hamburger`, `Chicken`, `Beef` or `Fish` —
    and the note under the picker should describe the chosen template.
24. Work through the other templates (`Balanced plate`, `One-pan tray bake`, `Bowl or stir-fry`,
    `Bulk batch pot`, `Mix all templates`) and confirm each one names its dinners in its own
    style and fills protein, carb and veg sensibly. `Surprise me` should use the chosen template.
25. Set `Bulk cooking` to `Cook once, eat it 2 days` and tap `Replace week`. Days should pair up:
    Monday cooks, Tuesday repeats it. The repeated day's dinner card should read
    `♻️ Leftovers from Monday`, and the message should say how many were eaten again from a batch.
26. Tick `Pack the leftovers as the next day's lunch` and regenerate. Each day after a cook
    should show a `♻️ Leftovers` card in its Afternoon slot; `Remove` should drop just that card.
27. Plan a dinner on any day and tap `Cook double → carry over`. The next day should get the same
    meal as its dinner (marked as leftovers from the day you cooked) plus a leftovers lunch.
    On Sunday it should carry over to Monday.
28. Change `Template`, `Bulk cooking` and the leftovers checkbox, reload the page, and confirm all
    three — and the source picker — come back as you left them.
29. Open `/weekly-calendar` after a bulk-cooked week. Repeat dinners should say
    `♻️ Leftovers from <day>` and packed lunches should show in Afternoon. Return to
    `/work-meals` and confirm the generator settings survived the calendar visit.
30. With `Bulk cooking` set to 2 or 3, clear only some dinners and tap `Fill blanks`. Only the
    blanks should change, and a batch should never carry across a day you had already planned.
31. Each slot should offer only `Generated` and `From my list` — `Type my own` is gone from both
    `/work-meals` and `/weekly-calendar`, since the list mode already takes new titles.
32. Load a plan saved before that removal with a slot on `Type my own`. The typed meal should
    appear as an entry in that slot's list, selected, with the slot switched to `From my list`;
    a slot left on `Type my own` with nothing typed should fall back to `Generated`.
