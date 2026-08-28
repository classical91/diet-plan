# Manual test notes

No CI checks are configured for this repo. The checks below were also run as a
headless Chromium script (Playwright) against `npm run dev` on port 3000.

Manual browser checks for `/work-meals`:

## The lists

1. Open `/work-meals` in a browser that has never used it. Morning should hold its six
   seeded foods, Afternoon its eight, and the Dinner section the seven dinners:
   `Frozen pizza`, `Chicken`, `Beef`, `Fish`, `Hamburger`, `Lasagna`, `Pasta`.
2. Each of the three sections offers one `Edit list` chip. There is no `Generated` /
   `From my list` toggle anywhere any more.
3. Tap `Edit list` in Morning. Every food grows a ✕, and an add field and
   `Reset to defaults` appear. Tap `Done editing` and all three go away again.
4. While editing, remove a food and add two more — type a title and press Enter (a trailing
   comma or leaving the field also saves it). The field keeps focus so several can be added
   in a row. Adding a name already in the list should not duplicate it.
5. Add a title with an apostrophe such as `Shepherd's pie`, reload, and confirm it is intact.
6. Tick a food you added. Ticking works whether or not the list is being edited, and a ticked
   food shows for that day in `/weekly-calendar`.
7. Set Morning to `At home`. Your list should still be listed — the old
   `Eating this at home — nothing to pack.` message is gone. `Hide` still drops the section.
8. Tap `Reset to defaults` in Morning and confirm the seeded six come back and your additions
   are dropped.
9. Reload after every kind of edit and confirm the lists come back exactly as left.

## Dinners

10. Tap `Chicken`. The card highlights, `Rice` and `Veggies` are both on, and the box above
    reads `Tonight: Chicken · rice · veggies`. Toggle each off and on again.
11. Tap `Hamburger` and confirm it offers `Beef` / `Chicken` instead of sides, defaulting to
    beef. `Frozen pizza`, `Lasagna` and `Pasta` offer nothing.
12. Tap `Edit list` in the Dinner section, remove `Frozen pizza`, and add `Chicken curry`.
    The new dinner should appear with a 🍽️ icon and offer `Rice` / `Veggies`, both **off** —
    a dinner you add starts plain.
13. Tap `Replace week` and confirm no night is the removed `Frozen pizza`, and that no dinner
    repeats on two nights in a row.
14. Remove every dinner. The section should say the list is empty and point at `Edit list`;
    `Reset to defaults` brings the seven back.
15. Set a night to a dinner, then remove that dinner from the list. The night keeps what it
    was set to and still reads correctly on both pages.
16. Tap `Surprise me` and confirm it picks from your list. `Order out`, `Already full` and
    `Clear` still work.
17. Leave Night on `At work` and confirm the dinner still shows in the Night slot card. Clear
    it and the slot should point at the Dinner section.

## The week

18. Clear one dinner, tap `Fill blank nights`, and confirm only the empty night is filled.
    `Plan my week` in the top toolbar does the same.
19. Set `Bulk cooking` to `Cook once, eat it 2 days` and tap `Replace week`. Days should pair
    up: Monday cooks, Tuesday repeats it. The repeated day should read `♻️ Leftovers from
    Monday`, and the message should say how many were eaten again from a batch.
20. Tick `Pack the leftovers as the next day's lunch` and regenerate. Each day after a cook
    should show a `♻️ Leftovers` card in its Afternoon slot; `Remove` drops just that card.
21. Pick a dinner and tap `Carry over to tomorrow`. The next day gets the same meal as its
    dinner (marked as leftovers from the day you cooked) plus a leftovers lunch. On Sunday it
    carries over to Monday. With no dinner picked it should ask for one first.
22. With `Bulk cooking` at 2 or 3, clear only some dinners and tap `Fill blank nights`. Only
    the blanks change, and a batch never carries across a night you had already planned.
23. Change `Bulk cooking` and the leftovers checkbox, reload, and confirm both come back.
24. Open `/work-meals?day=thu` and confirm Thursday is the selected day.

## The calendar

25. Open `/weekly-calendar`. A picked dinner shows in Night whether that night is `At work` or
    `At home`, with only its chosen sides after the name (`Chicken — rice · veggies`,
    `Frozen pizza` on its own). `Hide` suppresses it.
26. Ticked foods show in Morning and Afternoon. The calendar has no editing controls at all —
    no mode chips, no list picker, no add field. All editing lives on `/work-meals`.
27. Edit your dinner list on `/work-meals`, visit `/weekly-calendar`, then go back. The edited
    list must still be there — the calendar carries it through its own saves.
28. Add a food named `<img src=x onerror=alert(1)>`. It must render as that literal text on
    both pages, with no image element and no script running.

## AI panels

29. In `Generate ideas with AI`, generate ideas for a day with at least one `At work` slot.
    Ideas appear as tickable items under `AI ideas` in Morning and Afternoon, separate from
    your list, and any ticked idea also shows in `/weekly-calendar`.
30. In `Get AI feedback on my week`, tap `Get feedback` and confirm the response renders below
    the button.
31. Start the server with `ANTHROPIC_API_KEY` set. The key field should be hidden, the note
    should say the server key is in use, and both panels should work without typing a key.
32. Start the server without `ANTHROPIC_API_KEY`. The key field appears with a note that the
    key stays in this browser. `Generate ideas` with the field empty should say
    `Enter your API key first.`; entering a key should work and reveal `Forget key`, which
    clears the stored key for good (confirm it stays cleared after a reload).

## Older saved plans

33. Load a plan saved before the lists became editable. Its own typed foods should be merged
    into the seeded lists rather than replacing them; its typed night titles should each
    become a dinner of their own after the seven; a slot that sat on `From my list` should
    have its chosen meal ticked; and `Type my own` should be gone.
34. Confirm a dinner from that plan still reads correctly on both pages, with its protein named
    once rather than twice, and that picking a dinner from your list replaces it cleanly.
