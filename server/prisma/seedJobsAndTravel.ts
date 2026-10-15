/**
 * Realistic job catalog + airports / stations / routes.
 * Run via: npx tsx prisma/seedJobsAndTravel.ts
 * Or called from main seed.
 */
import { PrismaClient } from "@prisma/client";
import { planRoutes } from "./travelPlan";

const prisma = new PrismaClient();

type JobSeed = {
  name: string;
  description: string;
  basePay: number;
  requirements: Record<string, number>;
  schedule: { start: number; end: number };
  location: string;
  category: string;
  maxLevel?: number;
};

const JOBS: JobSeed[] = [
  // —— Transport & aviation ——
  { name: "Pilot", description: "Fly commercial routes between airports.", basePay: 220, requirements: { intelligence: 45, fitness: 15 }, schedule: { start: 6, end: 18 }, location: "city", category: "aviation" },
  { name: "Co-Pilot", description: "Assist the captain on flights.", basePay: 160, requirements: { intelligence: 40 }, schedule: { start: 6, end: 18 }, location: "city", category: "aviation" },
  { name: "Flight Attendant", description: "Cabin service on passenger flights.", basePay: 85, requirements: { charisma: 25 }, schedule: { start: 6, end: 18 }, location: "city", category: "aviation" },
  { name: "Air Traffic Controller", description: "Guide aircraft safely.", basePay: 180, requirements: { intelligence: 55 }, schedule: { start: 0, end: 24 }, location: "city", category: "aviation" },
  { name: "Airport Ground Crew", description: "Handle baggage and ramp operations.", basePay: 55, requirements: { strength: 15, fitness: 10 }, schedule: { start: 5, end: 17 }, location: "city", category: "aviation" },
  { name: "Aircraft Mechanic", description: "Maintain and repair aircraft.", basePay: 130, requirements: { intelligence: 35, strength: 15 }, schedule: { start: 7, end: 16 }, location: "city", category: "aviation" },
  { name: "Train Driver", description: "Operate passenger and freight trains.", basePay: 95, requirements: { intelligence: 25, fitness: 10 }, schedule: { start: 5, end: 17 }, location: "city", category: "rail" },
  { name: "Train Conductor", description: "Tickets and passenger safety on trains.", basePay: 60, requirements: { charisma: 15 }, schedule: { start: 6, end: 18 }, location: "city", category: "rail" },
  { name: "Bus Driver", description: "Drive city and intercity buses.", basePay: 55, requirements: { fitness: 10 }, schedule: { start: 5, end: 17 }, location: "city", category: "transport" },
  { name: "Taxi Driver", description: "Drive passengers around the city.", basePay: 50, requirements: { charisma: 10 }, schedule: { start: 0, end: 24 }, location: "city", category: "transport" },
  { name: "Truck Driver", description: "Long-haul and local freight.", basePay: 70, requirements: { strength: 12, fitness: 10 }, schedule: { start: 5, end: 17 }, location: "city", category: "transport" },
  { name: "Delivery Worker", description: "Deliver packages around the city.", basePay: 55, requirements: { fitness: 10 }, schedule: { start: 8, end: 16 }, location: "city", category: "transport" },
  { name: "Courier", description: "Express document and parcel delivery.", basePay: 48, requirements: { fitness: 12 }, schedule: { start: 8, end: 17 }, location: "city", category: "transport" },
  { name: "Ship Captain", description: "Command commercial vessels.", basePay: 200, requirements: { intelligence: 40, strength: 15 }, schedule: { start: 0, end: 24 }, location: "city", category: "maritime" },
  { name: "Dock Worker", description: "Load and unload cargo at ports.", basePay: 58, requirements: { strength: 25 }, schedule: { start: 6, end: 16 }, location: "city", category: "maritime" },

  // —— Construction ——
  { name: "Bricklayer", description: "Lay bricks on construction projects.", basePay: 70, requirements: { strength: 15, fitness: 10 }, schedule: { start: 7, end: 16 }, location: "city", category: "construction" },
  { name: "Carpenter", description: "Framing and woodwork on builds.", basePay: 65, requirements: { strength: 12, creativity: 10 }, schedule: { start: 7, end: 16 }, location: "city", category: "construction" },
  { name: "Electrician", description: "Wiring on buildings and sites.", basePay: 80, requirements: { intelligence: 20, strength: 8 }, schedule: { start: 8, end: 17 }, location: "city", category: "construction" },
  { name: "Plumber", description: "Pipes and plumbing installs.", basePay: 75, requirements: { strength: 12, intelligence: 12 }, schedule: { start: 8, end: 17 }, location: "city", category: "construction" },
  { name: "Painter", description: "Paint and finish buildings.", basePay: 55, requirements: { creativity: 10, fitness: 5 }, schedule: { start: 8, end: 16 }, location: "city", category: "construction" },
  { name: "Architect", description: "Design buildings and oversee plans.", basePay: 150, requirements: { intelligence: 50, creativity: 35 }, schedule: { start: 9, end: 17 }, location: "city", category: "construction" },
  { name: "Civil Engineer", description: "Infrastructure and structural design.", basePay: 155, requirements: { intelligence: 55 }, schedule: { start: 9, end: 17 }, location: "city", category: "construction" },
  { name: "Construction Manager", description: "Run construction sites and crews.", basePay: 140, requirements: { intelligence: 35, charisma: 25 }, schedule: { start: 7, end: 17 }, location: "city", category: "construction" },
  { name: "Welder", description: "Metal fabrication and welding.", basePay: 72, requirements: { strength: 18 }, schedule: { start: 7, end: 16 }, location: "city", category: "construction" },
  { name: "Roofer", description: "Install and repair roofs.", basePay: 62, requirements: { strength: 20, fitness: 15 }, schedule: { start: 7, end: 15 }, location: "city", category: "construction" },
  { name: "Crane Operator", description: "Operate tower and mobile cranes.", basePay: 90, requirements: { intelligence: 20, strength: 10 }, schedule: { start: 7, end: 16 }, location: "city", category: "construction" },

  // —— Medical ——
  { name: "Doctor", description: "Diagnose and treat patients.", basePay: 200, requirements: { intelligence: 60 }, schedule: { start: 7, end: 19 }, location: "hospital", category: "medical" },
  { name: "Surgeon", description: "Perform surgical operations.", basePay: 280, requirements: { intelligence: 70, strength: 10 }, schedule: { start: 6, end: 18 }, location: "hospital", category: "medical" },
  { name: "Nurse", description: "Patient care in hospitals and clinics.", basePay: 95, requirements: { intelligence: 30, charisma: 20 }, schedule: { start: 7, end: 19 }, location: "hospital", category: "medical" },
  { name: "Paramedic", description: "Emergency medical response.", basePay: 85, requirements: { fitness: 25, intelligence: 25 }, schedule: { start: 0, end: 24 }, location: "hospital", category: "medical" },
  { name: "Pharmacist", description: "Dispense medication and advice.", basePay: 120, requirements: { intelligence: 50 }, schedule: { start: 9, end: 17 }, location: "city", category: "medical" },
  { name: "Dentist", description: "Dental care and procedures.", basePay: 170, requirements: { intelligence: 50 }, schedule: { start: 9, end: 17 }, location: "city", category: "medical" },
  { name: "Physiotherapist", description: "Rehab and physical therapy.", basePay: 100, requirements: { fitness: 20, intelligence: 30 }, schedule: { start: 9, end: 17 }, location: "city", category: "medical" },
  { name: "Veterinarian", description: "Treat animals.", basePay: 130, requirements: { intelligence: 45 }, schedule: { start: 9, end: 17 }, location: "city", category: "medical" },
  { name: "Lab Technician", description: "Run medical lab tests.", basePay: 70, requirements: { intelligence: 35 }, schedule: { start: 8, end: 16 }, location: "hospital", category: "medical" },

  // —— Education ——
  { name: "Teacher", description: "Teach at the school.", basePay: 85, requirements: { intelligence: 40, charisma: 20 }, schedule: { start: 8, end: 15 }, location: "school", category: "education" },
  { name: "University Professor", description: "Lecture and research at university.", basePay: 140, requirements: { intelligence: 60 }, schedule: { start: 9, end: 16 }, location: "university", category: "education" },
  { name: "Teaching Assistant", description: "Support classroom teaching.", basePay: 45, requirements: { intelligence: 25 }, schedule: { start: 8, end: 15 }, location: "school", category: "education" },
  { name: "School Principal", description: "Lead a school.", basePay: 130, requirements: { intelligence: 45, charisma: 35 }, schedule: { start: 7, end: 16 }, location: "school", category: "education" },
  { name: "Librarian", description: "Manage library resources.", basePay: 55, requirements: { intelligence: 25 }, schedule: { start: 9, end: 17 }, location: "city", category: "education" },
  { name: "Tutor", description: "Private academic tutoring.", basePay: 50, requirements: { intelligence: 35, charisma: 15 }, schedule: { start: 14, end: 20 }, location: "city", category: "education" },

  // —— Public safety ——
  { name: "Police Officer", description: "Keep the city safe.", basePay: 95, requirements: { strength: 25, fitness: 20 }, schedule: { start: 8, end: 16 }, location: "police", category: "safety" },
  { name: "Detective", description: "Investigate crimes.", basePay: 120, requirements: { intelligence: 40, fitness: 20 }, schedule: { start: 9, end: 18 }, location: "police", category: "safety" },
  { name: "Firefighter", description: "Fight fires and rescue.", basePay: 100, requirements: { strength: 30, fitness: 30 }, schedule: { start: 0, end: 24 }, location: "city", category: "safety" },
  { name: "Security Guard", description: "Protect buildings and events.", basePay: 48, requirements: { strength: 15 }, schedule: { start: 0, end: 24 }, location: "city", category: "safety" },
  { name: "Border Officer", description: "Immigration and border control.", basePay: 80, requirements: { intelligence: 25, charisma: 15 }, schedule: { start: 6, end: 18 }, location: "city", category: "safety" },
  { name: "Lawyer", description: "Legal counsel and court work.", basePay: 160, requirements: { intelligence: 55, charisma: 30 }, schedule: { start: 9, end: 18 }, location: "city", category: "legal" },
  { name: "Judge", description: "Preside over court cases.", basePay: 220, requirements: { intelligence: 65, charisma: 25 }, schedule: { start: 9, end: 16 }, location: "city", category: "legal" },
  { name: "Paralegal", description: "Support legal teams.", basePay: 65, requirements: { intelligence: 35 }, schedule: { start: 9, end: 17 }, location: "city", category: "legal" },

  // —— Food & hospitality ——
  { name: "Restaurant Worker", description: "Serve and support restaurant service.", basePay: 50, requirements: { cooking: 5, charisma: 5 }, schedule: { start: 10, end: 18 }, location: "restaurant", category: "hospitality" },
  { name: "Chef", description: "Run the kitchen.", basePay: 110, requirements: { cooking: 40, creativity: 20 }, schedule: { start: 10, end: 22 }, location: "restaurant", category: "hospitality" },
  { name: "Bartender", description: "Mix drinks and serve guests.", basePay: 55, requirements: { charisma: 20 }, schedule: { start: 16, end: 2 }, location: "city", category: "hospitality" },
  { name: "Hotel Receptionist", description: "Front desk at hotels.", basePay: 52, requirements: { charisma: 25 }, schedule: { start: 0, end: 24 }, location: "city", category: "hospitality" },
  { name: "Hotel Manager", description: "Manage hotel operations.", basePay: 125, requirements: { charisma: 30, intelligence: 30 }, schedule: { start: 8, end: 18 }, location: "city", category: "hospitality" },
  { name: "Waiter", description: "Table service in restaurants.", basePay: 45, requirements: { charisma: 15 }, schedule: { start: 11, end: 22 }, location: "restaurant", category: "hospitality" },
  { name: "Baker", description: "Bake bread and pastries.", basePay: 58, requirements: { cooking: 25 }, schedule: { start: 4, end: 12 }, location: "city", category: "hospitality" },
  { name: "Barista", description: "Coffee shop service.", basePay: 42, requirements: { charisma: 12 }, schedule: { start: 7, end: 15 }, location: "city", category: "hospitality" },

  // —— Retail & business ——
  { name: "Shop Worker", description: "Retail floor and till.", basePay: 45, requirements: { charisma: 5 }, schedule: { start: 9, end: 17 }, location: "shop", category: "retail" },
  { name: "Store Manager", description: "Manage a retail store.", basePay: 90, requirements: { charisma: 25, intelligence: 20 }, schedule: { start: 8, end: 18 }, location: "shop", category: "retail" },
  { name: "Cashier", description: "Handle payments.", basePay: 40, requirements: {}, schedule: { start: 9, end: 17 }, location: "shop", category: "retail" },
  { name: "Real Estate Agent", description: "Sell and rent properties.", basePay: 100, requirements: { charisma: 35 }, schedule: { start: 9, end: 18 }, location: "city", category: "business" },
  { name: "Accountant", description: "Books, tax, and finance.", basePay: 110, requirements: { intelligence: 45 }, schedule: { start: 9, end: 17 }, location: "city", category: "business" },
  { name: "Bank Teller", description: "Serve bank customers.", basePay: 55, requirements: { intelligence: 20, charisma: 15 }, schedule: { start: 9, end: 16 }, location: "city", category: "business" },
  { name: "Bank Manager", description: "Run a bank branch.", basePay: 145, requirements: { intelligence: 40, charisma: 30 }, schedule: { start: 9, end: 17 }, location: "city", category: "business" },
  { name: "Insurance Agent", description: "Sell insurance products.", basePay: 75, requirements: { charisma: 30 }, schedule: { start: 9, end: 17 }, location: "city", category: "business" },
  { name: "HR Manager", description: "People and hiring operations.", basePay: 115, requirements: { charisma: 35, intelligence: 30 }, schedule: { start: 9, end: 17 }, location: "city", category: "business" },
  { name: "Marketing Manager", description: "Campaigns and brand growth.", basePay: 125, requirements: { creativity: 30, charisma: 30 }, schedule: { start: 9, end: 18 }, location: "city", category: "business" },
  { name: "Sales Representative", description: "B2B and product sales.", basePay: 70, requirements: { charisma: 30 }, schedule: { start: 9, end: 18 }, location: "city", category: "business" },
  { name: "Entrepreneur", description: "Run your own ventures.", basePay: 80, requirements: { creativity: 25, charisma: 20 }, schedule: { start: 8, end: 20 }, location: "city", category: "business" },

  // —— Tech ——
  { name: "Developer", description: "Software engineering.", basePay: 140, requirements: { intelligence: 45, creativity: 25 }, schedule: { start: 9, end: 17 }, location: "city", category: "tech" },
  { name: "Data Scientist", description: "Analyze data and models.", basePay: 155, requirements: { intelligence: 55 }, schedule: { start: 9, end: 17 }, location: "city", category: "tech" },
  { name: "IT Support", description: "Help desks and tech support.", basePay: 60, requirements: { intelligence: 25 }, schedule: { start: 9, end: 18 }, location: "city", category: "tech" },
  { name: "Cybersecurity Analyst", description: "Protect systems and networks.", basePay: 150, requirements: { intelligence: 50 }, schedule: { start: 9, end: 18 }, location: "city", category: "tech" },
  { name: "Game Designer", description: "Design games and systems.", basePay: 120, requirements: { creativity: 40, intelligence: 30 }, schedule: { start: 10, end: 18 }, location: "city", category: "tech" },
  { name: "UI Designer", description: "Interfaces and visual design.", basePay: 110, requirements: { creativity: 40 }, schedule: { start: 10, end: 18 }, location: "city", category: "tech" },

  // —— Creative & media ——
  { name: "Journalist", description: "Report news and stories.", basePay: 70, requirements: { intelligence: 30, creativity: 25 }, schedule: { start: 9, end: 18 }, location: "city", category: "media" },
  { name: "Photographer", description: "Photo shoots and events.", basePay: 65, requirements: { creativity: 30 }, schedule: { start: 10, end: 18 }, location: "city", category: "media" },
  { name: "Musician", description: "Perform and create music.", basePay: 55, requirements: { creativity: 35, charisma: 20 }, schedule: { start: 14, end: 23 }, location: "city", category: "media" },
  { name: "Actor", description: "Film, TV, and stage.", basePay: 60, requirements: { charisma: 40, creativity: 25 }, schedule: { start: 10, end: 20 }, location: "city", category: "media" },
  { name: "Writer", description: "Books, scripts, and content.", basePay: 58, requirements: { creativity: 35, intelligence: 25 }, schedule: { start: 9, end: 17 }, location: "city", category: "media" },
  { name: "Streamer", description: "Live content creation.", basePay: 50, requirements: { charisma: 25, creativity: 20 }, schedule: { start: 14, end: 23 }, location: "city", category: "media" },
  { name: "Fashion Designer", description: "Design clothing lines.", basePay: 95, requirements: { creativity: 45 }, schedule: { start: 10, end: 18 }, location: "city", category: "media" },

  // —— Fitness & lifestyle ——
  { name: "Personal Trainer", description: "Train clients at the gym.", basePay: 70, requirements: { fitness: 35, charisma: 20 }, schedule: { start: 6, end: 20 }, location: "gym", category: "fitness" },
  { name: "Gym Staff", description: "Operate gym floor.", basePay: 45, requirements: { fitness: 15 }, schedule: { start: 6, end: 22 }, location: "gym", category: "fitness" },
  { name: "Athlete", description: "Professional sports.", basePay: 120, requirements: { fitness: 50, strength: 30 }, schedule: { start: 6, end: 16 }, location: "city", category: "fitness" },
  { name: "Sports Coach", description: "Coach teams and athletes.", basePay: 85, requirements: { fitness: 30, charisma: 25 }, schedule: { start: 8, end: 18 }, location: "city", category: "fitness" },
  { name: "Hair Stylist", description: "Haircuts and styling.", basePay: 55, requirements: { creativity: 25, charisma: 20 }, schedule: { start: 9, end: 18 }, location: "city", category: "lifestyle" },
  { name: "Barber", description: "Barber shop cuts and fades.", basePay: 52, requirements: { creativity: 15, charisma: 15 }, schedule: { start: 9, end: 18 }, location: "city", category: "lifestyle" },
  { name: "Cleaner", description: "Clean homes and offices.", basePay: 40, requirements: { fitness: 10 }, schedule: { start: 6, end: 14 }, location: "city", category: "lifestyle" },
  { name: "Gardener", description: "Landscaping and gardens.", basePay: 48, requirements: { fitness: 15 }, schedule: { start: 7, end: 15 }, location: "city", category: "lifestyle" },
  { name: "Farmer", description: "Grow crops and raise animals.", basePay: 55, requirements: { strength: 20, fitness: 15 }, schedule: { start: 5, end: 15 }, location: "city", category: "agriculture" },
  { name: "Mechanic", description: "Repair cars and vehicles.", basePay: 75, requirements: { strength: 15, intelligence: 20 }, schedule: { start: 8, end: 17 }, location: "city", category: "trades" },
  { name: "Auto Electrician", description: "Vehicle electrical systems.", basePay: 78, requirements: { intelligence: 25 }, schedule: { start: 8, end: 17 }, location: "city", category: "trades" },

  // —— Government & civic ——
  { name: "Civil Servant", description: "Government administration.", basePay: 70, requirements: { intelligence: 30 }, schedule: { start: 9, end: 17 }, location: "city", category: "government" },
  { name: "Diplomat", description: "International relations.", basePay: 160, requirements: { intelligence: 50, charisma: 40 }, schedule: { start: 9, end: 18 }, location: "city", category: "government" },
  { name: "Postal Worker", description: "Sort and deliver mail.", basePay: 48, requirements: { fitness: 12 }, schedule: { start: 7, end: 15 }, location: "city", category: "government" },
  { name: "Sanitation Worker", description: "City cleaning and waste.", basePay: 50, requirements: { strength: 20, fitness: 15 }, schedule: { start: 5, end: 13 }, location: "city", category: "government" },
];

export async function seedJobs(prismaClient: PrismaClient = prisma) {
  for (const job of JOBS) {
    await prismaClient.job.upsert({
      where: { name: job.name },
      update: {
        description: job.description,
        basePay: job.basePay,
        requirements: job.requirements as any,
        schedule: job.schedule as any,
        location: job.location,
        category: job.category,
        maxLevel: job.maxLevel ?? 5,
      },
      create: {
        name: job.name,
        description: job.description,
        basePay: job.basePay,
        requirements: job.requirements as any,
        schedule: job.schedule as any,
        location: job.location,
        category: job.category,
        maxLevel: job.maxLevel ?? 5,
      },
    });
  }
  console.log(`Seeded ${JOBS.length} jobs`);
}

/** Airports: ~density by country importance; some small countries fewer */
const AIRPORTS: { country: string; code: string; name: string; cityKey: string; size: string; posX: number; posZ: number }[] = [
  // Nigeria
  { country: "NG", code: "LOS", name: "Murtala Muhammed Intl", cityKey: "lagos", size: "hub", posX: 36, posZ: -36 },
  { country: "NG", code: "ABV", name: "Nnamdi Azikiwe Intl", cityKey: "abuja", size: "large", posX: 34, posZ: -34 },
  { country: "NG", code: "PHC", name: "Port Harcourt Intl", cityKey: "lagos", size: "medium", posX: 38, posZ: -30 },
  { country: "NG", code: "KAN", name: "Mallam Aminu Kano", cityKey: "abuja", size: "medium", posX: 30, posZ: -38 },
  { country: "NG", code: "ENU", name: "Akanu Ibiam", cityKey: "lagos", size: "small", posX: 32, posZ: -32 },
  { country: "NG", code: "CBQ", name: "Calabar Airport", cityKey: "lagos", size: "small", posX: 40, posZ: -34 },
  // US
  { country: "US", code: "JFK", name: "John F Kennedy Intl", cityKey: "nyc", size: "hub", posX: 36, posZ: -36 },
  { country: "US", code: "LAX", name: "Los Angeles Intl", cityKey: "starter", size: "hub", posX: 38, posZ: -34 },
  { country: "US", code: "ORD", name: "O'Hare Intl", cityKey: "starter", size: "hub", posX: 34, posZ: -38 },
  { country: "US", code: "ATL", name: "Hartsfield-Jackson", cityKey: "starter", size: "hub", posX: 32, posZ: -32 },
  { country: "US", code: "DFW", name: "Dallas/Fort Worth", cityKey: "starter", size: "large", posX: 30, posZ: -36 },
  { country: "US", code: "SFO", name: "San Francisco Intl", cityKey: "starter", size: "large", posX: 40, posZ: -30 },
  { country: "US", code: "MIA", name: "Miami Intl", cityKey: "nyc", size: "large", posX: 28, posZ: -34 },
  { country: "US", code: "SEA", name: "Seattle-Tacoma", cityKey: "starter", size: "medium", posX: 42, posZ: -38 },
  // UK
  { country: "GB", code: "LHR", name: "London Heathrow", cityKey: "london", size: "hub", posX: 36, posZ: -36 },
  { country: "GB", code: "LGW", name: "London Gatwick", cityKey: "london", size: "large", posX: 34, posZ: -32 },
  { country: "GB", code: "MAN", name: "Manchester Airport", cityKey: "london", size: "large", posX: 30, posZ: -38 },
  { country: "GB", code: "EDI", name: "Edinburgh Airport", cityKey: "london", size: "medium", posX: 38, posZ: -30 },
  { country: "GB", code: "BHX", name: "Birmingham Airport", cityKey: "london", size: "medium", posX: 32, posZ: -34 },
  // Japan
  { country: "JP", code: "HND", name: "Tokyo Haneda", cityKey: "tokyo", size: "hub", posX: 36, posZ: -36 },
  { country: "JP", code: "NRT", name: "Tokyo Narita", cityKey: "tokyo", size: "hub", posX: 38, posZ: -32 },
  { country: "JP", code: "KIX", name: "Kansai Intl", cityKey: "tokyo", size: "large", posX: 32, posZ: -38 },
  { country: "JP", code: "CTS", name: "New Chitose", cityKey: "tokyo", size: "medium", posX: 30, posZ: -30 },
  // Brazil
  { country: "BR", code: "GRU", name: "São Paulo Guarulhos", cityKey: "saopaulo", size: "hub", posX: 36, posZ: -36 },
  { country: "BR", code: "GIG", name: "Rio Galeão", cityKey: "saopaulo", size: "large", posX: 34, posZ: -32 },
  { country: "BR", code: "BSB", name: "Brasília Intl", cityKey: "saopaulo", size: "medium", posX: 30, posZ: -38 },
  // India
  { country: "IN", code: "BOM", name: "Mumbai CSIA", cityKey: "mumbai", size: "hub", posX: 36, posZ: -36 },
  { country: "IN", code: "DEL", name: "Delhi Indira Gandhi", cityKey: "mumbai", size: "hub", posX: 34, posZ: -32 },
  { country: "IN", code: "BLR", name: "Bengaluru Intl", cityKey: "mumbai", size: "large", posX: 30, posZ: -38 },
  { country: "IN", code: "MAA", name: "Chennai Intl", cityKey: "mumbai", size: "medium", posX: 38, posZ: -30 },
  // South Africa
  { country: "ZA", code: "JNB", name: "O.R. Tambo Intl", cityKey: "capetown", size: "hub", posX: 36, posZ: -36 },
  { country: "ZA", code: "CPT", name: "Cape Town Intl", cityKey: "capetown", size: "large", posX: 34, posZ: -32 },
  { country: "ZA", code: "DUR", name: "King Shaka Intl", cityKey: "capetown", size: "medium", posX: 30, posZ: -38 },
  // UAE
  { country: "AE", code: "DXB", name: "Dubai Intl", cityKey: "dubai", size: "hub", posX: 36, posZ: -36 },
  { country: "AE", code: "AUH", name: "Abu Dhabi Intl", cityKey: "dubai", size: "hub", posX: 34, posZ: -32 },
  { country: "AE", code: "SHJ", name: "Sharjah Intl", cityKey: "dubai", size: "medium", posX: 30, posZ: -38 },
];

const STATIONS: { country: string; code: string; name: string; cityKey: string; posX: number; posZ: number }[] = [
  { country: "NG", code: "LOS-RAIL", name: "Lagos Central Station", cityKey: "lagos", posX: -36, posZ: 36 },
  { country: "NG", code: "ABV-RAIL", name: "Abuja Station", cityKey: "abuja", posX: -34, posZ: 34 },
  { country: "US", code: "NYP", name: "New York Penn Station", cityKey: "nyc", posX: -36, posZ: 36 },
  { country: "US", code: "STC-RAIL", name: "Starter Central Station", cityKey: "starter", posX: -36, posZ: 36 },
  { country: "GB", code: "KGX", name: "London Kings Cross", cityKey: "london", posX: -36, posZ: 36 },
  { country: "JP", code: "TYO", name: "Tokyo Station", cityKey: "tokyo", posX: -36, posZ: 36 },
  { country: "BR", code: "SP-RAIL", name: "São Paulo Luz", cityKey: "saopaulo", posX: -36, posZ: 36 },
  { country: "IN", code: "CSTM", name: "Mumbai CSMT", cityKey: "mumbai", posX: -36, posZ: 36 },
  { country: "ZA", code: "CPT-RAIL", name: "Cape Town Station", cityKey: "capetown", posX: -36, posZ: 36 },
  { country: "AE", code: "DXB-METRO", name: "Dubai Metro Central", cityKey: "dubai", posX: -36, posZ: 36 },
];

export async function seedTravel(prismaClient: PrismaClient = prisma) {
  for (const a of AIRPORTS) {
    const country = await prismaClient.country.findUnique({ where: { code: a.country } });
    if (!country) continue;
    await prismaClient.airport.upsert({
      where: { code: a.code },
      update: { name: a.name, cityKey: a.cityKey, size: a.size, posX: a.posX, posZ: a.posZ },
      create: {
        countryId: country.id,
        code: a.code,
        name: a.name,
        cityKey: a.cityKey,
        size: a.size,
        posX: a.posX,
        posZ: a.posZ,
        international: a.size !== "small",
      },
    });
  }

  for (const s of STATIONS) {
    const country = await prismaClient.country.findUnique({ where: { code: s.country } });
    if (!country) continue;
    await prismaClient.trainStation.upsert({
      where: { code: s.code },
      update: { name: s.name, cityKey: s.cityKey, posX: s.posX, posZ: s.posZ },
      create: {
        countryId: country.id,
        code: s.code,
        name: s.name,
        cityKey: s.cityKey,
        posX: s.posX,
        posZ: s.posZ,
      },
    });
  }

  // Every country needs at least one airport so the whole world is reachable: put one at its capital city.
  const allCities = await prismaClient.city.findMany({
    select: { key: true, countryId: true, stateId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const capitalByCountry: Record<string, string> = {};
  for (const c of allCities) if (!capitalByCountry[c.countryId]) capitalByCountry[c.countryId] = c.key;

  const countries = await prismaClient.country.findMany({ select: { id: true, code: true } });
  for (const country of countries) {
    const has = await prismaClient.airport.count({ where: { countryId: country.id } });
    const capital = capitalByCountry[country.id];
    if (has === 0 && capital) {
      await prismaClient.airport.upsert({
        where: { code: `${country.code}-HUB` },
        update: { cityKey: capital },
        create: { countryId: country.id, code: `${country.code}-HUB`, name: `${country.code} International`, cityKey: capital, size: "large", posX: 35, posZ: -35 },
      });
    }
  }

  const airports = await prismaClient.airport.findMany({ select: { code: true, cityKey: true } });
  const stations = await prismaClient.trainStation.findMany({ select: { code: true, cityKey: true } });
  const rows = planRoutes(
    allCities.map((c) => ({ key: c.key, countryId: c.countryId, stateId: c.stateId })),
    airports,
    stations,
    capitalByCountry
  );

  await prismaClient.travelRoute.deleteMany({}); // refresh routes
  for (let i = 0; i < rows.length; i += 1000) {
    await prismaClient.travelRoute.createMany({ data: rows.slice(i, i + 1000) });
  }
  console.log(`Seeded ${airports.length} airports, ${stations.length} stations, ${rows.length} routes`);
}

async function main() {
  await seedJobs();
  await seedTravel();
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { JOBS };
