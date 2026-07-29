/* ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
   RULES OVERLAY â Build & Price Configurator
   ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
   Option-compatibility data, kept out of the generated catalog on
   purpose: const MODELS (and the copy in SALES ORDER CREATOR.html) is
   regenerated from the price sheets â anything written into that blob
   is wiped on the next regeneration. This file is merged at load and
   survives.

   HOW APPROVAL WORKS
   The top-level keys are LIVE â the configurator applies them at load.
   Everything under PROPOSED is INERT. Each PROPOSED block is keyed to a
   question in "9 - QUESTIONS FOR STEPHEN". When Stephen approves a
   question, move that block's entries up into the matching live key
   (or ask the agent to). Nothing here was guessed: every entry traces
   to a reviewer statement, an option's own name, or a decision in the
   decisions log â the trace is in doc 9.

   LIVE KEYS
     radioCategories â single-choice categories. 'Name' or
                       {name, nonRadioPattern} where the regex marks
                       items that stay independent checkboxes.
     styleTags   â {optionId: 'styleId' | ['styleId',...]}
     qtyMax      â {optionId: n} quantity cap (default without entry: 8)
     qtyEnable   â [optionId,...] adds a quantity stepper
     excludes    â {optionId: [otherId,...]} mutual exclusion (two-way)
     reqAdd      â {optionId: {req:[ids], reqLabel:'...'}}
     lock241Add  â [optionId,...] suppressed when engine includes the 241
     catalogPatches â [{m,prop,v} | {m,styleId,prop,v} | {m,lenRename:{from,to}}]
   ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */
const RULES_OVERLAY = {
  /* âââââââââââ LIVE â applied at load âââââââââââ */
  radioCategories: ['Steering'],
  styleTags: {},
  qtyMax: {},
  qtyEnable: [],
  excludes: {},
  reqAdd: {},
  lock241Add: [],
  catalogPatches: [],

  /* âââââââââââ PROPOSED â inert until approved via doc 9 âââââââââââ */
  PROPOSED: {
    /* Q-CFG-01 â the 51 name-readable style tags (CFG-R-18) */
    'Q-CFG-01': { styleTags: {"ak_fabricatio_4_33":"occ","ak_fabricatio_4_34":"occ","ak_fabricatio_4_35":"occ","ak_powdercoat_0_0":"ws","ak_rigging_5_57":["ws","occ"],"lt_fabricatio_4_30":"occ","lt_fabricatio_4_31":"occ","lt_fabricatio_4_32":"occ","lt_rigging_5_50":"occ","rogue_general_3_21":"occ","rogue_general_3_24":"occ","skagit_fabricatio_4_33":"occ","skagit_fabricatio_4_34":"occ","skagit_fabricatio_4_35":"occ","skagit_powdercoat_0_0":"ws","skagit_rigging_5_65":["ws","occ"],"so_fabricatio_4_32":"occ","so_fabricatio_4_33":"occ","so_fabricatio_4_34":"occ","so_powdercoat_0_0":"ws","so_rigging_5_61":["ws","occ"],"sport_fabricatio_4_35":"occ","sport_fabricatio_4_36":"occ","sport_fabricatio_4_37":"occ","sport_powdercoat_0_0":"ws","sport_rigging_5_67":["ws","occ"],"sportster_fabricatio_5_33":"occ","sportster_fabricatio_5_34":"occ","sportster_fabricatio_5_35":"occ","sportster_powdercoat_0_0":"ws","sportster_powdercoat_0_1":"occ","ssd_fabricatio_4_33":"occ","ssd_fabricatio_4_34":"occ","ssd_fabricatio_4_35":"occ","ssd_fabricatio_4_56":"ws","ssd_powdercoat_0_0":"ws","ssd_rigging_5_68":["ws","occ"],"sso_fabricatio_4_31":"occ","sso_fabricatio_4_32":"occ","sso_fabricatio_4_33":"occ","sso_powdercoat_0_0":"ws","sso_rigging_5_60":["ws","occ"],"xl_fabricatio_4_32":"occ","xl_fabricatio_4_33":"occ","xl_fabricatio_4_34":"occ","xl_powdercoat_0_0":"ws","xl_rigging_5_63":["ws","occ"],"xlt_fabricatio_4_29":"occ","xlt_fabricatio_4_30":"occ","xlt_fabricatio_4_31":"occ","xlt_rigging_5_53":"occ"} },

    /* Q-CFG-02 â SeaDek <-> non-slip powder floor exclusion (CFG-R-11 / SOC-03) + one-jet-foot-per-boat (CFG-R-08) */
    'Q-CFG-02': { excludes: {"ak_floor_1_4":["ak_floor_1_3"],"ak_motorinsta_13_105":["ak_motorinsta_13_106","ak_motorinsta_13_107","ak_motorinsta_13_108","ak_motorinsta_13_109","ak_motorinsta_13_110"],"ak_motorinsta_13_106":["ak_motorinsta_13_107","ak_motorinsta_13_108","ak_motorinsta_13_109","ak_motorinsta_13_110"],"ak_motorinsta_13_107":["ak_motorinsta_13_108","ak_motorinsta_13_109","ak_motorinsta_13_110"],"ak_motorinsta_13_108":["ak_motorinsta_13_109","ak_motorinsta_13_110"],"ak_motorinsta_13_109":["ak_motorinsta_13_110"],"lt_floor_1_6":["lt_floor_1_5"],"lt_motorinsta_12_94":["lt_motorinsta_12_95","lt_motorinsta_12_96"],"lt_motorinsta_12_95":["lt_motorinsta_12_96"],"rogue_motorinsta_8_59":["rogue_motorinsta_8_60","rogue_motorinsta_8_61","rogue_motorinsta_8_62","rogue_motorinsta_8_63","rogue_motorinsta_8_64"],"rogue_motorinsta_8_60":["rogue_motorinsta_8_61","rogue_motorinsta_8_62","rogue_motorinsta_8_63","rogue_motorinsta_8_64"],"rogue_motorinsta_8_61":["rogue_motorinsta_8_62","rogue_motorinsta_8_63","rogue_motorinsta_8_64"],"rogue_motorinsta_8_62":["rogue_motorinsta_8_63","rogue_motorinsta_8_64"],"rogue_motorinsta_8_63":["rogue_motorinsta_8_64"],"scout_floor_1_4":["scout_floor_1_8"],"scoutwb_floor_1_3":["scoutwb_floor_1_7"],"skagit_floor_1_4":["skagit_floor_1_3"],"skagit_motorinsta_14_116":["skagit_motorinsta_14_117","skagit_motorinsta_14_118","skagit_motorinsta_14_119","skagit_motorinsta_14_120","skagit_motorinsta_14_121"],"skagit_motorinsta_14_117":["skagit_motorinsta_14_118","skagit_motorinsta_14_119","skagit_motorinsta_14_120","skagit_motorinsta_14_121"],"skagit_motorinsta_14_118":["skagit_motorinsta_14_119","skagit_motorinsta_14_120","skagit_motorinsta_14_121"],"skagit_motorinsta_14_119":["skagit_motorinsta_14_120","skagit_motorinsta_14_121"],"skagit_motorinsta_14_120":["skagit_motorinsta_14_121"],"skagitib_floor_1_5":["skagitib_floor_1_4"],"skagitx_floor_1_5":["skagitx_floor_1_4"],"so_floor_1_4":["so_floor_1_3"],"sport_floor_1_4":["sport_floor_1_3"],"sport_motorinsta_14_121":["sport_motorinsta_14_122","sport_motorinsta_14_123","sport_motorinsta_14_124","sport_motorinsta_14_125","sport_motorinsta_14_126"],"sport_motorinsta_14_122":["sport_motorinsta_14_123","sport_motorinsta_14_124","sport_motorinsta_14_125","sport_motorinsta_14_126"],"sport_motorinsta_14_123":["sport_motorinsta_14_124","sport_motorinsta_14_125","sport_motorinsta_14_126"],"sport_motorinsta_14_124":["sport_motorinsta_14_125","sport_motorinsta_14_126"],"sport_motorinsta_14_125":["sport_motorinsta_14_126"],"sportib_floor_1_5":["sportib_floor_1_4"],"sportster_floor_1_5":["sportster_floor_1_4"],"sportster_motorinsta_16_121":["sportster_motorinsta_16_122","sportster_motorinsta_16_123","sportster_motorinsta_16_124","sportster_motorinsta_16_125","sportster_motorinsta_16_126"],"sportster_motorinsta_16_122":["sportster_motorinsta_16_123","sportster_motorinsta_16_124","sportster_motorinsta_16_125","sportster_motorinsta_16_126"],"sportster_motorinsta_16_123":["sportster_motorinsta_16_124","sportster_motorinsta_16_125","sportster_motorinsta_16_126"],"sportster_motorinsta_16_124":["sportster_motorinsta_16_125","sportster_motorinsta_16_126"],"sportster_motorinsta_16_125":["sportster_motorinsta_16_126"],"ssd_floor_1_3":["ssd_floor_1_2"],"ssd_motorinsta_14_121":["ssd_motorinsta_14_122","ssd_motorinsta_14_123","ssd_motorinsta_14_124","ssd_motorinsta_14_125","ssd_motorinsta_14_126"],"ssd_motorinsta_14_122":["ssd_motorinsta_14_123","ssd_motorinsta_14_124","ssd_motorinsta_14_125","ssd_motorinsta_14_126"],"ssd_motorinsta_14_123":["ssd_motorinsta_14_124","ssd_motorinsta_14_125","ssd_motorinsta_14_126"],"ssd_motorinsta_14_124":["ssd_motorinsta_14_125","ssd_motorinsta_14_126"],"ssd_motorinsta_14_125":["ssd_motorinsta_14_126"],"ssdib_floor_1_5":["ssdib_floor_1_4"],"sso_floor_1_4":["sso_floor_1_3"],"xl_floor_1_3":["xl_floor_1_2"],"xl_motorinsta_14_116":["xl_motorinsta_14_117","xl_motorinsta_14_118","xl_motorinsta_14_119","xl_motorinsta_14_120","xl_motorinsta_14_121"],"xl_motorinsta_14_117":["xl_motorinsta_14_118","xl_motorinsta_14_119","xl_motorinsta_14_120","xl_motorinsta_14_121"],"xl_motorinsta_14_118":["xl_motorinsta_14_119","xl_motorinsta_14_120","xl_motorinsta_14_121"],"xl_motorinsta_14_119":["xl_motorinsta_14_120","xl_motorinsta_14_121"],"xl_motorinsta_14_120":["xl_motorinsta_14_121"],"xlib_floor_1_5":["xlib_floor_1_4"],"xlt_floor_1_5":["xlt_floor_1_4"],"xlt_motorinsta_12_100":["xlt_motorinsta_12_101","xlt_motorinsta_12_102"],"xlt_motorinsta_12_101":["xlt_motorinsta_12_102"],"xlt_motorinsta_12_97":["xlt_motorinsta_12_98","xlt_motorinsta_12_99","xlt_motorinsta_12_100","xlt_motorinsta_12_101","xlt_motorinsta_12_102"],"xlt_motorinsta_12_98":["xlt_motorinsta_12_99","xlt_motorinsta_12_100","xlt_motorinsta_12_101","xlt_motorinsta_12_102"],"xlt_motorinsta_12_99":["xlt_motorinsta_12_100","xlt_motorinsta_12_101","xlt_motorinsta_12_102"]} },

    /* Q-CFG-03 â suspension seats: enable stepper + cap at 2 (CFG-R-15) */
    'Q-CFG-03': { qtyEnable: ["ak_seating_2_15","ak_seating_2_16","xl_seating_2_14","xl_seating_2_15","skagit_seating_2_15","skagit_seating_2_16","xlib_seating_3_20","xlib_seating_3_21","scout_seating_4_25","scout_seating_4_26","scoutwb_seating_4_24","scoutwb_seating_4_25","skagitib_seating_3_20","skagitib_seating_3_21","sportster_seating_3_20","sportster_seating_3_21","sportib_seating_3_20","sportib_seating_3_21","ssdib_seating_3_20","ssdib_seating_3_21","skagitx_seating_3_20","skagitx_seating_3_21"], qtyMax_seats: 2 },

    /* Q-CFG-04 â quantity caps: 12V plugs 4 (CFG-R-06), cup holders 2, suspension seats 2 (CFG-R-07 full table in the Excel matrix) */
    'Q-CFG-04': { qtyMax: {"ak_fabricatio_4_27":2,"ak_rigging_5_49":4,"ak_rigging_5_54":2,"ak_seating_2_15":2,"ak_seating_2_16":2,"lt_fabricatio_4_25":2,"lt_rigging_5_40":4,"lt_rigging_5_45":2,"rogue_general_3_17":4,"rogue_general_3_21":2,"scout_fabricatio_5_34":2,"scout_rigging_6_52":4,"scout_rigging_6_57":2,"scout_seating_4_25":2,"scout_seating_4_26":2,"scoutwb_fabricatio_5_33":2,"scoutwb_rigging_6_49":4,"scoutwb_rigging_6_54":2,"scoutwb_seating_4_24":2,"scoutwb_seating_4_25":2,"skagit_fabricatio_4_27":2,"skagit_rigging_5_56":4,"skagit_rigging_5_61":2,"skagit_seating_2_15":2,"skagit_seating_2_16":2,"skagitib_fabricatio_5_30":2,"skagitib_rigging_6_53":4,"skagitib_rigging_6_58":2,"skagitib_seating_3_20":2,"skagitib_seating_3_21":2,"skagitx_fabricatio_5_30":2,"skagitx_rigging_6_52":4,"skagitx_rigging_6_57":2,"skagitx_seating_3_20":2,"skagitx_seating_3_21":2,"so_fabricatio_4_27":2,"so_rigging_5_52":4,"so_rigging_5_57":2,"so_seating_2_15":2,"so_seating_2_16":2,"so_seating_2_17":2,"sport_fabricatio_4_29":2,"sport_rigging_5_58":4,"sport_rigging_5_63":2,"sport_seating_2_15":2,"sport_seating_2_16":2,"sport_seating_2_17":2,"sportib_fabricatio_5_30":2,"sportib_rigging_6_52":4,"sportib_rigging_6_57":2,"sportib_seating_3_20":2,"sportib_seating_3_21":2,"sportster_fabricatio_5_30":2,"sportster_rigging_6_52":4,"sportster_rigging_6_57":2,"sportster_seating_3_20":2,"sportster_seating_3_21":2,"ssd_fabricatio_4_27":2,"ssd_rigging_5_59":4,"ssd_rigging_5_64":2,"ssd_seating_2_14":2,"ssd_seating_2_15":2,"ssd_seating_2_16":2,"ssdib_fabricatio_5_30":2,"ssdib_rigging_7_53":4,"ssdib_rigging_7_58":2,"ssdib_seating_3_20":2,"ssdib_seating_3_21":2,"sso_fabricatio_4_27":2,"sso_rigging_5_51":4,"sso_rigging_5_56":2,"sso_seating_2_15":2,"sso_seating_2_16":2,"sso_seating_2_17":2,"xl_fabricatio_4_26":2,"xl_rigging_5_54":4,"xl_rigging_5_59":2,"xl_seating_2_14":2,"xl_seating_2_15":2,"xlib_fabricatio_5_30":2,"xlib_rigging_6_49":4,"xlib_rigging_6_54":2,"xlib_seating_3_20":2,"xlib_seating_3_21":2,"xlt_fabricatio_4_24":2,"xlt_rigging_5_43":4,"xlt_rigging_5_48":2} },

    /* Q-CFG-05 â welded rigid frame requires a canvas top (CFG-R-17, Grant) */
    'Q-CFG-05': { reqAdd: {"skagit_canvastop_16_138":{"req":["skagit_canvastop_16_133","skagit_canvastop_16_135","skagit_canvastop_16_136","skagit_canvastop_16_139"],"reqLabel":"Requires a canvas top"},"skagitib_canvastop_15_111":{"req":["skagitib_canvastop_15_106","skagitib_canvastop_15_108","skagitib_canvastop_15_109","skagitib_canvastop_15_112"],"reqLabel":"Requires a canvas top"},"skagitx_canvastop_15_110":{"req":["skagitx_canvastop_15_105","skagitx_canvastop_15_107","skagitx_canvastop_15_108","skagitx_canvastop_15_111"],"reqLabel":"Requires a canvas top"},"so_canvastop_15_125":{"req":["so_canvastop_15_120","so_canvastop_15_122","so_canvastop_15_123","so_canvastop_15_126"],"reqLabel":"Requires a canvas top"},"sport_canvastop_16_143":{"req":["sport_canvastop_16_138","sport_canvastop_16_140","sport_canvastop_16_141","sport_canvastop_16_144"],"reqLabel":"Requires a canvas top"},"sportib_canvastop_15_110":{"req":["sportib_canvastop_15_105","sportib_canvastop_15_107","sportib_canvastop_15_108","sportib_canvastop_15_111"],"reqLabel":"Requires a canvas top"},"sportster_canvastop_15_109":{"req":["sportster_canvastop_15_105","sportster_canvastop_15_107","sportster_canvastop_15_108","sportster_canvastop_15_110"],"reqLabel":"Requires a canvas top"},"ssd_canvastop_16_143":{"req":["ssd_canvastop_16_138","ssd_canvastop_16_140","ssd_canvastop_16_141","ssd_canvastop_16_144"],"reqLabel":"Requires a canvas top"},"ssdib_canvastop_16_111":{"req":["ssdib_canvastop_16_106","ssdib_canvastop_16_108","ssdib_canvastop_16_109","ssdib_canvastop_16_112"],"reqLabel":"Requires a canvas top"},"sso_canvastop_15_123":{"req":["sso_canvastop_15_118","sso_canvastop_15_120","sso_canvastop_15_121","sso_canvastop_15_124"],"reqLabel":"Requires a canvas top"},"xl_canvastop_16_138":{"req":["xl_canvastop_16_133","xl_canvastop_16_135","xl_canvastop_16_136","xl_canvastop_16_139"],"reqLabel":"Requires a canvas top"},"xlib_canvastop_15_108":{"req":["xlib_canvastop_15_103","xlib_canvastop_15_105","xlib_canvastop_15_106","xlib_canvastop_15_109"],"reqLabel":"Requires a canvas top"}} },

    /* Q-CFG-06 â single-choice helm seat â swivels/slides/pedestals/box-seat pairs/leaning post stay independent (CFG-R-10) */
    'Q-CFG-06': { radioCategories: [{name:'Seating', nonRadioPattern:'swivel|slide|pedestal base|bracket|width of bench|pair upholstered|leaning post'}] },

    /* Q-CFG-07 â single-choice starting battery â chargers, tender, ACR, converter, trolling banks, forward upcharge stay independent (CFG-R-13) */
    'Q-CFG-07': { radioCategories: [{name:'Battery System', nonRadioPattern:'charger|tender|ACR|converter|trolling|forward upcharge'}] },

    /* Q-CFG-08 â single-choice Garmin display â NMEA backbone stays independent. CAUTION: blocks legitimate two-display boats; see doc 9 (CFG-R-12) */
    'Q-CFG-08': { radioCategories: [{name:'Garmin Electronics', nonRadioPattern:'NMEA'}] },

    /* Q-CFG-09 â single-choice kicker motor â brackets, tie-bar, bay kit, autopilot stay independent (CFG-R-09) */
    'Q-CFG-09': { radioCategories: [{name:'Kicker Installation', nonRadioPattern:'bracket|tie-bar|bay kit|autopilot'}] },

    /* Q-CFG-10 â catalog display patches: Inboard suffixes (CFG-M-05) + Scout Widebody style title (CFG-M-10) */
    'Q-CFG-10': { catalogPatches: [
      {m:'scout',   prop:'nm', v:'Scout Inboard'},
      {m:'scoutwb', prop:'nm', v:'Scout Widebody Inboard'},
      {m:'skagitx', prop:'nm', v:'Skagit-X Inboard'},
      {m:'scoutwb', styleId:'ws', prop:'nm', v:'Cabin with Idaho deck'}
    ] },

    /* Q-CFG-11 â Drifter Inboard 20 ft retired -> range 21/23/25 (doc 4; price carries over from the 20 until you say otherwise) */
    'Q-CFG-11': { catalogPatches: [ {m:'ssdib', lenRename:{from:20, to:21}} ] },

  }
};
