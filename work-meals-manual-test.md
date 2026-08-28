# Manual test notes

No CI checks are configured for this repo. The checks below were also run as a
headless Chromium script (Playwright) against `npm run dev` on port 3000.

Manual browser checks for `/work-meals`:

1. Open `/work-meals` on mobile width.
2. Scroll to the Dinner section.
3. Confirm the dinner list shows exactly seven dinners, in this order: `Frozen pizza`,
   `Chicken`, `Beef`, `Fish`, `Hamburger`, `Lasagna`, `Pasta`. There is no template picker,
   no source picker, no ready-made meal grid and no protein/carb/veg builder.
4. Tap `Chicken`. The card should highlight, `Rice` and `Veggies` should both be on, and the box
   above should read `Tonight: Chicken · rice · veggies`.
5. Tap `Rice` to turn it off (`Tonight: Chicken · veggies`), then `Veggies` (`Tonight: Chicken`),
   then both back on. Only the selected dinner shows its option chips.
6. Tap `Hamburger` and confirm it offers `Beef` / `Chicken` instead of sides, defaulting to beef.
   Switching to `Chicken` should read `Tonight: Hamburger · chicken`.
7. Tap `Frozen pizza`, `Lasagna` and `Pasta` in turn. None of them offers options, and each reads
   as just its own name.
8. Switch to another day and back, and reload the page. The picked dinner and its options should
   come back exactly as left.
9. Tap `Replace week`, then click through each day. Every night should hold one of the seven
   dinners, and no dinner should repeat on two nights in a row.
10. Clear one dinner, tap `Fill blank nights`, and confirm only the empty night is filled.
11. Tap `Plan my week` in the top toolbar and confirm it fills blank nights the same way.
12. Leave Night on `At work` and confirm the dinner still shows in the Night slot card. The Night
    slot has no `Generated` / `From my list` toggle and no packable night suggestions — Morning
    and Afternoon keep both.
13. Clear the dinner and confirm the Night slot says nothing is picked yet and points at the
    Dinner section.
14. Tap `Surprise me` and confirm it picks one of the seven. `Order out` and `Already full` should
    still set those states, and `Clear` should empty the night.
15. In Morning or Afternoon choose `From my list` and add a title with an apostrophe such as
    `Shepherd's pie` — type it and press Enter (leaving the field or a trailing comma also saves
    it) — then switch modes and reload, and confirm the entry is intact and still selected.
16. Open `/weekly-calendar` and confirm a picked dinner shows in Night whether that night is
    `At work` or `At home`, with only its chosen sides after the name (`Chicken — rice · veggies`,
    `Frozen pizza` on its own). Setting the night to `Hide` should still suppress it. The Night
    row offers no food-list picker there either.
17. Open `/work-meals?day=thu` and confirm Thursday is the selected day.
18. In `Generate ideas with AI`, generate ideas for a day with at least one `At work` slot.
    Ideas should appear as tickable items in Morning and Afternoon, and any ticked idea should
    also show for that day in `/weekly-calendar`.
19. In `Get AI feedback on my week`, tap `Get feedback` and confirm the response renders below
    the button.
20. Start the server with `ANTHROPIC_API_KEY` set. The key field should be hidden, the note
    should say the server key is in use, and both panels should work without typing a key.
21. Start the server without `ANTHROPIC_API_KEY`. The key field should appear with a note that
    the key stays in this browser. Tapping `Generate ideas` with the field empty should say
    `Enter your API key first.`; entering a key should work and reveal `Forget key`, which
    clears the stored key for good (confirm it stays cleared after a reload).
22. Set `Bulk cooking` to `Cook once, eat it 2 days` and tap `Replace week`. Days should pair up:
    Monday cooks, Tuesday repeats it. The repeated day's dinner card should read
    `♻️ Leftovers from Monday`, and the message should say how many were eaten again from a batch.
23. Tick `Pack the leftovers as the next day's lunch` and regenerate. Each day after a cook
    should show a `♻️ Leftovers` card in its Afternoon slot; `Remove` should drop just that card.
24. Pick a dinner on any day and tap `Carry over to tomorrow`. The next day should get the same
    meal as its dinner (marked as leftovers from the day you cooked) plus a leftovers lunch.
    On Sunday it should carry over to Monday. With no dinner picked it should ask for one first.
25. Change `Bulk cooking` and the leftovers checkbox, reload the page, and confirm both come back
    as you left them.
26. Open `/weekly-calendar` after a bulk-cooked week. Repeat dinners should say
    `♻️ Leftovers from <day>` and packed lunches should show in Afternoon. Return to
    `/work-meals` and confirm the bulk-cooking settings survived the calendar visit.
27. With `Bulk cooking` set to 2 or 3, clear only some dinners and tap `Fill blank nights`. Only
    the blanks should change, and a batch should never carry across a night you had already
    planned.
28. Morning and Afternoon should offer only `Generated` and `From my list` — `Type my own` is gone
    from both `/work-meals` and `/weekly-calendar`, since the list mode already takes new titles.
29. Load a plan saved before that removal with a slot on `Type my own`. The typed meal should
    appear as an entry in that slot's list, selected, with the slot switched to `From my list`;
    a slot left on `Type my own` with nothing typed should fall back to `Generated`.
30. Load a plan saved before the dinner list replaced the generator — one holding a built plate
    (protein, carb, two vegetables, sauce) or a generated dinner title. It should still read
    correctly in both `/work-meals` and `/weekly-calendar`, with its protein named once rather
    than twice, and picking any of the seven dinners should replace it cleanly.
