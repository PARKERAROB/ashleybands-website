// Director's direct contact — use for "contact Mr. Parker directly" CTAs.
// Stays as Mr. Parker even after sponsorship lead handoff to a booster parent.
export const SPONSOR_CONTACT = {
  director: "Robert A. Parker",
  title: "Director of Bands",
  email: "robert.parker@nhcs.net",
  phone: "910-790-2360",
  school: "Ashley High School",
  address: "555 Halyburton Memorial Parkway",
  cityStateZip: "Wilmington, NC 28412",
  ein: "20-5605218",
  boosterOrg: "AHS Band Boosters",
  sponsorsUrl: "ashleybands.com/sponsors"
};

// Where sponsor submissions, family handoffs, logo files, and intake go.
// Today: Mr. Parker. Future: hand off to a booster sponsorship lead by changing
// this single constant. Ideally point to a permanent alias (e.g.,
// sponsorship@ahsbands.org) so the handoff is invisible to sponsors.
export const SPONSOR_LEAD = {
  name: "Mr. Parker",
  email: "robert.parker@nhcs.net"
};

export const TIERS = [
  {
    name: "Friend",
    amount: 250,
    label: "$250",
    benefits: [
      "Concert program listing",
      "Website listing on ashleybands.com/sponsors",
      "Tax receipt with deductible amount"
    ],
    best: false
  },
  {
    name: "Patron",
    amount: 750,
    label: "$750",
    benefits: [
      "All Friend benefits",
      "Sponsor t-shirt (if confirmed by Aug 5)",
      "Logo in concert program"
    ],
    best: false
  },
  {
    name: "Premier",
    amount: 1500,
    label: "$1,500",
    benefits: [
      "All Patron benefits",
      "Framed thank-you photo (delivered at recognition night)",
      "Logo on equipment trailer",
      "1 PA read at home football games",
      "Sponsor recognition night invitation (2 tickets)"
    ],
    best: true,
    tag: "Best value"
  },
  {
    name: "Legacy",
    amount: 3000,
    label: "$3,000+",
    benefits: [
      "All Premier benefits",
      "10″ x 10″ banner at home games",
      "3 PA reads at home games",
      "Featured Spotlight Sponsor social post with reach numbers",
      "Custom recognition opportunity (e.g., pep band at your storefront)"
    ],
    best: false
  }
];

export const MULTI_YEAR_DISCOUNT_NOTE =
  "Sponsors who commit to a 3-year tier partnership receive 10% off the annual rate.";

export const ADOPT_BANDS = [
  {
    name: "Band 1",
    range: "$2,500 – $4,999",
    typical: "Entry-tier student instruments",
    examples: [
      { instrument: "Flute", model: "YFL-362", price: "~$2,550" },
      { instrument: "Clarinet (Bb, student)", model: "YCL-450", price: "~$2,800" },
      { instrument: "Alto Saxophone", model: "YAS-280", price: "~$3,600" },
      { instrument: "Trombone (intermediate)", model: "YSL-620", price: "~$4,317" },
      { instrument: "Bass Clarinet", model: "YCL-221", price: "~$4,080" },
      { instrument: "Mellophone (marching)", model: "YMP-204M", price: "~$3,500" },
      { instrument: "Marching Baritone", model: "YBH-301M", price: "~$4,800" }
    ]
  },
  {
    name: "Band 2",
    range: "$5,000 – $9,999",
    typical: "Mid-tier and pro student instruments",
    examples: [
      { instrument: "Tenor Saxophone", model: "YTS-26", price: "~$5,200" },
      { instrument: "Oboe (student)", model: "YOB-241", price: "~$5,800" },
      { instrument: "French Horn (single F/Bb)", model: "Holton H379", price: "~$6,593" },
      { instrument: "Clarinet (Bb, pro wood)", model: "YCL-650", price: "~$6,200" },
      { instrument: "Trumpet (pro)", model: "YTR-8335", price: "~$7,800" },
      { instrument: "Euphonium (compensating)", model: "YEP-321", price: "~$7,500" },
      { instrument: "Marching Euphonium", model: "YEP-202M", price: "~$5,400" }
    ]
  },
  {
    name: "Band 3",
    range: "$10,000 and up",
    typical: "Major instruments",
    examples: [
      { instrument: "Baritone Saxophone", model: "YBS-480", price: "~$10,182" },
      { instrument: "Bassoon (student)", model: "YFG-411", price: "~$11,500" },
      { instrument: "English Horn", model: "YEH-841", price: "~$13,800" },
      { instrument: "Marching Tuba", model: "YBB-202MS", price: "~$12,400" },
      { instrument: "Sousaphone", model: "YSH-411S", price: "~$15,348" }
    ]
  }
];

export const ADOPT_PACKAGE_INCLUDES = [
  "The instrument (quality Yamaha, or named equivalent for instruments Yamaha does not make)",
  "Required accessories (mouthpiece, ligature, reeds, oils, mutes, case if not included)",
  "5-year maintenance reserve sized at one-third of purchase price, based on a 15-year instrument lifecycle"
];

export const ADOPT_SOLE_SPONSOR_BENEFITS = [
  "Brass plaque on the instrument case with your name, in service for the life of the instrument (typically 15 years)",
  "Named in the concert program's “Instruments Sponsored By” section every year the instrument is in use",
  "Listed on the permanent Instrument Donor Wall in the band room",
  "Annual Instrument Reveal photo packet with the student playing your sponsored instrument",
  "Personal thank-you note from Mr. Parker and from the student",
  "Invitation to the annual Sponsor Recognition Night (2 tickets)"
];

export const WHAT_SPONSORSHIP_FUNDS = [
  "Marching band season for ~70 students",
  "Instructional staff beyond county budget",
  "Transportation to competitions and games",
  "Scholarships so no student misses the season over cost",
  "The next instrument in our 10-year capital plan"
];

export const COVER_LETTER_BODY = [
  {
    heading: "Where business sponsorships actually go",
    paragraphs: [
      "Our students do the short-term fundraising work themselves. They raise money for their marching band season, their trip fees, the specific instrument or event in front of them. They are good at it because the goal is concrete and tied directly to them.",
      "What students cannot raise on their own is the program's operating capital: the gap between what the county provides and what it actually costs to run a serious public-school music program. That gap covers instructional staff, instruments, production capacity, replacement cycles. It is the structural foundation that makes everything the students do possible.",
      "Business sponsorships fill that gap. Your support is not replacing a student's trip fee. It is keeping the program operating at the level our students deserve."
    ]
  },
  {
    heading: "Our long-term goal",
    paragraphs: [
      "I have been a band director for 20 years. By the time I retire in 2036, my goal is for every student in the Ashley band program to have the option of using a quality Yamaha instrument. Most of our school-owned inventory is older than the students playing it. Some of it is older than I am.",
      "We are not trying to fundraise our way out of one bad season. We are trying to rebuild the inventory of a serious public-school music program over the next ten years, so the students who come after these ones inherit something stronger than what we inherited.",
      "A $2,000 business sponsorship contributes meaningfully to that work in a way that family donations and group fundraisers cannot. Sponsorships scale. Bake sales do not."
    ]
  },
  {
    heading: "Two ways to give",
    paragraphs: [
      "Sponsors can support the program through whichever path fits how you want to give. Both are needed every year, and both are honored.",
      "**Tier sponsorships** support program operations: instructional staff, transportation, show production, uniforms, and the scholarships that keep students on the field when families cannot cover the full season cost. Tier sponsors receive visibility and recognition that scales with the level. The full benefits matrix is in this packet.",
      "**Adopt-an-Instrument** is our capital track toward the 2036 vision. Gifts of $2,500 or more contribute to that year's instrument purchases. Donors who fully sponsor a single instrument receive a brass plaque on the case with their name in service for the life of the instrument. All Adopt-an-Instrument donors receive an annual photo packet of every instrument purchased that year, with students playing them, and attribution to the specific instrument or instruments their gift contributed toward.",
      "We are most interested in long-term partners. The strongest sponsorships are not one-year transactions. They are relationships that grow with the program and grow your visibility in our community alongside it. Sponsors who commit to a 3-year tier partnership receive 10% off the annual rate."
    ]
  }
];

export const TAX_LANGUAGE_SHORT =
  "The AHS Band Boosters is a registered 501(c)(3) educational and charitable organization. Federal Tax ID: 20-5605218. All contributions are tax-deductible to the maximum extent allowed by law.";

export const TAX_LANGUAGE_FULL = [
  "Sponsorships that include only acknowledgment-style benefits (logos, name listings, banners, program mentions, PA reads, website listing, social posts) qualify as IRS qualified-sponsorship payments. The full sponsorship amount is tax-deductible.",
  "Sponsorships that include tangible benefits (apparel, framed photos, event tickets, custom items) reduce the deductible portion by the fair market value of those benefits. Per IRS quid-pro-quo disclosure rules, every receipt for a gift over $75 with tangible benefits will include the FMV of the benefits and the deductible portion of the contribution.",
  "For all gifts, your written receipt will confirm the deductible amount."
];
