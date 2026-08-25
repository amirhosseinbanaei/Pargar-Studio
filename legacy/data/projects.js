/**
 * KAVAN STUDIO — project archive, 2013–2025.
 *
 * Each record drives: the filter taxonomy, the index row, and the detail view.
 * `slug` is also the seed for the project's generated drawings, so a project's
 * artwork is stable forever once its slug is set.
 */

export const TYPES = [
  'Residential', 'Villa', 'Office', 'Hospitality', 'Commercial',
  'Complex', 'Interior Design', 'Renovation', 'Public', 'Urban Design',
  'Industrial',
];

export const STATUSES = ['Completed', 'Under Construction', 'Concept'];
export const SCALES = ['Small', 'Medium', 'Large'];

/** Shorthand: t=type, s=status, z=scale, y=year, l=location, a=area, c=client */
const p = (id, slug, title, t, s, z, y, l, a, c, blurb, description) =>
  ({ id, slug, title, type: t, status: s, scale: z, year: y,
     location: l, area: a, client: c, blurb, description });

export const PROJECTS = [
  /* ---- 2025 ------------------------------------------------------------ */
  p(1, 'qeytarieh-08-residence', 'Qeytarieh 08 Residence',
    ['Residential'], 'Completed', 'Large', 2025, 'Qeytarieh, Tehran', '4,180 m²', 'Private',
    'Eight storeys of stepped brick, each apartment given a room of outside air deep enough to sit in.',
    'The site is narrow and north-facing, so the building steps back as it rises to pull daylight down to the lower floors. Each terrace is a full structural bay rather than a balcony, deep enough for a table. The brick is laid in a shading bond developed with the masons on site.'),

  p(2, 'darrous-court-residence', 'Darrous Court Residence',
    ['Residential', 'Interior Design'], 'Completed', 'Large', 2025, 'Darrous, Tehran', '3,640 m²', 'Aria Group',
    'Twelve apartments arranged around a cut courtyard that carries light and air to the centre of the plan.',
    'Rather than a single block filling the site, the volume is split by a courtyard open to the sky. Every apartment reads through it, so kitchens and stairs receive daylight from two directions. A shallow black-bottomed pool at the base returns reflected light to the lowest flats.'),

  p(3, 'sohanak-ridge-villa', 'Sohanak Ridge Villa',
    ['Villa'], 'Under Construction', 'Medium', 2025, 'Sohanak, Tehran', '720 m²', 'Private',
    'A house that lies along the contour instead of cutting across it, entered from its roof.',
    'The slope was too steep to terrace economically, so the house follows it. Arrival is at the top, onto a planted roof that reads as continuous ground; living spaces step down beneath it. The retaining wall doubles as the spine of the plan and carries every floor.'),

  p(4, 'sofreh-restaurant', 'Sofreh Restaurant',
    ['Hospitality', 'Interior Design', 'Renovation'], 'Completed', 'Small', 2025, 'Elahieh, Tehran', '310 m²', 'Sofreh Co.',
    'A brick vault dropped into a 1970s shell, lit only from its crown.',
    'The existing concrete frame was left exposed and a self-supporting brick vault built inside it, clear of the walls by a hand span. That gap is the only light source, washing the brick from above. Walnut banquettes and aged brass keep the room warm at low light levels.'),

  p(5, 'fereshteh-42-residence', 'Fereshteh 42 Residence',
    ['Residential'], 'Under Construction', 'Medium', 2025, 'Fereshteh, Tehran', '2,190 m²', 'Private',
    'A quiet street facade of load-bearing brick with openings sized by room rather than by grid.',
    'The client wanted a building that did not announce itself. Openings are set out from the inside: large where a living room needs the view, small and high where a bedroom needs privacy from the street. The result reads as irregular from outside and entirely obvious from within.'),

  p(6, 'chalus-road-rest-house', 'Chalus Road Rest House',
    ['Hospitality', 'Public'], 'Concept', 'Medium', 2025, 'Karaj–Chalus Road', '1,450 m²', 'Ministry of Roads',
    'A stopping place on the mountain road, built as a wall with rooms carved out of it.',
    'Traffic on this road is seasonal and heavy. The proposal is a single long stone wall parallel to the carriageway, thick enough to contain a cafe, washrooms and a prayer room. The wall shelters a terrace on its valley side, where the view is.'),

  p(7, 'kamranieh-twin-residence', 'Kamranieh Twin Residence',
    ['Residential'], 'Under Construction', 'Large', 2025, 'Kamranieh, Tehran', '3,900 m²', 'Rastin Group',
    'Two blocks separated by a planted slot, so that no apartment looks directly into another.',
    'A single mass on this plot would have produced facing windows across a light well. Splitting it in two and rotating the halves five degrees breaks every sightline while keeping the required area. The slot between is planted and open to the street at ground level.'),

  p(8, 'yazd-guest-house', 'Yazd Guest House',
    ['Hospitality', 'Renovation'], 'Under Construction', 'Small', 2025, 'Fahadan, Yazd', '540 m²', 'Private',
    'A courtyard house repaired rather than restored, with new work left legible as new.',
    'The adobe fabric was consolidated and the collapsed north range rebuilt in brick, deliberately distinct from the original earth walls. The badgir was reopened and now ventilates the guest rooms. Nothing was aged artificially; the repair is meant to be visible.'),

  /* ---- 2024 ------------------------------------------------------------ */
  p(9, 'velenjak-24-residence', 'Velenjak 24 Residence',
    ['Residential'], 'Completed', 'Large', 2024, 'Velenjak, Tehran', '4,720 m²', 'Private',
    'A brick screen wraps the south face, cutting glare without closing the view to the city.',
    'Tehran light from the south is too strong to admit directly. A screen of bricks turned twenty degrees out of plane filters it into the living rooms while remaining transparent to the view from inside. The bond was prototyped full-size in the yard before construction began.'),

  p(10, 'bahar-book-cafe', 'Bahar Book Cafe',
    ['Hospitality', 'Interior Design'], 'Completed', 'Small', 2024, 'Yousef Abad, Tehran', '180 m²', 'Bahar Nashr',
    'One wall of oak shelving, one long table, and a clerestory that moves light across both all day.',
    'A small, awkward corner unit with poor daylight. The whole north wall became shelving to the ceiling, and a clerestory was cut above it. The light that lands on the books is reflected down onto a single communal table, which is the only furniture that matters here.'),

  p(11, 'lavasan-ridge-villa', 'Lavasan Ridge Villa',
    ['Villa'], 'Completed', 'Large', 2024, 'Lavasan, Tehran', '980 m²', 'Private',
    'Three stone volumes cantilevered over a slope, held apart so the landscape passes between them.',
    'The brief asked for one house; we built three connected pieces so that the hillside continues through the gaps. Each volume takes one part of the programme and one view. The reflecting pool on the middle terrace is the only element that touches all three.'),

  p(12, 'saadat-abad-office', 'Saadat Abad Office Building',
    ['Office'], 'Completed', 'Medium', 2024, 'Saadat Abad, Tehran', '2,850 m²', 'Nabard Holding',
    'Deep concrete fins shade the glass and give a small office building the weight of a civic one.',
    'The client wanted glass; the orientation did not allow it. Vertical fins at a metre and a half deep let the facade stay fully glazed while cutting direct sun for most of the working day. Cast in place with board formwork, they carry the marks of their making.'),

  p(13, 'zaferaniyeh-11-residence', 'Zaferaniyeh 11 Residence',
    ['Residential'], 'Completed', 'Medium', 2024, 'Zaferaniyeh, Tehran', '2,340 m²', 'Private',
    'A double-height entrance cut through the block, so the street reads the building as a threshold.',
    'Most residential lobbies in the city are dark and mean. Here a full two-storey slot is cut through the ground floor from street to garden, planted and open at both ends. It costs one apartment and gives every resident an arrival worth having.'),

  p(14, 'nowshahr-beach-villa', 'Nowshahr Beach Villa',
    ['Villa'], 'Completed', 'Medium', 2024, 'Nowshahr, Mazandaran', '640 m²', 'Private',
    'Raised on piers above the sand, with a shaded undercroft that is the real living room in summer.',
    'Caspian humidity and shifting sand argued for lifting the house clear of the ground. The space beneath is shaded, cross-ventilated and open, and is used far more than the rooms above. Timber louvres to the sea side close down entirely when the house is empty.'),

  p(15, 'mirdamad-clinic', 'Mirdamad Clinic',
    ['Public', 'Interior Design'], 'Completed', 'Medium', 2024, 'Mirdamad, Tehran', '1,620 m²', 'Sina Health',
    'A medical building organised around a daylit waiting garden rather than a corridor.',
    'Waiting is the longest part of any clinic visit. The plan puts a planted, top-lit room at its centre and arranges consulting rooms around it, so that nobody waits in a corridor. Circulation is at the perimeter, where it also gets daylight.'),

  p(16, 'ekbatan-workshop-building', 'Ekbatan Workshop Building',
    ['Industrial', 'Renovation'], 'Completed', 'Medium', 2024, 'Ekbatan, Tehran', '2,100 m²', 'Karvan Industries',
    'A 1970s steel shed kept and re-clad, with the original frame left entirely visible inside.',
    'Demolition was costed and rejected. The existing portal frame was stripped, repaired and re-clad in insulated panel with a new clerestory along the ridge. Inside, the frame is untouched and unpainted, which tells everyone what the building used to be.'),

  p(17, 'pasdaran-09-residence', 'Pasdaran 09 Residence',
    ['Residential'], 'Completed', 'Medium', 2024, 'Pasdaran, Tehran', '2,460 m²', 'Private',
    'Balconies staggered floor to floor so each has open sky above it rather than a neighbour.',
    'Stacked balconies give the upper flat a view and the lower one a ceiling. Alternating them bay by bay gives every apartment a terrace with sky above. The shift also breaks the facade into something with rhythm, at no extra structural cost.'),

  p(18, 'tajrish-market-passage', 'Tajrish Market Passage',
    ['Commercial', 'Urban Design', 'Public'], 'Concept', 'Large', 2024, 'Tajrish, Tehran', '5,300 m²', 'Tehran Municipality',
    'A covered route stitched through an existing block, reconnecting two streets the bazaar had closed.',
    'The block had been built over piecemeal until the historic north–south route through it disappeared. The proposal reopens it as a top-lit passage lined with small units, reusing what structure can be kept and inserting new only where the route demands.'),

  p(19, 'shemshak-cabin', 'Shemshak Cabin',
    ['Villa'], 'Completed', 'Small', 2024, 'Shemshak, Tehran', '210 m²', 'Private',
    'A small winter house of stone and blackened timber, planned around a single hearth.',
    'At this altitude the house is used for a few months a year and must warm quickly. Everything is compact and gathered around one masonry hearth that stores heat overnight. The stone base takes the snow load; the timber above is light and can be shut down entirely.'),

  p(20, 'jordan-retail-block', 'Jordan Retail Block',
    ['Commercial'], 'Completed', 'Medium', 2024, 'Jordan, Tehran', '1,980 m²', 'Aftab Estates',
    'Shopfronts set deep behind a brick colonnade, giving the pavement shade it did not have.',
    'The street is hot, loud and without shelter. Pulling the glazing back three metres behind a colonnade creates a shaded pavement room in front of the shops. Tenants change; the colonnade does not, so the building keeps its face.'),

  /* ---- 2023 ------------------------------------------------------------ */
  p(21, 'niavaran-garden-residence', 'Niavaran Garden Residence',
    ['Residential'], 'Completed', 'Large', 2023, 'Niavaran, Tehran', '3,780 m²', 'Private',
    'Built along one edge of its plot so that the mature garden survives intact.',
    'The site carried forty-year-old plane trees. Rather than centring the building and losing them, the whole mass was pushed to the north boundary. Every apartment therefore faces the garden, and the trees are what you see from the street.'),

  p(22, 'darband-tea-house', 'Darband Tea House',
    ['Hospitality', 'Public'], 'Completed', 'Small', 2023, 'Darband, Tehran', '260 m²', 'Private',
    'Terraces stepping down beside the stream, roofed in timber and open on every side.',
    'The traditional form here is a platform over water. We kept it and made it permanent: five stepped concrete terraces following the stream bed, each with a light timber roof. Nothing encloses; the building is a set of floors and shades.'),

  p(23, 'gisha-infill-residence', 'Gisha Infill Residence',
    ['Residential'], 'Completed', 'Small', 2023, 'Gisha, Tehran', '860 m²', 'Private',
    'A six-metre-wide infill that borrows light from a slot in its own roof.',
    'With buildings tight on both sides, the only light available was from the ends and from above. A slot runs the depth of the plan from roof to ground floor, glazed at the top, and turns the middle of a very narrow building into its best room.'),

  p(24, 'isfahan-court-house', 'Isfahan Court House',
    ['Villa', 'Renovation'], 'Completed', 'Medium', 2023, 'Jolfa, Isfahan', '480 m²', 'Private',
    'A Qajar courtyard house given a new service wing so the historic rooms need no alteration.',
    'The old rooms could not take modern services without losing their plaster and their proportions. A new brick wing along the blind south wall takes kitchen, bathrooms and plant, leaving the historic range to be simply repaired and used as it always was.'),

  p(25, 'aghdasiyeh-residence', 'Aghdasiyeh Residence',
    ['Residential'], 'Completed', 'Medium', 2023, 'Aghdasiyeh, Tehran', '2,270 m²', 'Behin Sazeh',
    'A facade of two brick tones, set out so the change reads only in raking afternoon light.',
    'Two batches of brick, half a shade apart, laid to a pattern that is invisible at noon and clearly legible at five in the afternoon. It costs nothing beyond the sorting and gives the building a different face at each hour.'),

  p(26, 'kish-marina-pavilion', 'Kish Marina Pavilion',
    ['Public', 'Hospitality'], 'Concept', 'Small', 2023, 'Kish Island', '390 m²', 'Kish Free Zone',
    'A deep perforated canopy over an open floor, designed to be almost entirely shade.',
    'On Kish the building that is needed is shade. A single thick canopy, perforated to let heat escape and light through, floats over an open platform. Enclosure is limited to a service core; everything else is under the canopy and open to the wind.'),

  p(27, 'mahmoudieh-residence', 'Mahmoudieh Residence',
    ['Residential'], 'Completed', 'Medium', 2023, 'Mahmoudieh, Tehran', '2,510 m²', 'Private',
    'Two apartments per floor, each turned so its living room faces the mountains.',
    'The default plan here puts both flats square to the street and gives one of them a wall. Rotating the party wall fifteen degrees costs a little area and gives both apartments the northern view, which is the only reason anyone lives on this street.'),

  p(28, 'ramsar-hillside-villa', 'Ramsar Hillside Villa',
    ['Villa'], 'Completed', 'Medium', 2023, 'Ramsar, Mazandaran', '580 m²', 'Private',
    'A long low house under a single pitched roof, opening entirely to the sea side.',
    'Heavy rainfall argued for one simple roof with generous overhangs rather than a composition of flat volumes. Under it, the plan is a single-room-deep bar so that every space cross-ventilates. The seaward wall is almost entirely sliding timber screens.'),

  p(29, 'vanak-office-tower', 'Vanak Office Tower',
    ['Office', 'Commercial'], 'Under Construction', 'Large', 2023, 'Vanak, Tehran', '9,400 m²', 'Parsian Group',
    'A tower whose floorplates shrink as it rises, giving every fourth level a planted terrace.',
    'Reducing the plate by one bay every four floors produces usable outdoor terraces without adding structure. It also lightens the tower against the sky, which matters on a street where every neighbour is a flat-topped slab of equal height.'),

  p(30, 'shahrak-gharb-school', 'Shahrak-e Gharb School',
    ['Public'], 'Concept', 'Large', 2023, 'Shahrak-e Gharb, Tehran', '6,200 m²', 'Department of Education',
    'Classrooms in low blocks around three planted yards, so no child is more than a few steps from outside.',
    'A single stacked school building puts most classrooms far from the ground. Here the accommodation is spread into low ranges around three yards of different character: hard, planted and shaded. Circulation is external, which is possible for most of the school year in Tehran.'),

  /* ---- 2022 ------------------------------------------------------------ */
  p(31, 'farmanieh-12-residence', 'Farmanieh 12 Residence',
    ['Residential'], 'Completed', 'Large', 2022, 'Farmanieh, Tehran', '3,320 m²', 'Private',
    'Load-bearing brick to five storeys, detailed so no lintel is ever visible.',
    'Working with the masons, the openings were arched in the depth of the wall so that no steel shows on the face. It is slower to build and cheaper to maintain, and it gives the facade a quality that applied brick slips cannot reach.'),

  p(32, 'qazvin-caravanserai-hotel', 'Qazvin Caravanserai Hotel',
    ['Hospitality', 'Renovation', 'Public'], 'Completed', 'Large', 2022, 'Qazvin', '3,900 m²', 'Miras Group',
    'A Safavid caravanserai converted to rooms, with all new servicing kept above floor level and reversible.',
    'Nothing new is buried in the historic fabric. Services run in an exposed steel channel at high level in each cell, and every intervention could be removed without trace. The central court is left empty, as it was, and does the work of the lobby.'),

  p(33, 'chizar-residence', 'Chizar Residence',
    ['Residential', 'Renovation'], 'Completed', 'Small', 2022, 'Chizar, Tehran', '740 m²', 'Private',
    'A 1960s block stripped to its frame and rebuilt with a deeper, shaded skin.',
    'The structure was sound and the envelope was not. Removing the infill walls entirely allowed a new skin set forward of the frame, creating a half-metre shaded zone at every window. The apartments gained insulation, shade and a metre of usable depth.'),

  p(34, 'lavizan-park-residence', 'Lavizan Park Residence',
    ['Residential'], 'Completed', 'Medium', 2022, 'Lavizan, Tehran', '2,880 m²', 'Aria Group',
    'A saw-tooth plan that turns every apartment away from the road and toward the park.',
    'The plot faces a busy road on one side and the park on the other. Angling each apartment thirty degrees closes the bedrooms to traffic noise and opens the living rooms to trees, without changing the building envelope at all.'),

  p(35, 'shiraz-vineyard-villa', 'Shiraz Vineyard Villa',
    ['Villa'], 'Completed', 'Medium', 2022, 'Shiraz, Fars', '690 m²', 'Private',
    'Thick stone walls and small deep openings, planned around a shaded water court.',
    'The climate rewards mass and shade over glass. Walls are six hundred millimetres of local stone, openings are small and deeply reveals. The court at the centre holds a narrow runnel of water, which is the coolest place on the site by several degrees.'),

  p(36, 'davoudieh-residence', 'Davoudieh Residence',
    ['Residential'], 'Completed', 'Small', 2022, 'Davoudieh, Tehran', '1,180 m²', 'Private',
    'Four apartments over a garden level, with the stair placed outside the heated envelope.',
    'Putting the stair outside the insulated line saves conditioning a volume nobody occupies, and gives the circulation daylight and air on all four floors. Residents pass each other in the open, which is how the client wanted the building to work.'),

  p(37, 'anzali-fish-market', 'Anzali Fish Market',
    ['Public', 'Commercial'], 'Concept', 'Medium', 2022, 'Bandar Anzali, Gilan', '1,740 m²', 'Anzali Municipality',
    'A long open hall under a ventilated timber roof, washable from end to end.',
    'A market for wet trade needs air, shade and a floor that can be hosed. The proposal is one clear span with a raised ventilating ridge, open sides, and a graded concrete floor draining to a single channel. Everything else is stalls, which the traders build themselves.'),

  p(38, 'punak-residence', 'Punak Residence',
    ['Residential'], 'Completed', 'Medium', 2022, 'Punak, Tehran', '2,640 m²', 'Behin Sazeh',
    'Modest budget, load-bearing masonry, and every square metre of the plan doing two things.',
    'A tight budget rewarded plan discipline rather than facade effort. Circulation doubles as storage, the stair hall lights the corridor, and structural walls define rooms so no partition is wasted. The savings went into brick, windows and a lift that will last.'),

  p(39, 'kelardasht-forest-villa', 'Kelardasht Forest Villa',
    ['Villa'], 'Completed', 'Small', 2022, 'Kelardasht, Mazandaran', '340 m²', 'Private',
    'Lifted clear of the forest floor on four points, touching the site as little as possible.',
    'The trees were the reason for the plot and the constraint on it. The house sits on four pad foundations threaded between root plates, with the floor a metre above grade so water and animals pass beneath. Not one tree was removed.'),

  p(40, 'amirabad-student-housing', 'Amirabad Student Housing',
    ['Residential', 'Public'], 'Concept', 'Large', 2022, 'Amirabad, Tehran', '7,100 m²', 'University of Tehran',
    'Rooms in clusters of eight around shared kitchens, stacked around a full-height light court.',
    'Corridor-plan halls produce anonymity. Grouping eight rooms around a shared kitchen and stair gives students a unit small enough to know. The clusters stack around a top-lit court that is the building social space and its ventilation stack.'),

  /* ---- 2021 ------------------------------------------------------------ */
  p(41, 'elahieh-residence', 'Elahieh Residence',
    ['Residential'], 'Completed', 'Large', 2021, 'Elahieh, Tehran', '3,150 m²', 'Private',
    'Travertine base, brick above, and a cornice deep enough to shade the top floor.',
    'The building takes its base line from its older neighbours in travertine, then changes to brick where they do. The deep cornice is not decoration: it shades the top-floor terrace, which would otherwise be unusable in July.'),

  p(42, 'mehrshahr-garden-villa', 'Mehrshahr Garden Villa',
    ['Villa'], 'Completed', 'Medium', 2021, 'Mehrshahr, Karaj', '620 m²', 'Private',
    'A single-storey house that wraps three sides of a walled garden.',
    'The garden was mature and walled; the house was asked to serve it. A low L-shaped plan on two sides, a colonnade on the third, and the existing wall closing the fourth. Every room opens to the garden and none looks outward.'),

  p(43, 'heravi-residence', 'Heravi Residence',
    ['Residential'], 'Completed', 'Medium', 2021, 'Heravi, Tehran', '2,050 m²', 'Private',
    'Two apartments per floor sharing a north-lit stair with a window on every landing.',
    'A stair with real daylight is rare in this market and costs almost nothing. Placing it on the north wall with a window at each landing gives the building a legible, pleasant circulation and lets the apartments keep their full south frontage.'),

  p(44, 'tabriz-office-building', 'Tabriz Office Building',
    ['Office'], 'Completed', 'Medium', 2021, 'Valiasr, Tabriz', '2,700 m²', 'Sahand Holding',
    'Brick piers and recessed glazing, sized against the colder winters of the north-west.',
    'A facade tuned for Tabriz rather than Tehran: smaller glazed proportion, deeper reveals and a heavier thermal mass. The piers are load-bearing, which removed a structural frame from the perimeter and paid for the extra brick.'),

  p(45, 'sari-residence', 'Sari Residence',
    ['Residential'], 'Completed', 'Small', 2021, 'Sari, Mazandaran', '980 m²', 'Private',
    'Wide overhangs and continuous verandas, planned for rain rather than sun.',
    'On the Caspian plain the problem is water, not glare. Every facade carries a veranda deep enough to leave windows open in rain, and the roof oversails by a metre and a half. The plan is one room deep so the house dries between storms.'),

  p(46, 'ozgol-residence', 'Ozgol Residence',
    ['Residential'], 'Completed', 'Medium', 2021, 'Ozgol, Tehran', '2,190 m²', 'Private',
    'A blind north wall to the road and a fully glazed south face to a private slope.',
    'The road side is noisy and overlooked, the garden side is neither. The building answers by being almost solid to the north and almost open to the south. The blind wall carries the stair, the lift and every service riser.'),

  p(47, 'kashan-guest-rooms', 'Kashan Guest Rooms',
    ['Hospitality', 'Renovation'], 'Completed', 'Small', 2021, 'Sultan Amir Ahmad, Kashan', '420 m²', 'Private',
    'Six rooms inserted into a courtyard house, each one a repaired room and nothing more.',
    'The instinct in these conversions is to add. Here almost nothing was added: six existing rooms were repaired, given a bathroom carved from a former store, and left. The courtyard, the pool and the badgir do the rest of the work.'),

  p(48, 'marzdaran-residence', 'Marzdaran Residence',
    ['Residential'], 'Completed', 'Small', 2021, 'Marzdaran, Tehran', '1,340 m²', 'Behin Sazeh',
    'A budget apartment building where all the money went into the windows.',
    'With a fixed and modest budget, the choice was many cheap components or few good ones. Structure and finishes were kept plain and the entire discretionary spend went into deep timber-framed windows with proper reveals, which is what the residents touch every day.'),

  p(49, 'damavand-observatory', 'Damavand Observatory',
    ['Public'], 'Concept', 'Small', 2021, 'Damavand, Tehran', '280 m²', 'Amateur Astronomers Society',
    'A stone drum on the ridge, opening only upward.',
    'Light pollution from the valley made a conventional glazed building useless. The proposal is a windowless stone drum with a single opening to the sky and a stair wrapping its inner face, so eyes adapt to darkness on the way up.'),

  p(50, 'shahran-residence', 'Shahran Residence',
    ['Residential'], 'Completed', 'Medium', 2021, 'Shahran, Tehran', '2,420 m²', 'Private',
    'Stepped section following the hill, so that each floor gains a terrace from the one below.',
    'The site falls four metres across its depth. Rather than levelling it, the building steps with the ground in three stages. Each step yields a terrace at the back of the floor above, and the retaining structure was needed anyway.'),

  /* ---- 2020 ------------------------------------------------------------ */
  p(51, 'niavaran-08-residence', 'Niavaran 08 Residence',
    ['Residential'], 'Completed', 'Large', 2020, 'Niavaran, Tehran', '3,460 m²', 'Private',
    'A brick building with a stone base, arranged so the entrance is under the deepest shade on the site.',
    'The approach is from the south and hot for eight months. Setting the entrance into a two-storey recess at the darkest corner makes arrival a relief rather than an ordeal, and gives the facade its one strong shadow.'),

  p(52, 'gorgan-market-hall', 'Gorgan Market Hall',
    ['Commercial', 'Public'], 'Completed', 'Medium', 2020, 'Gorgan, Golestan', '2,300 m²', 'Gorgan Municipality',
    'A clear-span brick and steel hall with a ventilating monitor roof.',
    'Traders wanted an uninterrupted floor they could set out themselves. A single span with a raised monitor along the ridge gives them that, plus stack ventilation that keeps the hall usable in a humid summer without mechanical help.'),

  p(53, 'zaferaniyeh-office', 'Zaferaniyeh Office Building',
    ['Office'], 'Completed', 'Small', 2020, 'Zaferaniyeh, Tehran', '1,480 m²', 'Rastin Group',
    'A small office with a roof terrace treated as the best room in the building.',
    'The plot only allowed four floors, so the roof became the argument. It is fully planted, shaded by a pergola sized for the summer sun angle, and reached by the main stair rather than a hatch, which is why it actually gets used.'),

  p(54, 'darakeh-trail-shelter', 'Darakeh Trail Shelter',
    ['Public'], 'Completed', 'Small', 2020, 'Darakeh, Tehran', '90 m²', 'Tehran Municipality',
    'A stone shelter at the trailhead, built by the same masons who build the retaining walls above it.',
    'A very small building made from the material already on the mountain, by the trades already working there. It provides shade, water and a bench, and it will be repaired the same way the trail walls are.'),

  p(55, 'jordan-residence', 'Jordan Residence',
    ['Residential'], 'Completed', 'Medium', 2020, 'Jordan, Tehran', '2,760 m²', 'Aftab Estates',
    'A deep-set facade where every window sits half a metre back from the brick face.',
    'On a wide, exposed street, the depth of the reveal does the work of a blind. Half a metre of recess gives privacy from the pavement, shade through the middle of the day, and a facade that changes as the sun moves.'),

  p(56, 'rasht-covered-street', 'Rasht Covered Street',
    ['Urban Design', 'Public', 'Commercial'], 'Concept', 'Large', 2020, 'Rasht, Gilan', '4,600 m²', 'Rasht Municipality',
    'A translucent roof over an existing shopping street, so it stays open through the rainy season.',
    'The street already worked; it simply drowned for five months a year. A light structure spanning between existing buildings, glazed and ventilated at the ridge, keeps trade running without changing anything at ground level.'),

  p(57, 'qeshm-desert-lodge', 'Qeshm Desert Lodge',
    ['Hospitality'], 'Concept', 'Medium', 2020, 'Qeshm Island', '1,120 m²', 'Private',
    'Thick walls, small openings and a wind tower, working the way local building always has.',
    'The vernacular here is correct and there was no reason to improve it, only to build it well. Thick coral-stone walls, deep shaded courts and a functioning wind tower give comfort at Qeshm temperatures without air conditioning for most of the year.'),

  /* ---- 2019 ------------------------------------------------------------ */
  p(58, 'velenjak-06-residence', 'Velenjak 06 Residence',
    ['Residential'], 'Completed', 'Medium', 2019, 'Velenjak, Tehran', '2,580 m²', 'Private',
    'Terraces cut into the volume rather than added to it, so the outline stays simple.',
    'Rather than hanging balconies off a slab, outdoor space is carved from the building envelope. The mass stays a single clean brick block from the street and each apartment gets a sheltered, wind-free terrace inside it.'),

  p(59, 'hasht-behesht-villa', 'Hasht Behesht Villa',
    ['Villa'], 'Completed', 'Medium', 2019, 'Lavasan, Tehran', '710 m²', 'Private',
    'An eight-part plan on a square grid, with the centre left open to the sky.',
    'The name is a description, not a reference: eight rooms on a three-by-three grid with the middle square open. The geometry is old and it still works, giving every room two aspects and putting light at the centre of the house.'),

  p(60, 'yousef-abad-renovation', 'Yousef Abad Renovation',
    ['Renovation', 'Residential', 'Interior Design'], 'Completed', 'Small', 2019, 'Yousef Abad, Tehran', '210 m²', 'Private',
    'One apartment opened up by removing exactly three walls and adding none.',
    'A 1970s flat with too many small rooms. Three non-structural walls came out, one line of storage went in along the spine, and nothing else changed. It cost very little and the apartment reads twice its size.'),

  p(61, 'semnan-highway-services', 'Semnan Highway Services',
    ['Public', 'Commercial'], 'Completed', 'Medium', 2019, 'Semnan', '1,860 m²', 'Ministry of Roads',
    'A long shading canopy over fuel, food and prayer, in one continuous move.',
    'Highway service areas are usually a scatter of unrelated sheds. Here a single canopy covers all three functions and the space between them, which makes the whole facility legible at speed and shaded on arrival.'),

  p(62, 'darrous-08-residence', 'Darrous 08 Residence',
    ['Residential'], 'Completed', 'Small', 2019, 'Darrous, Tehran', '1,290 m²', 'Private',
    'A narrow building whose stair sits in the facade, glazed, as the only opening on the north.',
    'On a five-metre frontage there was no room for a stair inside the plan without ruining it. Putting it in the thickness of the north facade, fully glazed, freed the apartments entirely and gave the street a lit vertical line at night.'),

  p(63, 'fasham-weekend-house', 'Fasham Weekend House',
    ['Villa'], 'Completed', 'Small', 2019, 'Fasham, Tehran', '260 m²', 'Private',
    'One room, one hearth, one long window, and a store that closes the house for the winter.',
    'A weekend house that stands empty most of the year needed to be shuttable. Everything reduces to a single volume with a masonry hearth at one end and a full-width shutter that closes the glazing completely when the family leaves.'),

  p(64, 'mashhad-pilgrim-house', 'Mashhad Pilgrim House',
    ['Hospitality', 'Public'], 'Concept', 'Large', 2019, 'Mashhad, Razavi Khorasan', '5,800 m²', 'Astan Endowment',
    'Simple rooms around three courts sized for arrival, rest and washing.',
    'The building serves large groups arriving together. Three courts of decreasing scale take them from the street to their rooms: one for arrival and coaches, one planted for rest, one small and quiet for ablution.'),

  /* ---- 2018 ------------------------------------------------------------ */
  p(65, 'qeytarieh-04-residence', 'Qeytarieh 04 Residence',
    ['Residential'], 'Completed', 'Medium', 2018, 'Qeytarieh, Tehran', '2,310 m²', 'Private',
    'The studio first full brick screen, developed here and used many times since.',
    'This building is where the screen bond was worked out. Bricks turned out of plane, laid to a rhythm that closes the view from the street but not from inside. Every later version of it in the archive descends from this facade.'),

  p(66, 'karaj-industrial-hall', 'Karaj Industrial Hall',
    ['Industrial'], 'Completed', 'Large', 2018, 'Karaj, Alborz', '4,400 m²', 'Karvan Industries',
    'A working building given proper daylight, on the argument that it is cheaper than lighting it.',
    'North-facing roof lights across the full span put even daylight on the floor for most of the working day. The capital cost was recovered in under four years, and the workshop is a markedly better place to spend a shift.'),

  p(67, 'saadat-abad-residence', 'Saadat Abad Residence',
    ['Residential'], 'Completed', 'Medium', 2018, 'Saadat Abad, Tehran', '2,140 m²', 'Private',
    'A courtyard at first-floor level, lifting the private garden above the street.',
    'At ground level the plot was too exposed for a garden. Raising the court to the first floor put it above the wall line and out of view, and turned the ground floor into parking and entry, which is what it was always going to be.'),

  p(68, 'namak-abrud-villa', 'Namak Abrud Villa',
    ['Villa'], 'Completed', 'Small', 2018, 'Namak Abrud, Mazandaran', '390 m²', 'Private',
    'A house between the forest and the sea, open at both ends and closed on its sides.',
    'The plot runs from woodland to shoreline. The house is a tube along that axis, glazed at both ends and solid on the flanks, so you see trees behind and water in front from anywhere inside it.'),

  p(69, 'ekbatan-community-hall', 'Ekbatan Community Hall',
    ['Public'], 'Completed', 'Small', 2018, 'Ekbatan, Tehran', '640 m²', 'Ekbatan Residents Trust',
    'A single flexible room with a full-height sliding wall to the courtyard.',
    'The residents needed one room that could be a hall, a class or a wedding. A clear-span space with a wall that slides fully open to the court doubles its capacity in summer and keeps it warm and small in winter.'),

  /* ---- 2017 ------------------------------------------------------------ */
  p(70, 'zaferaniyeh-residence', 'Zaferaniyeh Residence',
    ['Residential'], 'Completed', 'Medium', 2017, 'Zaferaniyeh, Tehran', '2,020 m²', 'Private',
    'Brick, stone and a garden wall detailed as one continuous piece of masonry.',
    'The boundary wall, the plinth and the building are laid in the same brick with the same bond, so the site reads as a single construction rather than a building placed on a plot.'),

  p(71, 'tehran-gallery-fitout', 'Tehran Gallery Fitout',
    ['Interior Design', 'Public', 'Renovation'], 'Completed', 'Small', 2017, 'Karim Khan, Tehran', '230 m²', 'Private',
    'A gallery lit entirely from a north clerestory, with no fittings visible in the room.',
    'Artificial light in small galleries always shows. Cutting a north clerestory the full length of the space provides even daylight and removes the need for track. Services are confined to a plenum behind the hanging wall.'),

  p(72, 'karaj-terrace-residence', 'Karaj Terrace Residence',
    ['Residential'], 'Completed', 'Medium', 2017, 'Gohardasht, Karaj', '2,380 m²', 'Behin Sazeh',
    'Deep planted terraces on the south face, doing the work of both shade and garden.',
    'Each south-facing terrace is a metre and a half deep and planted at its edge. In summer the planting shades the glazing behind it; in winter it dies back and lets the sun in. It is the cheapest shading device available.'),

  /* ---- 2015–2016 -------------------------------------------------------- */
  p(73, 'niavaran-renovation', 'Niavaran Renovation',
    ['Renovation', 'Residential'], 'Completed', 'Small', 2016, 'Niavaran, Tehran', '320 m²', 'Private',
    'A 1970s house repaired and reorganised without changing a single external opening.',
    'Planning constraints ruled out any change to the elevations, which turned out to be a useful discipline. The whole project happens in the plan: the stair moved, the kitchen turned, and two rooms became one.'),

  p(74, 'shemiran-clinic', 'Shemiran Clinic',
    ['Public'], 'Completed', 'Small', 2016, 'Shemiran, Tehran', '780 m²', 'Sina Health',
    'A small clinic with waiting spaces at the windows and consulting rooms inland.',
    'The usual arrangement gives doctors the windows and patients a corridor. Reversing it costs nothing: consulting rooms work perfectly well with borrowed light, and the people who wait longest get the daylight and the view.'),

  p(75, 'tehran-studio-fitout', 'Kavan Studio Fitout',
    ['Interior Design', 'Office', 'Renovation'], 'Completed', 'Small', 2015, 'Dezashib, Tehran', '410 m²', 'Kavan Studio',
    'Our own studio: one long table, one long wall of drawings, and north light.',
    'A former workshop with good bones and bad services. Everything was stripped back to brick and steel, one twelve-metre table was built down the middle, and the north wall was given over entirely to pinning up drawings.'),

  p(76, 'qeytarieh-first-renovation', 'Qeytarieh Renovation',
    ['Renovation', 'Residential', 'Interior Design'], 'Completed', 'Small', 2013, 'Qeytarieh, Tehran', '140 m²', 'Private',
    'The studio first commission: a small apartment, three walls removed, one window enlarged.',
    'The project that started the practice. A small budget, a young client and a flat that did not work. Removing three partitions and enlarging one window solved almost all of it, which was a useful lesson to begin with.'),
];


/* ---------------------------------------------------------------------------
   derived filter taxonomy — built once at module load
   --------------------------------------------------------------------------- */

const uniq = (a) => [...new Set(a)];

export const FILTERS = [
  {
    id: 'type', label: 'Type',
    options: TYPES.filter((t) => PROJECTS.some((p2) => p2.type.includes(t))),
    match: (p2, v) => p2.type.includes(v),
  },
  {
    id: 'status', label: 'Status',
    options: STATUSES,
    match: (p2, v) => p2.status === v,
  },
  {
    id: 'scale', label: 'Scale',
    options: SCALES,
    match: (p2, v) => p2.scale === v,
  },
  {
    id: 'year', label: 'Year',
    options: uniq(PROJECTS.map((p2) => p2.year)).sort((a, b) => b - a).map(String),
    match: (p2, v) => String(p2.year) === v,
  },
];


export const bySlug = (slug) => PROJECTS.find((p2) => p2.slug === slug);
