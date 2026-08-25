/**
 * KAVAN STUDIO — design works and media, expanded to detail records.
 *
 * DESIGN_WORKS keeps the id/slug/title/category/year/blurb of the index rows
 * in studio.js and adds everything a detail page needs.
 * MEDIA keeps the id/title/outlet/type/year/blurb and adds a slug, the related
 * project slug from projects.js, the quoted passage, and the studio note.
 */

export const DESIGN_WORKS = [
  {
    id: 1,
    slug: "kavan-identity",
    title: "Kavan Studio Identity",
    category: "Branding",
    year: 2021,
    blurb: "A wordmark built on a single drafting arc, and the drawing conventions that follow from it.",
    client: "Kavan Studio",
    scope: "Wordmark, drawing standard, stationery",
    materials: "Letterpress on uncoated stock, one ink",
    team: ["Golnaz Bahrami", "Milad Yazdani", "Tara Sadeghpour"],
    status: "Completed",
    description:
      "For fourteen years the studio signed its drawings in whatever typeface the software offered. " +
      "The name means the arc a thing travels through, and that seemed worth drawing rather than setting. " +
      "We built the wordmark on a single compass sweep struck at one radius, with the letters sitting on it " +
      "the way brick sits on a shallow arch. Nothing else was invented.\n\n" +
      "The arc then became a rule. It sets the corner radius on the drawing sheet, the curve of the title " +
      "block, and the sweep cut into the studio door handle. Everything is printed letterpress on uncoated " +
      "stock so the mark holds a shallow bite you can feel. Contractors recognise our drawings across a site " +
      "table before they read the name, which was the whole point.",
    facts: [
      { k: "Edition", v: "In use since 2021" },
      { k: "Typeface", v: "Drawn, single weight" },
      { k: "Print", v: "Letterpress, one colour" },
      { k: "Drawn at", v: "1:1" },
    ],
  },

  {
    id: 2,
    slug: "qeytarieh-brick-bond",
    title: "Qeytarieh Brick Bond",
    category: "Detail Design",
    year: 2024,
    blurb: "A shading bond developed with the masons, turned out of plane by twenty degrees.",
    client: "Private",
    scope: "Bond pattern, corner conditions, sample panels",
    materials: "Handmade Tehran brick, lime mortar",
    team: ["Kaveh Daneshvar", "Sahar Iravani", "Ramin Panahi"],
    status: "Completed",
    description:
      "The south face of the Qeytarieh building needed shade without losing the view to the city. " +
      "A solid screen would have closed the apartments; a louvre would have rusted and dated. We asked " +
      "whether the brick could do it alone. Turning every third header twenty degrees out of plane casts " +
      "a shadow across the course below and leaves the sightline from inside untouched.\n\n" +
      "Three sample panels were built in the yard and left standing through a full summer before anything " +
      "was ordered. The masons set the angle with a timber jig cut in the workshop, one jig per bay, so the " +
      "work stayed fast. Mortar is raked back to deepen the shadow. From the street the wall reads solid at " +
      "noon and open at six in the evening.",
    facts: [
      { k: "Rotation", v: "20 degrees" },
      { k: "Drawn at", v: "1:5" },
      { k: "Sample panels", v: "Three, full height" },
      { k: "First used", v: "Qeytarieh 08 Residence" },
    ],
  },

  {
    id: 3,
    slug: "sofreh-identity",
    title: "Sofreh Restaurant Identity",
    category: "Branding",
    year: 2022,
    blurb: "Menu, signage and tableware drawn from the vault geometry of the room.",
    client: "Sofreh Co.",
    scope: "Wordmark, menus, signage, tableware",
    materials: "Aged brass, letterpress card, glazed earthenware",
    team: ["Golnaz Bahrami", "Parisa Omidvar", "Donya Zamani"],
    status: "Completed",
    description:
      "The room came first: a brick vault lit only at its crown. The owners asked for a logo and we argued " +
      "that the vault was already the mark. Its section, drawn at full size and reduced, gives a single curve " +
      "that works at the width of a sign and at the width of a plate rim. No other shape was drawn for the " +
      "restaurant.\n\n" +
      "Menus are letterpressed on heavy card so the curve is pressed into the page rather than printed onto " +
      "it. The street sign is an aged brass plate with the section cut clean through, backlit at night by the " +
      "same warm level as the dining room. Plates and bowls carry the curve as a raised rim, thrown by a " +
      "potter in Lalejin to a drawing at 1:1.",
    facts: [
      { k: "Applications", v: "Menu, sign, tableware" },
      { k: "Drawn at", v: "1:1" },
      { k: "Tableware", v: "Thrown in Lalejin" },
      { k: "Edition", v: "Closed, one venue" },
    ],
  },

  {
    id: 4,
    slug: "ravaq-bench",
    title: "Ravaq Bench",
    category: "Furniture",
    year: 2023,
    blurb: "A solid walnut bench for a courtyard arcade, jointed without visible fixings.",
    client: "Kavan Studio",
    scope: "Bench in two lengths, fixing detail",
    materials: "Solid walnut, oiled; bronze dowels",
    team: ["Behrang Lotfi", "Nima Jahanbakhsh", "Sahar Iravani"],
    status: "In production",
    description:
      "Courtyard arcades in the houses we build end up furnished with whatever the client finds, usually " +
      "steel and usually wrong against brick. We drew a bench that could sit under an arcade for thirty " +
      "years and be repaired rather than replaced. It is solid walnut, no veneer, no metal frame, and no " +
      "fixing that shows on any surface a hand can reach.\n\n" +
      "The legs are wedged through-tenons, drawn at 1:5 and cut by a joiner in Tehran who works without a " +
      "CNC. Bronze dowels pin the seat boards and can be driven out for repair. The top is left slightly " +
      "proud of the frame so rain runs off the end grain. Two lengths are made, at 1,600 and 2,400 " +
      "millimetres, sized to the bays we build.",
    facts: [
      { k: "Lengths", v: "1,600 and 2,400 mm" },
      { k: "Joint", v: "Wedged through-tenon" },
      { k: "Edition", v: "Open" },
      { k: "Drawn at", v: "1:5" },
    ],
  },

  {
    id: 5,
    slug: "darrous-handrail",
    title: "Darrous Handrail",
    category: "Detail Design",
    year: 2023,
    blurb: "Blackened steel and oiled oak, resolved so the two materials never share a plane.",
    client: "Aria Group",
    scope: "Handrail, balustrade fixing, stair nosing",
    materials: "Blackened steel, oiled oak",
    team: ["Kaveh Daneshvar", "Roya Kamalvand", "Amir Rahmani"],
    status: "Completed",
    description:
      "Steel and timber handrails usually meet flush, and the joint opens within two winters as the oak " +
      "moves and the steel does not. On the Darrous stair we stopped trying to hide that. The oak is set " +
      "proud of the steel by six millimetres on every face, so the two materials never share a plane and the " +
      "seasonal gap has nowhere to show.\n\n" +
      "The steel is a flat bar folded to a channel, blackened and waxed, welded to brackets set into the wall " +
      "before plaster. The oak drops into the channel from above and is held by countersunk screws from " +
      "beneath, so it can be lifted out and re-oiled without touching the steel. Twelve floors of it were " +
      "fitted in nine days.",
    facts: [
      { k: "Reveal", v: "6 mm, all faces" },
      { k: "Drawn at", v: "1:5 and 1:1" },
      { k: "First used", v: "Darrous Court Residence" },
      { k: "Finish", v: "Blackened and waxed" },
    ],
  },

  {
    id: 6,
    slug: "aab-basin",
    title: "Aab Basin",
    category: "Product",
    year: 2022,
    blurb: "A cast stone washbasin whose overflow reads as a drawn line.",
    client: "Kavan Studio",
    scope: "Basin, overflow detail, waste fitting",
    materials: "Cast stone, brushed brass waste",
    team: ["Mitra Mahdavi", "Sina Naderi", "Yasaman Ghazanfari"],
    status: "In production",
    description:
      "Every basin we specified arrived with a chrome overflow ring stamped into the bowl, a manufactured " +
      "hole that has nothing to do with the object it interrupts. We cast our own. The overflow became a " +
      "straight incised line running the full length of the back wall of the bowl, three millimetres wide, " +
      "which reads as a drawn line rather than a fitting.\n\n" +
      "It is cast in a grey stone aggregate from a two-part mould, ground and sealed by hand. The slot feeds " +
      "a channel behind the bowl and out through a brass waste. The floor of the bowl falls two degrees " +
      "toward the outlet so it drains dry, which matters in Tehran water. Twelve have been made; the mould " +
      "is good for perhaps two hundred.",
    facts: [
      { k: "Material", v: "Cast stone, grey" },
      { k: "Overflow", v: "3 mm incised slot" },
      { k: "Edition", v: "Open, made to order" },
      { k: "Drawn at", v: "1:2" },
    ],
  },

  {
    id: 7,
    slug: "seven-houses-exhibition",
    title: "Seven Houses",
    category: "Exhibition",
    year: 2022,
    blurb: "Exhibition design for seven residential models, lit from above only.",
    client: "Tehran Architecture Biennale",
    scope: "Exhibition design, plinths, lighting, captions",
    materials: "Raw plywood plinths, plaster models, linen",
    team: ["Tara Sadeghpour", "Pouya Haghighi", "Shirin Qorbani"],
    status: "Completed",
    description:
      "Seven residential projects had to be shown in a hall with a low ceiling and bad ambient light. " +
      "Photographs would have flattened them and drawings would not have been read at that scale. We showed " +
      "models only, at 1:50, in a single plaster with no colour and no figures, so that what is compared " +
      "between the seven is section and plan and nothing else.\n\n" +
      "The hall lighting was switched off and each model lit from directly above by one narrow beam, which " +
      "put the shadows where the building would put them at midday. Plinths are raw plywood at table height, " +
      "unfinished, built in four days. Captions are two lines of text on linen at the back of each plinth, " +
      "so a visitor reads the model first.",
    facts: [
      { k: "Models", v: "Seven, at 1:50" },
      { k: "Lighting", v: "One beam per model" },
      { k: "Duration", v: "Eleven days" },
      { k: "Venue", v: "Tehran Architecture Biennale" },
    ],
  },

  {
    id: 8,
    slug: "niavaran-signage",
    title: "Niavaran Wayfinding",
    category: "Signage",
    year: 2020,
    blurb: "Etched brass plates set flush into brick, legible in raking light.",
    client: "Private",
    scope: "Entrance numbers, floor plates, letterboxes",
    materials: "Etched brass, brick, oiled oak backing",
    team: ["Milad Yazdani", "Nazanin Vahdati", "Arman Fallahi"],
    status: "Completed",
    description:
      "Signage on brick buildings is normally screwed to the face and stands off it like a notice. In " +
      "Niavaran the numbers had to belong to the wall. We cut a brick out of the bond at each entrance and " +
      "set a brass plate into the void, flush with the face, so the sign occupies a course rather than " +
      "sitting on top of one.\n\n" +
      "The plates are etched half a millimetre deep and left to weather, so the letters darken and the field " +
      "stays bright. There is no paint and no light behind them. In raking morning and late afternoon sun " +
      "the numbers read from across the street; at noon they nearly disappear, which the residents seem to " +
      "like. Nothing has been polished since installation.",
    facts: [
      { k: "Plate", v: "Etched brass, 0.5 mm" },
      { k: "Set", v: "Flush into brick bond" },
      { k: "Drawn at", v: "1:1" },
      { k: "Finish", v: "Unlacquered, left to weather" },
    ],
  },

  {
    id: 9,
    slug: "kavan-drawing-set",
    title: "Studio Drawing Standard",
    category: "Detail Design",
    year: 2019,
    blurb: "The line weights, hatches and title blocks every project in the office is drawn to.",
    client: "Kavan Studio",
    scope: "Line weights, hatches, title block, sheet sizes",
    materials: "Printed on uncoated bond, A1 and A3",
    team: ["Sepehr Ansari", "Niloofar Ebadi", "Kian Tehrani"],
    status: "Completed",
    description:
      "By 2019 the office was fourteen people and no two of them drew a wall the same way. On site this " +
      "costs money: a contractor who has to interpret a drawing will interpret it cheaply. We wrote down the " +
      "standard instead of assuming it. Six line weights, eleven hatches, one title block, and a rule that " +
      "every junction is drawn at 1:5 before it is priced.\n\n" +
      "It exists as a printed booklet and a template file, and every new member of the office is given both " +
      "on their first day. Line weights are set so a sheet survives being photocopied twice and read in " +
      "daylight on a site table. The hatches distinguish materials our masons actually use. It has been " +
      "revised three times in six years, always downward, toward fewer rules.",
    facts: [
      { k: "Line weights", v: "Six" },
      { k: "Hatches", v: "Eleven" },
      { k: "Sheet sizes", v: "A1 and A3" },
      { k: "Revisions", v: "Three since 2019" },
    ],
  },
];

export const MEDIA = [
  {
    id: 1,
    title: "Qeytarieh 08 Residence",
    outlet: "ArchDaily",
    type: "Publication",
    year: 2025,
    blurb: "A long feature on the stepped brick facade and the shared roof terrace.",
    slug: "archdaily-qeytarieh-08-residence",
    project: "qeytarieh-08-residence",
    author: "Valeria Sandoval",
    excerpt:
      "The building steps back as it climbs, and the effect from the street is of a wall gradually giving " +
      "ground. Each terrace is a full structural bay, deep enough for a table and four chairs, and the brick " +
      "above it is laid to throw a moving shadow across the face.",
    context:
      "The piece understood the section, which is the part of this building that took the longest. It was " +
      "written from the drawings as much as the photographs, and that is rare. We would have liked a line " +
      "about the masons who set the bond, since the facade is theirs as much as ours.",
    facts: [
      { k: "Outlet", v: "ArchDaily" },
      { k: "Published", v: "March 2025" },
      { k: "Words", v: "1,400" },
      { k: "Format", v: "Long feature" },
    ],
  },

  {
    id: 2,
    title: "Sofreh Restaurant",
    outlet: "Dezeen",
    type: "Publication",
    year: 2024,
    blurb: "The vaulted dining room photographed empty, before service.",
    slug: "dezeen-sofreh-restaurant",
    project: "sofreh-restaurant",
    author: "Ellen Hartley",
    excerpt:
      "Photographed before service, the dining room is almost empty of objects: a brick vault held clear of " +
      "the concrete shell by a hand span, and a single line of light entering at the crown. The walnut " +
      "banquettes are the only warmth in the room until the tables are laid.",
    context:
      "We asked to be photographed empty and the piece ran it that way, which we were grateful for. What it " +
      "left out is the noise: the vault was built to make a loud room quiet, and that is the thing the owners " +
      "actually bought. A room reads differently at forty covers.",
    facts: [
      { k: "Outlet", v: "Dezeen" },
      { k: "Published", v: "September 2024" },
      { k: "Words", v: "900" },
      { k: "Format", v: "Photo essay" },
    ],
  },

  {
    id: 3,
    title: "Darrous Court Residence",
    outlet: "Divisare",
    type: "Publication",
    year: 2024,
    blurb: "Full drawing set published alongside the photography.",
    slug: "divisare-darrous-court-residence",
    project: "darrous-court-residence",
    author: "Giulia Ferrante",
    excerpt:
      "The full set is published here: plans, section, and the courtyard detail at 1:20. The drawings show " +
      "what the photographs cannot, that the void is cut through the whole depth of the block, and that " +
      "every kitchen in the building takes light from two sides because of it.",
    context:
      "Divisare publishes drawings at a size where they can be read, which almost nobody else does. We sent " +
      "the working set rather than a redrawn one, dimensions and all. If a student takes the courtyard " +
      "detail and builds it better, that is a good outcome.",
    facts: [
      { k: "Outlet", v: "Divisare" },
      { k: "Published", v: "June 2024" },
      { k: "Drawings", v: "Twenty-one sheets" },
      { k: "Format", v: "Drawing set" },
    ],
  },

  {
    id: 4,
    title: "On Brick and Its Masons",
    outlet: "Memar Magazine",
    type: "Publication",
    year: 2024,
    blurb: "An essay by the founders on working with Tehran brick trades.",
    slug: "memar-magazine-on-brick-and-its-masons",
    project: null,
    author: "Farhad Rastgar and Mahsa Aminzadeh",
    excerpt:
      "The bricklayers of Tehran learn a bond by building it, not by reading it. A drawing sent to site " +
      "without a sample panel will be built as the foreman remembers it, and he is usually right. The essay " +
      "argues that the drawing should follow the panel rather than the other way round.",
    context:
      "We wrote this because the trade is ageing and almost nothing about it is written down. Memar gave us " +
      "four pages and no editorial line, which is why it names the workshops. Several readers wrote to " +
      "correct us on Yazd practice, and they were right.",
    facts: [
      { k: "Outlet", v: "Memar Magazine" },
      { k: "Published", v: "November 2024" },
      { k: "Words", v: "2,600" },
      { k: "Format", v: "Essay" },
    ],
  },

  {
    id: 5,
    title: "Qeytarieh 08 Residence",
    outlet: "Memar Award",
    type: "Award",
    year: 2024,
    blurb: "First prize, residential category.",
    slug: "memar-award-qeytarieh-08-residence",
    project: "qeytarieh-08-residence",
    author: null,
    excerpt:
      "The jury awards first prize to a residential building that gives every apartment a room of outside " +
      "air deep enough to use. The stepped section is not a formal gesture but a daylight strategy, executed " +
      "in brick with a care the jury found rare at this scale in Tehran.",
    context:
      "The award matters here because Memar is judged by people who visit the buildings. Three jurors came " +
      "to the site and went up to the top floor. We took the prize as confirmation that the terraces are " +
      "used, which is the only test that counts.",
    facts: [
      { k: "Outlet", v: "Memar Award" },
      { k: "Category", v: "Residential" },
      { k: "Result", v: "First prize" },
      { k: "Year", v: "2024" },
    ],
  },

  {
    id: 6,
    title: "Lavasan Ridge Villa",
    outlet: "Architizer",
    type: "Publication",
    year: 2023,
    blurb: "Selected in the annual review of houses on difficult ground.",
    slug: "architizer-lavasan-ridge-villa",
    project: "lavasan-ridge-villa",
    author: "Hannah Voss",
    excerpt:
      "Three stone volumes are held apart on a slope that most builders would have terraced flat. The gaps " +
      "between them are the point: the hillside runs through the house rather than stopping at it, and the " +
      "reflecting pool on the middle terrace is the only element that touches all three.",
    context:
      "The review placed the house in a group of buildings on difficult ground, which is the right company " +
      "for it. It read the gaps correctly. It did not mention that the three volumes were also the cheapest " +
      "way to build here, because the foundations follow the rock and avoid a retaining wall.",
    facts: [
      { k: "Outlet", v: "Architizer" },
      { k: "Published", v: "October 2023" },
      { k: "Format", v: "Annual review" },
      { k: "Section", v: "Houses on difficult ground" },
    ],
  },

  {
    id: 7,
    title: "Drawing the Joint",
    outlet: "Pars University",
    type: "Lecture",
    year: 2023,
    blurb: "A public lecture on detail as the carrier of architectural intent.",
    slug: "pars-university-drawing-the-joint",
    project: null,
    author: "Farhad Rastgar",
    excerpt:
      "Architectural intent survives to site in the details or not at all, the lecture argued. A plan can be " +
      "redrawn by a contractor and still work; a junction redrawn by a contractor becomes a different " +
      "building. The argument was made through six junctions from the studio archive, each shown at 1:5.",
    context:
      "We give this lecture roughly once a year and it changes every time, because the junctions change. The " +
      "students asked better questions than the professionals do, mostly about cost. We now open with the " +
      "cost, since that is the honest place to start.",
    facts: [
      { k: "Outlet", v: "Pars University" },
      { k: "Delivered", v: "May 2023" },
      { k: "Length", v: "70 minutes" },
      { k: "Audience", v: "Public, open to students" },
    ],
  },

  {
    id: 8,
    title: "Darrous Court Residence",
    outlet: "Aga Khan Award",
    type: "Award",
    year: 2023,
    blurb: "Shortlisted in the housing category.",
    slug: "aga-khan-award-darrous-court-residence",
    project: "darrous-court-residence",
    author: null,
    excerpt:
      "Shortlisted for a housing project that returns the courtyard to a dense Tehran block without " +
      "nostalgia. The jury noted the discipline of the plan, in which twelve apartments each read through a " +
      "cut void, and the shallow pool that returns reflected light to the lowest flats.",
    context:
      "A shortlist is not a prize and we have not pretended otherwise. What it gave us was the documentation " +
      "process: the technical review asked questions about running cost and maintenance that no client had " +
      "asked. We changed how we brief clients afterwards.",
    facts: [
      { k: "Outlet", v: "Aga Khan Award for Architecture" },
      { k: "Cycle", v: "2022 to 2023" },
      { k: "Category", v: "Housing" },
      { k: "Result", v: "Shortlisted" },
    ],
  },

  {
    id: 9,
    title: "Bahar Book Cafe",
    outlet: "Frame",
    type: "Publication",
    year: 2022,
    blurb: "Interior feature on the oak shelving wall and its clerestory.",
    slug: "frame-bahar-book-cafe",
    project: "bahar-book-cafe",
    author: "Marieke de Vries",
    excerpt:
      "One wall of oak carries books to the ceiling; a clerestory above it drags light across the spines " +
      "through the day and drops it onto a single communal table. There is no other furniture worth naming, " +
      "and in a room of this size that turns out to be enough.",
    context:
      "The feature caught the light and missed the shelf. That wall is a structural element, braced back to " +
      "the party wall, which is why it could go full height in a room this narrow. We would rather be " +
      "published for the construction than the atmosphere, but we understand the magazine.",
    facts: [
      { k: "Outlet", v: "Frame" },
      { k: "Published", v: "August 2022" },
      { k: "Words", v: "1,100" },
      { k: "Format", v: "Interior feature" },
    ],
  },

  {
    id: 10,
    title: "Seven Houses",
    outlet: "Tehran Architecture Biennale",
    type: "Exhibition",
    year: 2022,
    blurb: "Seven residential projects shown as models at 1:50.",
    slug: "tehran-architecture-biennale-seven-houses",
    project: null,
    author: "Nasim Farahani",
    excerpt:
      "Seven residential projects are shown as plaster models at 1:50, lit from directly above and captioned " +
      "in two lines. Stripped of colour, figures and photographs, the group invites a comparison that is " +
      "purely sectional. The hall lights are off; each model carries its own midday shadow.",
    context:
      "We asked for a dark room and got one, which decided the whole show. Visitors spent longer at the " +
      "models than we expected and asked about stairs more than facades. Four of the seven models are now in " +
      "the studio, still on their plinths.",
    facts: [
      { k: "Outlet", v: "Tehran Architecture Biennale" },
      { k: "Dates", v: "October 2022" },
      { k: "Models", v: "Seven, at 1:50" },
      { k: "Duration", v: "Eleven days" },
    ],
  },

  {
    id: 11,
    title: "Sofreh Restaurant",
    outlet: "2A Asia Architecture Award",
    type: "Award",
    year: 2022,
    blurb: "Honourable mention, hospitality.",
    slug: "2a-asia-architecture-award-sofreh-restaurant",
    project: "sofreh-restaurant",
    author: null,
    excerpt:
      "Honourable mention in hospitality for an interior that adds one element to an existing shell and " +
      "removes nothing else. The jury commended the decision to hold the new brick vault clear of the old " +
      "concrete frame, making the gap between them the sole source of light.",
    context:
      "The citation named the gap, which is the only thing in that room we argued about for months. Awards " +
      "judged from photographs usually reward the surface; this one did not. It helped the client more than " +
      "it helped us.",
    facts: [
      { k: "Outlet", v: "2A Asia Architecture Award" },
      { k: "Category", v: "Hospitality" },
      { k: "Result", v: "Honourable mention" },
      { k: "Year", v: "2022" },
    ],
  },

  {
    id: 12,
    title: "Ekbatan Workshop Building",
    outlet: "ArchEyes",
    type: "Publication",
    year: 2021,
    blurb: "On adapting an industrial shed without erasing it.",
    slug: "archeyes-ekbatan-workshop-building",
    project: "ekbatan-workshop-building",
    author: "Andres Molina",
    excerpt:
      "The portal frame is left unpainted inside, repaired where it had corroded and otherwise untouched, so " +
      "the building still announces what it used to be. New insulated cladding and a clerestory along the " +
      "ridge do the environmental work. Demolition was costed at the outset and rejected.",
    context:
      "This is the only piece written about the building and it got the argument right: keeping the shed was " +
      "the cheaper option, not the sentimental one. We sent the cost comparison and they printed it. " +
      "Industrial work is rarely published, so we take what we can.",
    facts: [
      { k: "Outlet", v: "ArchEyes" },
      { k: "Published", v: "February 2021" },
      { k: "Words", v: "800" },
      { k: "Format", v: "Project feature" },
    ],
  },

  {
    id: 13,
    title: "Bahar Book Cafe",
    outlet: "Memar Award",
    type: "Award",
    year: 2020,
    blurb: "Second prize, interior category.",
    slug: "memar-award-bahar-book-cafe",
    project: "bahar-book-cafe",
    author: null,
    excerpt:
      "Second prize in the interior category for a small corner unit reorganised around a single wall and a " +
      "single table. The jury remarked that the project spends its budget on daylight rather than finishes, " +
      "and that the clerestory does more work than any fitting in the room.",
    context:
      "The cafe cost less than any project we have entered for anything. The jury said so, which was the " +
      "useful part. Small budgets are not a handicap in this category and we would like more clients to read " +
      "the citation.",
    facts: [
      { k: "Outlet", v: "Memar Award" },
      { k: "Category", v: "Interior" },
      { k: "Result", v: "Second prize" },
      { k: "Year", v: "2020" },
    ],
  },

  {
    id: 14,
    title: "Farmanieh 12 Residence",
    outlet: "Wienerberger Brick Award",
    type: "Award",
    year: 2018,
    blurb: "Selected work, international brick architecture.",
    slug: "wienerberger-brick-award-farmanieh-12-residence",
    project: "farmanieh-12-residence",
    author: null,
    excerpt:
      "Selected for load-bearing brickwork carried to five storeys with no visible lintel on any elevation. " +
      "Openings are arched within the depth of the wall, a technique the submission documents in full. The " +
      "selection panel noted the collaboration with local masons as integral rather than incidental.",
    context:
      "Being selected in Vienna for something our masons in Tehran have always known how to do was a strange " +
      "kind of compliment. We took two of them to the exhibition. The building is slower to construct and " +
      "cheaper to maintain, and the award made that argument easier with clients.",
    facts: [
      { k: "Outlet", v: "Wienerberger Brick Award" },
      { k: "Edition", v: "2018" },
      { k: "Result", v: "Selected work" },
      { k: "Location", v: "Vienna" },
    ],
  },
];

export const designBySlug = (slug) => DESIGN_WORKS.find((w) => w.slug === slug);
export const mediaBySlug = (slug) => MEDIA.find((m) => m.slug === slug);
