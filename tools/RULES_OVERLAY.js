/* ════════════════════════════════════════════════════════════════════
   RULES OVERLAY — Build & Price Configurator
   ════════════════════════════════════════════════════════════════════
   Option-compatibility data, kept out of the generated catalog on purpose.
   const MODELS in the configurator (and the copy inside SALES ORDER
   CREATOR.html) is regenerated from the price sheets — anything written
   directly into that blob is wiped on the next regeneration. This file
   is not: it is loaded and merged at runtime, so it survives.

   Populated only with rules Stephen has approved. See
   WEBSITE - BUILD HUB REVISIONS\7 - IMPLEMENTATION LOG.docx for the
   proposal batches (style tags, quantity caps, the unsourced-pairs
   matrix) awaiting sign-off. Nothing here is a guess — an option with
   no entry keeps its current (unrestricted) behavior.

   Shape:
     radioCategories — category names made single-choice. Steering was
       already single-choice before this file existed (Boat_Configurator
       line ~1193); listed here so future additions are data, not code.
     styleTags   — {optionId: 'styleId' | ['styleId', ...]} restricts an
       option to one or more of its model's hull styles.
     qtyMax      — {optionId: n} caps a quantity-stepper option at n.
                   Options with no entry keep the existing default cap.
     excludes    — {optionId: ['otherOptionId', ...]} — selecting this
                   option removes/blocks the listed ones, and vice versa.
   ════════════════════════════════════════════════════════════════════ */
const RULES_OVERLAY = {
  radioCategories: ['Steering'],
  styleTags: {},
  qtyMax: {},
  excludes: {}
};
