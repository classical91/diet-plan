# Manual test notes

No CI checks are configured for this repo. The checks below were also run as a
headless Chromium script (Playwright) against `npm run dev` on port 3000.

Manual browser checks for `/work-meals`:

## The lists

1. Open `/work-meals` in a browser that has never used it. Morning holds its three seeded
   foods — `Eggs`, `Oat cereals`, `Oatmeal` — Afternoon its eight, and Night the seven
   dinners: `Frozen pizza`, `Chicken`, `Beef`, `Fish`, `Hamburger`, `Lasagna`, `Pasta`.
2. All three sections read the same: a marker, the name, nothing else. No notes, no tags,
   no cards, and no `Generated` / `From my list` toggle. Morning and Afternoon use square tick
   boxes (several can be on); Night uses round radios (one at a time).
3. Each section offers one `Edit list` chip. Tapping it grows a ✕ on every row and reveals
   an add field and `Reset to defaults`; `Done editing` puts them away.
4. While editing, remove an entry and add two more — type a name and press Enter (a trailing
   comma or leaving the field also saves it). The field keeps focus so several can be added in
   a row, and adding a name already in the list should not duplicate it. This works the same
   in all three sections, including Night.
5. Add a name with an apostrophe such as `Shepherd's pie`, reload, and confirm it is intact.
6. Tick a food you added in Morning. Ticking works whether or not the list is being edited,
   and a ticked food shows for that day in `/weekly-calendar`.
7. Set Morning to `At home`. Your list should still be listed. `Hide` drops the whole section.
8. Tap `Reset to defaults` in each section and confirm the seeded entries come back and your
   additions are dropped. In Morning that means the three breakfasts, whatever the list held
   before — this is also how a browser already carrying an older seeded list picks up a change
   to `FOOD_SEEDS`.
9. Reload after every kind of edit and confirm all three lists come back as left.

## Dinners, in the Night slot

10. Tap `Chicken`. Its row highlights, its radio fills, and `Rice` and `Veggies` appear inline
    on that row, both on. The box above the list reads `Tonight: Chicken · rice · veggies`.
11. Toggle `Rice` and `Veggies` off and on. Only the chosen dinner shows options.
12. Tap the chosen dinner again and confirm it clears.
13. Tap `Hamburger`: it offers `Beef` / `Chicken` instead of sides, defaulting to beef.
    `Frozen pizza`, `Lasagna` and `Pasta` offer nothing.
14. `Surprise me` picks from your list. `Order out`, `Already full` and `Clear` set their own
    states in the box above. All of them sit in the Night slot, next to the list.
15. `Carry over to tomorrow` gives the next day the same meal as its dinner (marked as leftovers
    from the day you cooked) plus a leftovers lunch, and says so in the Night slot itself. On
    Sunday it carries over to Monday. With no dinner picked it asks for one first.
16. Add `Chicken curry` while editing. It appears with a 🍽️ icon and offers `Rice` / `Veggies`,
    both **off** — a dinner you add starts plain.
17. Remove `Frozen pizza` and tap `Replace week`. No night should be the removed dinner, and no
    dinner should repeat on two nights in a row.
18. Remove every dinner. The slot says the list is empty and points at `Edit list`;
    `Reset to defaults` brings the seven back.
19. Set a night to a dinner, then remove that dinner from the list. The night keeps what it was
    set to, reads correctly on both pages, and no row shows as selected.

## The week

20. Clear one dinner, tap `Fill blank nights`, and confirm only the empty night is filled.
    `Plan my week` in the top toolbar does the same. Both report in the `Fill the week` box.
21. Set `Bulk cooking` to `Cook once, eat it 2 days` and tap `Replace week`. Days should pair
    up: Monday cooks, Tuesday repeats it. The repeated day should read `♻️ Leftovers from
    Monday`, and the message should say how many were eaten again from a batch.
22. Tick `Pack the leftovers as the next day's lunch` and regenerate. Each day after a cook
    should show a `♻️ Leftovers` card in its Afternoon slot; `Remove` drops just that card.
23. With `Bulk cooking` at 2 or 3, clear only some dinners and tap `Fill blank nights`. Only
    the blanks change, and a batch never carries across a night you had already planned.
24. Change `Bulk cooking` and the leftovers checkbox, reload, and confirm both come back.
25. Open `/work-meals?day=thu` and confirm Thursday is the selected day.

## The calendar

26. Open `/weekly-calendar`. A picked dinner shows in Night whether that night is `At work` or
    `At home`, with only its chosen sides after the name (`Chicken — rice · veggies`,
    `Frozen pizza` on its own). `Hide` suppresses it.
27. Ticked foods show in Morning and Afternoon. The calendar has no editing controls at all —
    no mode chips, no list picker, no add field. All editing lives on `/work-meals`.
28. Edit your dinner list on `/work-meals`, visit `/weekly-calendar`, then go back. The edited
    list must still be there — the calendar carries it through its own saves.
29. Add a food named `<img src=x onerror=alert(1)>`. It must render as that literal text on
    both pages, with no image element and no script running.

## AI panels

30. In `Generate ideas with AI`, generate ideas for a day with at least one `At work` slot.
    Ideas appear as tickable items under `AI ideas` in Morning and Afternoon, separate from
    your list, and any ticked idea also shows in `/weekly-calendar`.
31. In `Get AI feedback on my week`, tap `Get feedback` and confirm the response renders below
    the button.
32. Start the server with `ANTHROPIC_API_KEY` set. The key field should be hidden, the note
    should say the server key is in use, and both panels should work without typing a key.
33. Start the server without `ANTHROPIC_API_KEY`. The key field appears with a note that the
    key stays in this browser. `Generate ideas` with the field empty should say
    `Enter your API key first.`; entering a key should work and reveal `Forget key`, which
    clears the stored key for good (confirm it stays cleared after a reload).

## Older saved plans

34. Load a plan saved before the lists became editable. Its own typed foods should be merged
    into the seeded lists rather than replacing them; its typed night titles should each
    become a dinner of their own after the seven; a slot that sat on `From my list` should
    have its chosen meal ticked; and `Type my own` should be gone.
35. Confirm a dinner from that plan still reads correctly on both pages, with its protein named
    once rather than twice — a generated dinner called `Turkey` reads
    `Turkey · lentils · zucchini + cabbage · …`, never `Turkey · Turkey · …` — and that picking
    a dinner from your list replaces it cleanly.
