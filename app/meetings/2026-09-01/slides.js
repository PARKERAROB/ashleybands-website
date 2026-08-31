export const meetingSlides = [
  {
    id: "welcome",
    kind: "cover",
    section: "Welcome",
    kicker: "Tuesday, September 1, 2026",
    title: "Ashley Bands Booster Meeting",
    subtitle: "Carnegie Hall • CFS Mattress Fundraiser • Family Actions",
    detail: "Minnie Evans Arts Center • 6:30-7:30 p.m.",
    image: "/528048622_10108973219927428_7681318735311321118_n.jpg"
  },
  {
    id: "run-of-show",
    kind: "agenda",
    section: "Welcome",
    kicker: "Tonight",
    title: "We have two important decisions to move forward",
    entries: [
      ["6:30", "Marching rehearsal ends • Booster welcome and family arrival"],
      ["6:45", "Carnegie Hall trip plan and commitment"],
      ["7:15", "CFS Mattress Fundraiser with Clint Stovall"],
      ["7:30", "Main meeting ends • individual questions follow"]
    ]
  },
  {
    id: "carnegie-story",
    kind: "photo",
    section: "Carnegie Hall",
    kicker: "The opportunity",
    title: "Both Ashley concert ensembles were selected for Carnegie Hall",
    body: "The 2027 performance can mark the next chapter of a program that has spent seven years rebuilding after COVID.",
    image: "/656637421_1325880026241163_8640066925134763727_n.jpg",
    caption: "Wind Ensemble in Minnie Evans Arts Center"
  },
  {
    id: "trip-snapshot",
    kind: "list",
    section: "Carnegie Hall",
    kicker: "Working trip",
    title: "Four days in New York built around performance",
    lead: "March 23-26, 2027 • Carnegie performances Thursday, March 25",
    bullets: [
      "Round-trip charter transportation and three hotel nights",
      "Carnegie Hall performance and AIM master class",
      "Broadway production",
      "Statue of Liberty and Ellis Island",
      "Empire State Building or another structured activity",
      "Three dinners, two lunches, and breakfasts on your own"
    ],
    source: "Working itinerary from the preliminary WorldStrides proposal; final itemization remains open."
  },
  {
    id: "real-not-final",
    kind: "split",
    section: "Carnegie Hall",
    kicker: "Where we are",
    title: "This is a real opportunity, but not yet a finished trip",
    left: {
      label: "Confirmed",
      items: [
        "Both ensemble selections",
        "March 23-26 travel dates",
        "$2,000 deposit per performance spot",
        "January 7 final vendor deadline"
      ]
    },
    right: {
      label: "Still being finalized",
      items: [
        "Corrected itemized quote",
        "Below-minimum surcharges",
        "FRP election mechanics",
        "October payment and district approvals"
      ]
    }
  },
  {
    id: "two-paths",
    kind: "split",
    section: "Carnegie Hall",
    kicker: "Participation decision",
    title: "The trip can move forward in one of two ways",
    left: {
      label: "Both ensembles",
      number: "40 + 40",
      items: [
        "At least 40 confirmed Wind Ensemble performers",
        "At least 40 confirmed Concert Band performers",
        "Two separate Carnegie performances"
      ]
    },
    right: {
      label: "Wind Ensemble only",
      number: "50",
      items: [
        "At least 50 Mr. Parker-approved performers",
        "Current Wind Ensemble performers are preapproved",
        "Selected Concert Band students may be added"
      ]
    }
  },
  {
    id: "both-ensembles",
    kind: "stats",
    section: "Carnegie Hall",
    kicker: "Path one",
    title: "Both ensembles require strong participation from both groups",
    stats: [
      ["40", "Wind Ensemble"],
      ["40", "Concert Band"],
      ["80", "total confirmations"]
    ],
    note: "WorldStrides states a 50-performer minimum for each group. A group below 50 receives a surcharge, so the final amount must be added to the trip budget.",
    source: "Concert Band and Wind Ensemble acceptance letters, August 24, 2026."
  },
  {
    id: "wind-ensemble-only",
    kind: "list",
    section: "Carnegie Hall",
    kicker: "Path two",
    title: "Wind Ensemble only requires 50 approved performers",
    lead: "Current Wind Ensemble performers are preapproved.",
    bullets: [
      "Concert Band students may request consideration",
      "Approval depends on instrumentation needs",
      "Students must demonstrate the readiness to prepare Wind Ensemble literature",
      "Interest or a $50 deposit does not guarantee approval",
      "An unapproved Concert Band student's deposit will be refunded"
    ]
  },
  {
    id: "friday-deadline",
    kind: "hero-number",
    section: "Carnegie Hall",
    kicker: "First family deadline",
    title: "Confirmation and conditional deposit",
    number: "$50",
    subtitle: "Due Friday, September 4",
    body: "Scan now to submit the family commitment and pay. The deposit remains refundable until Ashley confirms the applicable performer threshold and pays the WorldStrides group deposit. It then becomes nonrefundable and credits the student's trip balance.",
    url: "https://ashleybands.com/carnegie-2027/commit",
    urlLabel: "ashleybands.com/carnegie-2027/commit"
  },
  {
    id: "deposit-math",
    kind: "split",
    section: "Carnegie Hall",
    kicker: "Why $50 works",
    title: "The family deposits fund the ensemble decision",
    left: {
      label: "Both ensembles",
      number: "$4,000",
      items: ["80 confirmations × $50", "Covers both $2,000 performance deposits"]
    },
    right: {
      label: "Wind Ensemble only",
      number: "$2,500",
      items: ["50 confirmations × $50", "$2,000 deposit + $500 trip credit"]
    }
  },
  {
    id: "cost-frame",
    kind: "stats",
    section: "Carnegie Hall",
    kicker: "Cost, honestly",
    title: "The $2,000 question is our fallback, not our goal",
    stats: [
      ["$2,500", "all-in planning figure"],
      ["$2,000", "worst-case family test"],
      ["$500", "dream family total"]
    ],
    note: "We need to know whether a family could still make the trip work if fundraising disappoints. We are not issuing a $2,000 bill tonight, and we do not want $2,000 to be the final family cost."
  },
  {
    id: "payment-schedule",
    kind: "schedule",
    section: "Carnegie Hall",
    kicker: "Fallback family schedule",
    title: "Only the $50 commitment is due now",
    entries: [
      ["SEP 4", "$50", "Conditional deposit"],
      ["SEP 15", "≤ $450", "Fallback first payment"],
      ["OCT 15", "≤ $500", "Fallback second payment"],
      ["NOV 15", "≤ $500", "Fallback third payment"],
      ["DEC 15", "≤ $500", "Fallback final payment"]
    ],
    note: "The later amounts are the maximum working path if the trip is activated and sponsorship falls short. Committed outside funding can reduce later family payments."
  },
  {
    id: "frp",
    kind: "hero-number",
    section: "Carnegie Hall",
    kicker: "Optional protection",
    title: "The planned FRP family option",
    number: "$300",
    subtitle: "$279 current estimate • remainder credits the trip",
    body: "WorldStrides says FRP must be elected within 30 days of initial group registration. The fee is added to the group account when purchased and becomes nonrefundable after 24 hours. The exact Ashley deadline and traveler-by-traveler election process still need written confirmation.",
    source: "WorldStrides group-billed terms and Ashley's in-progress Letter of Understanding."
  },
  {
    id: "funding-gap",
    kind: "stats",
    section: "Carnegie Hall",
    kicker: "The dream",
    title: "Can we make this a $500 trip for students?",
    stats: [
      ["$2,500", "planning cost per student"],
      ["$500", "dream family total"],
      ["$2,000", "outside support per student"]
    ],
    note: "That is an ambitious outside-funding target of about $100,000 for 50 students or $160,000 for 80, before unresolved adult costs. It is a goal, not a promise."
  },
  {
    id: "sponsorship-push",
    kind: "stats",
    section: "Carnegie Hall",
    kicker: "Now through October 15",
    title: "Let's ask for the gifts that can change this trip",
    stats: [
      ["$2,000", "a local supporter"],
      ["$5,000", "a business or organization"],
      ["$10,000", "a foundation grant or lead gift"]
    ],
    note: "We will keep asking through December and into January. The more support committed by October 15, the sooner we can lower the remaining family burden."
  },
  {
    id: "open-doors",
    kind: "list",
    section: "Carnegie Hall",
    kicker: "Tell the story • open the door",
    title: "One introduction can change this trip",
    lead: "Ashley students were selected for the National Band & Orchestra Festival at Carnegie Hall. That is a rare high-school opportunity worth investing in.",
    bullets: [
      "Seek WECT and local newspaper coverage",
      "Pursue Landfall, endowment funds, arts funders, and community foundations",
      "Ask local businesses, civic groups, organizations, and major donors",
      "Tell the seven-year rebuilding story and Ashley's planned 2027 return to Carmina Burana",
      "Connect Mr. Parker with the person who can say yes to a meaningful gift"
    ]
  },
  {
    id: "funding-boundaries",
    kind: "split",
    section: "Carnegie Hall",
    kicker: "Keep the purposes clear",
    title: "Carnegie and Marching Band remain separate",
    left: {
      label: "Marching Band",
      items: [
        "Current marching funding goals still apply",
        "Marching needs cannot subsidize the trip",
        "The mattress fundraiser currently supports the active marching goal"
      ]
    },
    right: {
      label: "Carnegie",
      items: [
        "Trip deposits and payments stay in a separate ledger",
        "Trip sponsorship must be approved and documented",
        "No family cost reduction is promised before funding is secured"
      ]
    }
  },
  {
    id: "chaperones",
    kind: "list",
    section: "Carnegie Hall",
    kicker: "Travel supervision",
    title: "The working model keeps students supervised and the main coach efficient",
    lead: "Main coach: up to 54 students plus Mr. Parker",
    bullets: [
      "Use seven approved adults for 54 students as the conservative working minimum",
      "Mr. Parker is attending and an administrator will be requested",
      "Additional approved chaperones are welcome when travel, lodging, and supervision work",
      "Some chaperones may travel separately",
      "The final district ratio and approval route remain pending"
    ],
    source: "Current NHCS policy review and the still-public 2018 overnight-trip procedure."
  },
  {
    id: "open-items",
    kind: "list",
    section: "Carnegie Hall",
    kicker: "Before final registration",
    title: "These questions still require written answers",
    bullets: [
      "Final itemized quote and adult pricing",
      "Surcharge for an ensemble below 50 performers",
      "FRP deadline, group election, and payment timing",
      "Negotiated October installment amount",
      "School approval, signer, chaperone plan, and economic-access process"
    ],
    lead: "An open question is not a reason to guess. It is a reason to label the plan correctly."
  },
  {
    id: "family-action",
    kind: "action",
    section: "Carnegie Hall",
    kicker: "What families need to do",
    title: "Give Ashley an honest answer by Friday",
    actions: [
      ["1", "Answer the fallback", "Could your family still make the trip work if its responsibility reaches $2,000?"],
      ["2", "Confirm", "Return the trip commitment and $50 conditional deposit by September 4."],
      ["3", "Open one door", "Connect us with a business, foundation, media contact, organization, or major donor."],
      ["4", "Help tell the story", "Carnegie Hall, the national festival, seven years of rebuilding, and what this means."]
    ],
    note: "Families may scan and complete the connected $50 commitment now, or return to it from ashleybands.com or the Family Portal by Friday."
  },
  {
    id: "mattress-section",
    kind: "section",
    section: "CFS Mattress Fundraiser",
    kicker: "Next up • 7:15 p.m.",
    title: "CFS Mattress Fundraiser",
    subtitle: "One day • one gym • one family to invite",
    theme: "cfs"
  },
  {
    id: "mattress-facts",
    kind: "flyer",
    section: "CFS Mattress Fundraiser",
    kicker: "Save the date",
    title: "Saturday, September 26 • 10:00 a.m.-4:00 p.m.",
    image: "/fundraising/mattress-vip-flyer.jpg",
    bullets: [
      "Ashley High School full-size gym",
      "More than 25 mattress models to try",
      "Prices start at $259",
      "Financing and delivery are available",
      "Purchases support Ashley Bands"
    ],
    source: "CFS event page and vendor materials received August 30, 2026."
  },
  {
    id: "one-family",
    kind: "qr",
    section: "CFS Mattress Fundraiser",
    kicker: "The most important family action",
    title: "Find your one family",
    body: "Think of one household that may need a mattress. A friend, relative, coworker, or neighbor. Invite them personally and send them the AshleyBands fundraiser page.",
    url: "https://ashleybands.com/fundraising/mattress",
    urlLabel: "ashleybands.com/fundraising/mattress"
  },
  {
    id: "student-credit",
    kind: "flyer",
    section: "CFS Mattress Fundraiser",
    kicker: "Supporting a student",
    title: "Use the referral flyer so the student receives credit",
    image: "/fundraising/mattress-referral-flyer.jpg",
    bullets: [
      "Write the student's name in the Credit goes to field",
      "Bring the referral flyer to the event",
      "The flyer includes 20% off accessories with a mattress purchase",
      "Always share it with the dated Ashley event information"
    ]
  },
  {
    id: "vip",
    kind: "hero-number",
    section: "CFS Mattress Fundraiser",
    kicker: "VIP audience",
    title: "Invite the people who serve our community",
    number: "10%",
    subtitle: "off mattresses over $699",
    body: "The CFS VIP offer is for faculty, staff, police, fire, EMS, and military guests. Share the Ashley event flyer so the date, time, location, and offer stay together.",
    source: "CFS VIP flyer received August 30, 2026."
  },
  {
    id: "cfs-video",
    kind: "video",
    section: "CFS Mattress Fundraiser",
    kicker: "CFS presentation",
    title: "How the mattress fundraiser works",
    fallback: "https://vimeo.com/806462880",
    buttonLabel: "Open the 1:07 CFS family video",
    note: "Clint Stovall • clint.stovall@cfsbeds.com • (919) 215-9796"
  },
  {
    id: "popcorn",
    kind: "list",
    section: "Current Fundraising",
    kicker: "Also open now",
    title: "Perry's Popcorn closes Wednesday, September 9",
    lead: "One online link • direct shipping • student credit",
    bullets: [
      "Choose Ashley HS Band at checkout",
      "Enter the student's full name in the seller note",
      "Share the store with relatives, neighbors, and coworkers",
      "Ashley Bands receives 40% of online orders"
    ],
    source: "Current AshleyBands fundraiser page."
  },
  {
    id: "dates",
    kind: "schedule",
    section: "Next Steps",
    kicker: "Put these dates on the calendar",
    title: "The next four weeks",
    entries: [
      ["SEP 4", "$50", "Carnegie confirmation deadline"],
      ["SEP 9", "ONLINE", "Perry's Popcorn closes"],
      ["SEP 15", "$450", "Carnegie balance payment if activated"],
      ["SEP 26", "10-4", "CFS Mattress Fundraiser"]
    ]
  },
  {
    id: "close",
    kind: "close",
    section: "Questions",
    kicker: "The responsible decision starts with an honest count",
    title: "Questions and next-phase planning",
    subtitle: "Mr. Parker and Booster President Hannah Hales will remain after 7:30 for individual questions."
  }
];
