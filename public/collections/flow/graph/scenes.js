/* Kings Don't Buy Flow, graph edition: step definitions and page-only node data.
   Plain data. graph.js reads window.KDBF_SCENES.

   Tokens in `body`, `hero.label`, thread and event strings, filled in by graph.js:
     {cite:id}         superscript citation marker for KDBF_DATA.sources[id]; colour by provenance
                       (rd-* = Red Deer's figure, gold; anything else = reported, blue)
     {cite:id:model}   same marker, coloured as this page's model or arithmetic (violet)
     {term:key}        glossary term (dotted underline + popover); {term:key|shown text} to show other text
     {live:integrated} live tier list for the integrated groups
     {mit}             mitigation formula with the weights from model.json
     {thread}          block built from data
     {node:id|text}    inline button that focuses a node
     {parts}           links to the three Red Deer posts
   Each step can have:
     hero      { v, kind: author | reported | model | shock, label, cite } or "live" (the shock count)
     legend    up to three keys shown in the step's legend row (edge types or marks; see graph.js LG)
     pose      step-only node positions (world units) for that step's layout
     edgeVerbs verbs drawn on edges in that step
*/
window.KDBF_SCENES = {
  asOf: "Nov 19, 2026",

  credit: "Explaining <cite>“Kings Don’t Buy Flow”</cite> by Red Deer Investments",

  glossary: {
    "annuity": "A contract. You pay an insurer now; it pays you an income later.",
    "basis points": "Hundredths of a percent. 40 basis points is 0.40% a year.",
    "reinsurer": "An insurer for insurers. It takes over a block of policies and the assets backing them.",
    "capital charge": "The cushion of its own money an insurer must hold against an asset. Riskier asset, bigger cushion.",
    "CLO": "A bundle of a few hundred company loans cut into slices. Top slices are paid first. Bottom slices take losses first.",
    "PIK": "Payment in kind. The borrower pays interest with more debt instead of cash.",
    "AG 55": "A US rule adopted in August 2025. Insurers must test whether reserves they sent offshore are large enough.",
    "surrender charge": "A penalty for cashing out an annuity early. It expires after a set number of years.",
    "guaranty association": "A state safety net. It pays a failed insurer's policyholders, up to limits, and bills other insurers for the cost.",
    "rehabilitation": "A court-supervised takeover of a troubled insurer by its state regulator. Liquidation is the step after.",
    "forward flow": "An agreement to buy a lender's loans as it makes them.",
    "Qualified Jurisdiction": "A US regulators' list of trusted foreign regimes. Reinsurers based in one can post less collateral.",
    "collateral": "Assets set aside in a US trust so policyholders can be paid if the reinsurer cannot."
  },

  /* short names for the per-step source line; anything missing falls back to publisher + month */
  sourceShort: {
    "rd-pt1": "Red Deer, Part 1", "rd-pt2": "Red Deer, Part 2", "rd-pt3": "Red Deer, Part 3",
    "athene-10k-2025": "Athene 10-K, 2025",
    "apollo-athene-merger-2022": "Apollo 8-K, Jan 2022",
    "kkr-ga-2024": "KKR 8-K, Jan 2024",
    "bws-ael-2024": "Brookfield 6-K, May 2024",
    "fg-bis-ima-amend-2023": "F&G 8-K, Mar 2023",
    "blueowl-kam-close-2024": "Blue Owl 8-K, Jul 2024",
    "barclays-blackstone-2024": "Barclays, Feb 2024",
    "keycorp-blackstone-2024": "KeyCorp, Mar 2024",
    "ib-sp-offshore-1t-2025-05": "S&P via FT, May 2025",
    "ambest-offshore-affiliates-2025-06": "AM Best, Jun 2025",
    "govky-qj-2026-08": "Cayman government, Aug 2026",
    "athene-qj-letter-2026-11-03": "Athene letter to US regulators, Nov 2026",
    "ij-acl-petition-2026-09": "Insurance Journal, Sept 2026",
    "ambest-acap-2026-11-11": "AM Best, Nov 2026",
    "mayerbrown-clo-rbc-2026": "Mayer Brown, Jun 2026",
    "inn-ag55-2026-07": "InsuranceNewsNet, Jul 2026",
    "cima-insurance-stats-2026q3": "CIMA, Q3 2026",
    "ct-cid-phl-2026": "Connecticut Insurance Dept, Jul 2026",
    "inn-phl-2027-2026-07": "InsuranceNewsNet, Jul 2026",
    "cnbc-delaware-life-2026-08": "CNBC, Aug 2026",
    "esk-acap-2026-11-18": "The Esk, Nov 2026",
    "bhf-q3-2026-8k": "Brighthouse 8-K, Nov 2026"
  },

  /* Nodes this page adds. None is a firm; each says what it stands for. Not scored by the model. */
  extraNodes: [
    { id: "src-buyers", label: "Savers", role: "source", cluster: "public", generic: true,
      note: "Not a firm. Stands for the people who buy annuities. They pay now and get an income later." },
    { id: "src-borrowers", label: "Borrowers", role: "sink", cluster: "public", generic: true,
      note: "Not a firm. Stands for the airlines, fleet customers and other borrowers the lenders serve." },
    { id: "evt-pik", label: "Loans marked down", role: "event", cluster: "small_distressed", generic: true,
      note: "Not a firm. A what-if from Part 3. Borrowers who paid interest with more debt get marked down, and the CLO slices holding their loans lose value." },
    { id: "evt-call", label: "Cash squeeze", role: "event", cluster: "small_distressed", generic: true,
      note: "Not a firm. A what-if from Part 3. The insurer must post more collateral while policyholders leave, so it sells assets at bad prices. Nothing like this has been reported so far." }
  ],

  /* Edges this page adds, all examples or what-ifs (drawn dashed). */
  extraEdges: [
    { id: "x-buyers-athene", source: "src-buyers", target: "athene", type: "pays_premium", status: "inferred", phase: "current", illustrative: true,
      label: "pay premiums to", detail: "An example, not a sourced link. Savers pay an insurer now for an income later." },
    { id: "x-pk-borrowers", source: "pk-airfinance", target: "src-borrowers", type: "lends_to", status: "inferred", phase: "current", illustrative: true,
      label: "lends to", detail: "An example: the lender makes aircraft loans and leases to airlines." },
    { id: "x-donlen-borrowers", source: "donlen", target: "src-borrowers", type: "lends_to", status: "inferred", phase: "current", illustrative: true,
      label: "leases to", detail: "An example: the fleet lender leases vehicles to business customers." },
    { id: "x-pik-biii", source: "evt-pik", target: "arch-biii", type: "shock", status: "inferred", phase: "current", illustrative: true,
      label: "hits the CLO slices held by (what-if)", detail: "Red Deer's predicted chain, drawn on made-up firms. Bundled company loans lose value suddenly once unpaid interest is counted." },
    { id: "x-writer-call", source: "arch-writer", target: "evt-call", type: "shock", status: "inferred", phase: "current", illustrative: true,
      label: "must post collateral and pay out leavers (what-if)", detail: "The insurer tops up its US trust and pays policyholders who leave by selling assets that are hard to sell." },
    { id: "x-call-guaranty", source: "evt-call", target: "guaranty-assns", type: "shock", status: "inferred", phase: "current", illustrative: true,
      label: "if the insurer fails, policyholders turn to (what-if)", detail: "Guaranty associations pay only after a court orders liquidation, and only up to set limits." }
  ],

  /* Monograms drawn inside larger nodes (no logos). */
  monograms: {
    "apollo": "APO", "athene": "ATH", "kkr": "KKR", "global-atlantic": "GA", "brookfield": "BN", "american-national": "AN",
    "american-equity": "AEL", "argo": "AR", "blackstone": "BX", "everlake-life": "EV", "corebridge": "CB", "fg": "F&G",
    "carlyle": "CG", "fortitude-re": "FR", "ares": "ARS", "aspida": "ASP", "blue-owl": "BO", "kuvare": "KV",
    "lincoln-benefit": "LBL", "sixth-street": "6S", "talcott": "TAL", "eldridge": "EL", "security-benefit": "SB",
    "brighthouse": "BHF", "a-cap": "AC", "atlantic-coast-life": "ACL", "sentinel-security-life": "SSL",
    "southern-atlantic-re": "SAR", "777-partners": "777", "777-re": "7Re", "phl-variable": "PHL", "nassau-golden-gate": "NGG",
    "group-1001": "1001", "delaware-life": "DL", "clear-spring": "CS", "aquarian": "AQ", "arch-manager": "A1", "arch-writer": "A2",
    "arch-biii": "A3", "pk-airfinance": "PK", "donlen": "WH", "redding-ridge": "RR", "barclays": "BAR", "keycorp": "KEY",
    "us-naic": "US", "bermuda": "BM", "cayman": "KY", "guaranty-assns": "GA", "state-budgets": "$", "src-buyers": "", "src-borrowers": "",
    "evt-pik": "", "evt-call": ""
  },

  /* Home positions in a landscape world (x right, y down). The force layout settles around these once,
     deterministically; every step then reuses the same homes, so existing nodes never reshuffle.
     (Step 1 has its own `pose`; its five nodes move to these homes at step 2.) */
  layout: {
    "src-buyers": [-900, 40], "athene": [-640, 20], "apollo": [-650, -190],
    "pk-airfinance": [-860, -330], "donlen": [-700, -420], "redding-ridge": [-520, -360], "src-borrowers": [-900, -520],
    "kkr": [-840, 250], "global-atlantic": [-640, 260],
    "brookfield": [-760, 470], "american-national": [-940, 450], "american-equity": [-560, 470], "argo": [-820, 640],
    "blackstone": [-200, -330], "barclays": [-340, -500], "keycorp": [-120, -520],
    "everlake-life": [-340, -200], "corebridge": [-80, -150], "fg": [60, -300],
    "carlyle": [80, 40], "fortitude-re": [-60, 40],
    "bermuda": [-330, 170], "cayman": [130, 230], "us-naic": [180, 380],
    "ares": [280, -470], "aspida": [180, -330],
    "blue-owl": [480, -520], "kuvare": [660, -500], "lincoln-benefit": [560, -380],
    "sixth-street": [820, -380], "talcott": [880, -250],
    "eldridge": [440, -210], "security-benefit": [300, -120],
    "group-1001": [760, -100], "delaware-life": [640, -10], "clear-spring": [870, 10],
    "aquarian": [560, 150], "brighthouse": [420, 260],
    "nassau-golden-gate": [-300, 640], "phl-variable": [-40, 600],
    "a-cap": [560, 380], "atlantic-coast-life": [420, 560], "southern-atlantic-re": [200, 650],
    "sentinel-security-life": [740, 560], "777-partners": [840, 330], "777-re": [560, 770],
    "arch-manager": [1080, 420], "arch-writer": [980, 660], "arch-biii": [1200, 600],
    "evt-pik": [1260, 820], "evt-call": [900, 880],
    "guaranty-assns": [600, 920], "state-budgets": [300, 980]
  },

  /* Step 9 event list. `label` must match a scorecard.timeline label exactly; dates and sources come from there
     (`also` adds the sources of a second timeline entry). `{node}` is replaced by a button for `node`. */
  events: [
    { label: "PHL Variable enters rehabilitation", node: "phl-variable", head: "PHL Variable",
      text: "{node} goes into {term:rehabilitation}, run by Connecticut's regulator. Liquidation is expected in 2027 at the earliest." },
    { label: "Delaware Life and Clear Spring subpoenaed", node: "delaware-life", head: "Delaware Life and Clear Spring Life",
      text: "{node} receive grand jury subpoenas, disclosed later. No charges reported." },
    { label: "Atlantic Coast Life petition", node: "atlantic-coast-life", head: "Atlantic Coast Life",
      text: "South Carolina asks a court to take over {node} and Southern Atlantic Re. Still pending, in mediation." },
    { label: "Brighthouse deal outside date", node: "brighthouse", head: "Brighthouse",
      text: "Deadline for Aquarian's purchase of {node}. Three state approvals outstanding." }
  ],

  /* shock defaults (0..1) for the sliders, keyed by model.json scenario id */
  defaultSeverity: { pik_writedown: 0.8, ag55_collateral_call: 0.5, surrender_wave: 0.4 },
  defaultQJ: false,
  sliderLabel: { pik_writedown: "Loan write-downs", ag55_collateral_call: "Collateral call", surrender_wave: "Savers leaving" },

  steps: [
    {
      id: "flow", name: "The loop",
      title: "An annuity goes in. An aircraft loan comes out.",
      add: ["src-buyers", "athene", "apollo", "pk-airfinance", "src-borrowers"],
      edgeTypes: ["pays_premium", "lends_to", "owns", "manages_assets_for", "originates_for"],
      mode: "neutral", big: true,
      /* one left-to-right line for the money, Apollo above it */
      pose: { "src-buyers": [-245, 40], "athene": [-100, 40], "pk-airfinance": [100, 40], "src-borrowers": [245, 40], "apollo": [0, -105] },
      edgeVerbs: { "x-buyers-athene": "pay premiums", "apollo-owns-athene": "owns", "apollo-manages-athene": "invests its money",
                   "pk-airfinance-originates-for-athene": "makes loans for", "x-pk-borrowers": "lends to", "apollo-owns-pk-airfinance": "owns" },
      legend: ["money", "example"],
      body: [
        "<p>An annuity is a savings contract. You pay an insurer now, and it pays you an income later. Until then, the insurer invests your money.</p>",
        "<p><strong>Athene</strong> sells annuities. It is owned by <strong>Apollo</strong>, an investment firm, and Apollo decides where the money goes. Part of it goes to PK AirFinance, a lender Apollo also owns, which lends it to airlines.{cite:athene-10k-2025}</p>",
        "<p>Red Deer Investments argues, in a three-part series called <em>Kings Don’t Buy Flow</em> (parts {parts}), that firms owning this whole chain will beat firms that buy their loans from someone else. This page maps that argument and checks it against events up to November 2026.</p>"
      ]
    },
    {
      id: "kings", name: "The rush",
      title: "Every big manager went and got an insurer.",
      add: ["kkr", "global-atlantic", "brookfield", "american-national", "american-equity", "argo",
            "blackstone", "everlake-life", "corebridge", "fg", "carlyle", "fortitude-re", "ares", "aspida",
            "blue-owl", "kuvare", "lincoln-benefit", "sixth-street", "talcott", "eldridge", "security-benefit",
            "group-1001", "delaware-life", "clear-spring", "aquarian", "brighthouse"],
      edgeTypes: ["pays_premium", "lends_to", "owns", "manages_assets_for", "originates_for"],
      mode: "neutral",
      emphNew: true,
      legend: ["owns", "manages_assets_for", "money"],
      hero: { v: "75%", kind: "author", label: "of new annuities are sold by the 20 largest sellers, by Red Deer’s count.", cite: "rd-pt1" },
      body: [
        "<p>Apollo merged with Athene in 2022.{cite:apollo-athene-merger-2022} KKR finished buying Global Atlantic in January 2024.{cite:kkr-ga-2024} Brookfield closed its purchase of American Equity that May.{cite:bws-ael-2024}</p>",
        "<p>Other managers invest an insurer’s money without owning the insurer. Blackstone does this for F&amp;G.{cite:fg-bis-ima-amend-2023} Blue Owl does it for Lincoln Benefit Life, which belongs to Kuvare.{cite:blueowl-kam-close-2024}</p>",
        "<p>The fee for that work is about 0.4% a year, on Red Deer’s figures.{cite:rd-pt1} On $100 billion, that is $400 million. The business pays only at great size.</p>"
      ]
    },
    {
      id: "build-or-buy", name: "Build or buy",
      title: "The money has to keep moving.",
      add: ["donlen", "redding-ridge", "barclays", "keycorp"],
      edgeTypes: ["pays_premium", "lends_to", "owns", "manages_assets_for", "originates_for", "buys_flow_from"],
      mode: "neutral",
      emph: { nodes: ["apollo", "athene", "pk-airfinance", "donlen", "redding-ridge", "src-borrowers", "src-buyers", "blackstone", "barclays", "keycorp"],
              edgeTypes: ["originates_for", "buys_flow_from", "lends_to", "pays_premium"], dim: 0.28 },
      legend: ["badge", "originates_for", "buys_flow_from"],
      hero: { v: "$25B a year", kind: "model", label: "in new loans, just to keep $100B lent out. Assumes a loan lasts four years, Red Deer’s estimate.", cite: "rd-pt1:model" },
      body: [
        "<p>Loans get repaid, and repaid cash earns nothing until it is lent again. A manager can find new loans in two ways.</p>",
        "<ul class='defs'><li><strong>Build.</strong> Own the lenders. Apollo owns an aircraft lender, a fleet-leasing company and a {term:CLO} manager, and all three supply Athene.{cite:athene-10k-2025} Red Deer counts about 4,000 staff in Apollo’s lending businesses and about 6,000 in KKR’s.{cite:rd-pt1}</li><li><strong>Buy.</strong> Take loans another firm makes. Blackstone agreed to buy credit-card loans from Barclays and fund-finance loans from KeyCorp as those banks make them.{cite:barclays-blackstone-2024}{cite:keycorp-blackstone-2024} The trade calls this {term:forward flow}.</li></ul>",
        "<p>Red Deer’s title takes a side. A builder picks its own borrowers and can keep lending when markets shut. A buyer takes what the seller offers.</p>"
      ]
    },
    {
      id: "offshore", name: "Offshore",
      title: "Then the promises moved offshore.",
      add: ["bermuda", "cayman"],
      edgeTypes: ["pays_premium", "lends_to", "owns", "manages_assets_for", "originates_for", "buys_flow_from", "reinsures_to", "regulated_by"],
      mode: "neutral",
      emph: { nodes: ["bermuda", "cayman", "athene", "global-atlantic", "american-equity", "everlake-life", "fg", "security-benefit", "corebridge", "fortitude-re", "aspida"],
              edgeTypes: ["reinsures_to", "regulated_by"], dim: 0.28 },
      legend: ["reinsures_to", "regulated_by", "dashed"],
      hero: { v: "$1.1 trillion", kind: "reported", label: "of US life and annuity reserves were held by offshore reinsurers at the end of 2024.", cite: "ib-sp-offshore-1t-2025-05" },
      body: [
        "<p>An insurer can pass a block of policies, and the assets backing them, to a {term:reinsurer}. About 70% of what goes offshore goes to a reinsurer in the insurer’s own group.{cite:ambest-offshore-affiliates-2025-06}</p>",
        "<p>Offshore rules ask for a smaller safety cushion against the same promises, which leaves more money to invest. Bermuda was the first choice. After Bermuda tightened its rules, Red Deer writes, new business went to Cayman. One class of Cayman reinsurer licence needs <strong>$400,000</strong> of capital. The standard class needs <strong>$50 million</strong>.{cite:rd-pt3}</p>",
        "<p>US regulators do not yet treat Cayman as a trusted regime, so an insurer sending policies there must keep full {term:collateral} in a US trust. Cayman applied for trusted status in August 2026.{cite:govky-qj-2026-08}</p>"
      ]
    },
    {
      id: "weak-link", name: "The weak link",
      title: "Smaller managers can’t build, so they buy.",
      add: ["a-cap", "atlantic-coast-life", "southern-atlantic-re", "sentinel-security-life", "777-partners", "777-re",
            "nassau-golden-gate", "phl-variable", "arch-manager", "arch-writer", "arch-biii", "guaranty-assns", "state-budgets", "us-naic"],
      edgeTypes: "all",
      mode: "neutral",
      emphNew: true, emphDim: 0.4,
      legend: ["archShort", "losses_flow_to", "dotted"],
      hero: { v: "9.5% → 3–4%", kind: "author", label: "the cushion an insurer must hold against the same company loans: owned outright, then repackaged as CLO slices. Red Deer’s figures.", cite: "rd-pt3" },
      body: [
        "<p>A manager with less than about $30 billion cannot afford its own lenders, Red Deer argues.{cite:rd-pt3} Its insurer buys loans already packaged, as slices of {term:CLO}s. It did not make those loans and cannot renegotiate them when a borrower struggles.</p>",
        "<p>The capital rules made the packaged version cheaper to hold. The savers’ money can also leave quickly. Red Deer says many of these policies are past their {term:surrender charge} period, so holders can cash out without penalty.{cite:rd-pt3}</p>",
        "<p>The three dashed circles are invented examples, not firms. Every real firm added here has a public regulatory or court record, or owns an insurer that does. At the bottom is who pays when an insurer fails: state {term:guaranty association|guaranty associations}, then state budgets.</p>"
      ]
    },
    {
      id: "shock", name: "The shock",
      title: "Now stress it.",
      edgeTypes: "all",
      mode: "stress", shockPanel: true,
      legend: ["stress", "elevated", "severe"],
      hero: "live",
      body: [
        "<p>Red Deer names three ways this goes wrong. Each has a slider below.</p>",
        "<ul class='defs'><li><strong>Loans are written down.</strong> Some borrowers pay interest with more debt instead of cash, known as {term:PIK}. Their loans look healthy until the day they are marked down.</li><li><strong>Collateral is called.</strong> A US rule, {term:AG 55}, tests whether reserves sent offshore are large enough. An insurer that falls short may have to add more.</li><li><strong>Savers leave.</strong> Policyholders cash out and the insurer has to find the money.</li></ul>",
        "<p>The colours come from a simple model built for this page, using estimated inputs. They show where pressure would collect. They do not predict what will happen to any firm.</p>"
      ]
    },
    {
      id: "one-thread", name: "One loss",
      title: "Follow one loss.",
      add: ["evt-pik", "evt-call"],
      edgeTypes: "all",
      mode: "stress",
      thread: { nodes: ["evt-pik", "arch-biii", "arch-writer", "evt-call", "guaranty-assns", "state-budgets"],
                edges: ["x-pik-biii", "arch-writer-reinsures-to-arch-biii", "x-writer-call", "x-call-guaranty", "guaranty-assns-losses-to-state-budgets"],
                items: [
                  { node: "evt-pik", head: "A loan goes bad.", text: "The borrower had been paying interest with more debt, so the loss shows up late and all at once." },
                  { node: "evt-pik", head: "A CLO slice absorbs it.", text: "A thin slice near the bottom of the bundle can lose most of its value." },
                  { node: "arch-biii", head: "A Cayman reinsurer holds that slice.", text: "It has little capital, so the shortfall returns to the insurer that sent it the policies." },
                  { node: "arch-writer", head: "The insurer needs cash.", text: "It must add collateral while savers are cashing out, so it sells what it can." },
                  { node: "guaranty-assns", head: "If it fails, guaranty funds pay.", text: "State funds cover policyholders up to set limits." },
                  { node: "state-budgets", head: "The bill moves on.", text: "The funds charge other insurers, who deduct the cost from their state taxes. Part of it lands on state budgets." }
                ] },
      focusThread: true,
      legend: ["stress", "shock", "arch"],
      body: [
        "{thread}",
        "<p>This is the chain Red Deer predicts, drawn on invented firms.{cite:rd-pt3} No real insurer has failed this way.</p>"
      ]
    },
    {
      id: "dampened", name: "The big groups",
      title: "The big groups take the same shock better.",
      remove: ["evt-pik", "evt-call"],
      edgeTypes: "all",
      mode: "stress", shockPanel: true,
      emph: { nodes: ["apollo", "athene", "pk-airfinance", "donlen", "redding-ridge", "kkr", "global-atlantic", "brookfield", "american-national", "american-equity", "argo"],
              dim: 0.22 },
      legend: ["stress", "elevated", "severe"],
      body: [
        "<p>A firm that made a loan can renegotiate it. A firm that holds a slice of someone else’s loan can only sell. The model gives the integrated groups credit for that, and for holding more capital.</p>",
        "<p>Here is where each one lands at the current slider settings.</p>",
        "{live:integrated}",
        "<p>The largest groups have also taken a side on the rules. On November 3, 2026, Athene asked US regulators not to grant Cayman trusted status until gaps in its regime are closed.{cite:athene-qj-letter-2026-11-03}</p>"
      ]
    },
    {
      id: "what-happened", name: "The record",
      title: "What happened next.",
      edgeTypes: "all",
      mode: "status",
      emph: { nodes: ["atlantic-coast-life", "southern-atlantic-re", "a-cap", "phl-variable", "delaware-life", "clear-spring", "cayman"],
              dim: 0.22 },
      legend: ["status", "dotted"],
      hero: { v: "30% vs 10%", kind: "reported", label: "Atlantic Coast Life’s holdings of low-rated private credit and unrated loans, against its agreed limit. South Carolina’s regulator alleges this. The insurer denies it.", cite: "ij-acl-petition-2026-09" },
      body: [
        "<p><strong class='lab__h lab__h--yes'>What held up.</strong> The first insurer in trouble fits Red Deer’s description: a small manager’s annuity seller, holding credit that manager arranged. South Carolina asked a court to take over {node:atlantic-coast-life|Atlantic Coast Life} in September 2026. The case is in mediation.{cite:esk-acap-2026-11-18} AM Best now rates it C- (Weak).{cite:ambest-acap-2026-11-11}</p>",
        "<p>The rules moved too. From the end of 2026, the capital charge on a thin, low-rated CLO slice rises from 2.2% to 15%.{cite:mayerbrown-clo-rbc-2026}</p>",
        "<p><strong class='lab__h lab__h--no'>What did not.</strong> The trouble began inside the US, with no Cayman reinsurer involved. No wave of collateral calls has followed.{cite:inn-ag55-2026-07} Cayman licensed 28 new insurers in the first nine months of 2026.{cite:cima-insurance-stats-2026q3}</p>",
        "<p>Two older cases are still running. Connecticut has controlled {node:phl-variable|PHL Variable} since May 2024 and expects to liquidate it, in 2027 at the earliest.{cite:ct-cid-phl-2026} {node:delaware-life|Delaware Life} and Clear Spring Life received grand jury subpoenas in February 2026. No charges have been reported.{cite:cnbc-delaware-life-2026-08}</p>",
        "<blockquote class='pull'>So far the failures have come one firm at a time.</blockquote>"
      ]
    },
    {
      id: "method", name: "Method",
      title: "How this was made.",
      edgeTypes: "all",
      mode: "neutral",
      legend: ["size", "dotted"],
      body: [
        "<p><strong>The links</strong> come from company filings, regulators and the press. Click a firm or a line to see its source. Solid lines are documented. Dashed lines are inferred, or examples.</p>",
        "<p><strong>The argument</strong> and many of the figures are Red Deer’s.{cite:rd-pt1}{cite:rd-pt2}{cite:rd-pt3} The small numbers in the text are sources: <span class='c-author'>gold</span> for Red Deer’s figures, <span class='c-reported'>blue</span> for outside reporting, <span class='c-model'>violet</span> for this page’s own arithmetic.</p>",
        "<p><strong>The stress colours</strong> come from a simple model. Each firm has five estimated inputs. A shock hits some of them, travels along ownership and reinsurance links, and fades at each step. Firms that can rework bad loans, or that hold more capital, take less. The map shows bands, never percentages, because the inputs are estimates.</p>",
        "<p class='note'>Data runs to November 19, 2026. A circle’s size shows how many links it has on this map, not how big the firm is. Regulator petitions are allegations, not findings. This page is independent of Red Deer Investments and of every firm shown. Nothing on it is a forecast or investment advice.</p>"
      ]
    }
  ]
};
