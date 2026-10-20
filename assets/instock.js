/* instock.js: is a shop boat for sale right now? WRITTEN BY _build/build_new_inventory.sh from the NEWINV
   list in new-inventory/index.html (boats with sold:false). Don't hand-edit; re-run the builder.
   While WB_INSTOCK > 0 the "In Stock" menu link shows (html.wb-instock). The main site (header.html)
   AND the store header (store.wooldridgeboats.com) both load this file, so the two menus always match. */
window.WB_INSTOCK = 1;
document.documentElement.classList.toggle('wb-instock', window.WB_INSTOCK > 0);
