import { PrismaClient } from "@prisma/client";
import { seedJobs } from "./seedJobsAndTravel";
import { ITEM_CATALOG } from "../src/game/items/catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  await prisma.worldState.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", gameTime: 8, day: 1, weather: "sunny" },
  });

  // Items
  for (const item of ITEM_CATALOG) {
    await prisma.item.upsert({
      where: { key: item.key },
      update: {
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        stackable: item.stackable,
        maxStack: item.maxStack,
        effects: item.effects as any,
        slot: item.slot ?? null,
        icon: item.icon,
      },
      create: {
        key: item.key,
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        stackable: item.stackable,
        maxStack: item.maxStack,
        effects: item.effects as any,
        slot: item.slot ?? null,
        icon: item.icon,
      },
    });
  }

  // Shops
  const shops = [
    {
      key: "general_store",
      name: "General Store",
      description: "Everyday goods and snacks.",
      location: "shop",
      posX: -18,
      posY: 0,
      posZ: 15,
      items: [
        { itemKey: "apple" },
        { itemKey: "water" },
        { itemKey: "coffee" },
        { itemKey: "notebook" },
        { itemKey: "bandage" },
        { itemKey: "energy_drink" },
      ],
    },
    {
      key: "restaurant",
      name: "City Restaurant",
      description: "Hot meals and drinks.",
      location: "restaurant",
      posX: 18,
      posY: 0,
      posZ: 12,
      items: [
        { itemKey: "burger" },
        { itemKey: "pizza" },
        { itemKey: "salad" },
        { itemKey: "ramen" },
        { itemKey: "coffee" },
      ],
    },
    {
      key: "clothing_shop",
      name: "Fashion Corner",
      description: "Clothes and accessories.",
      location: "shop",
      posX: -18,
      posY: 0,
      posZ: 15,
      items: [
        { itemKey: "tshirt_blue" },
        { itemKey: "hoodie_black" },
        { itemKey: "jeans" },
        { itemKey: "shorts" },
        { itemKey: "cap" },
        { itemKey: "glasses" },
      ],
    },
  ];

  for (const s of shops) {
    await prisma.shop.upsert({
      where: { key: s.key },
      update: { items: s.items as any, name: s.name },
      create: {
        key: s.key,
        name: s.name,
        description: s.description,
        location: s.location,
        posX: s.posX,
        posY: s.posY,
        posZ: s.posZ,
        items: s.items as any,
      },
    });
  }

  // Jobs
  const jobs = [
    { name: "Shop Worker", category: "retail", description: "Stock shelves and help customers.", basePay: 45, requirements: { charisma: 5 }, schedule: { start: 9, end: 17 }, location: "shop", maxLevel: 5 },
    { name: "Restaurant Worker", category: "hospitality", description: "Serve food and clean tables.", basePay: 50, requirements: { cooking: 5, charisma: 5 }, schedule: { start: 10, end: 18 }, location: "restaurant", maxLevel: 5 },
    { name: "Teacher", category: "education", description: "Teach students at the school.", basePay: 85, requirements: { intelligence: 40, charisma: 20 }, schedule: { start: 8, end: 15 }, location: "school", maxLevel: 5 },
    { name: "Developer", category: "tech", description: "Write code at a tech workplace.", basePay: 120, requirements: { intelligence: 45, creativity: 25 }, schedule: { start: 9, end: 17 }, location: "city", maxLevel: 5 },
    { name: "Doctor", category: "medical", description: "Treat patients at the hospital.", basePay: 150, requirements: { intelligence: 60 }, schedule: { start: 7, end: 19 }, location: "hospital", maxLevel: 5 },
    { name: "Police Officer", category: "safety", description: "Keep the city safe.", basePay: 95, requirements: { strength: 25, fitness: 20 }, schedule: { start: 8, end: 16 }, location: "police", maxLevel: 5 },
    { name: "Bricklayer", category: "construction", description: "Lay bricks and build structures for player construction projects.", basePay: 70, requirements: { strength: 15, fitness: 10 }, schedule: { start: 7, end: 16 }, location: "city", maxLevel: 5 },
    { name: "Carpenter", category: "construction", description: "Woodwork and framing on construction sites.", basePay: 65, requirements: { strength: 12, creativity: 10 }, schedule: { start: 7, end: 16 }, location: "city", maxLevel: 5 },
    { name: "Electrician", category: "construction", description: "Install wiring on player buildings under construction.", basePay: 80, requirements: { intelligence: 20, strength: 8 }, schedule: { start: 8, end: 17 }, location: "city", maxLevel: 5 },
    { name: "Plumber", category: "construction", description: "Install pipes and plumbing on construction projects.", basePay: 75, requirements: { strength: 12, intelligence: 12 }, schedule: { start: 8, end: 17 }, location: "city", maxLevel: 5 },
    { name: "Painter", category: "construction", description: "Paint and finish player-built buildings.", basePay: 55, requirements: { creativity: 10, fitness: 5 }, schedule: { start: 8, end: 16 }, location: "city", maxLevel: 5 },
    { name: "Delivery Worker", category: "transport", description: "Deliver packages around the city.", basePay: 55, requirements: { fitness: 10 }, schedule: { start: 8, end: 16 }, location: "city", maxLevel: 5 },
  ];

  for (const job of jobs) {
    await prisma.job.upsert({
      where: { name: job.name },
      update: {
        basePay: job.basePay,
        requirements: job.requirements as any,
        schedule: job.schedule as any,
        location: job.location,
        maxLevel: job.maxLevel,
        category: job.category,
      },
      create: {
        name: job.name,
        description: job.description,
        basePay: job.basePay,
        requirements: job.requirements as any,
        schedule: job.schedule as any,
        location: job.location,
        maxLevel: job.maxLevel,
        category: job.category,
      },
    });
  }

  // Properties
  const properties = [
    { name: "Studio Apartment A", type: "apartment", price: 25000, rent: 350, posX: 20, posY: 0, posZ: -8, interiorKey: "apartment_basic" },
    { name: "Studio Apartment B", type: "apartment", price: 28000, rent: 380, posX: -35, posY: 0, posZ: -5, interiorKey: "apartment_basic" },
    { name: "Small House 1", type: "house", price: 65000, rent: 0, posX: 12, posY: 0, posZ: 35, interiorKey: "house_basic" },
    { name: "Small House 2", type: "house", price: 70000, rent: 0, posX: 22, posY: 0, posZ: 38, interiorKey: "house_basic" },
    { name: "Small House 3", type: "house", price: 68000, rent: 0, posX: -12, posY: 0, posZ: 38, interiorKey: "house_basic" },
  ];

  for (const p of properties) {
    const existing = await prisma.property.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.property.create({ data: p });
    }
  }


  // Countries, cities, build plots
  console.log("Seeding countries...");
  const worldData = [
    {
      code: "NG", name: "Nigeria", flag: "🇳🇬", mapX: 52, mapY: 52,
      cities: [
        { key: "lagos", name: "Lagos", mapX: 40, mapY: 55, districtKey: "downtown" },
        { key: "abuja", name: "Abuja", mapX: 50, mapY: 40, districtKey: "downtown" },
      ],
    },
    {
      code: "US", name: "United States", flag: "🇺🇸", mapX: 22, mapY: 38,
      cities: [
        { key: "starter", name: "Starter City", mapX: 50, mapY: 50, districtKey: "downtown" },
        { key: "nyc", name: "New York", mapX: 72, mapY: 42, districtKey: "downtown" },
      ],
    },
    {
      code: "GB", name: "United Kingdom", flag: "🇬🇧", mapX: 48, mapY: 32,
      cities: [{ key: "london", name: "London", mapX: 50, mapY: 50, districtKey: "downtown" }],
    },
    {
      code: "JP", name: "Japan", flag: "🇯🇵", mapX: 82, mapY: 40,
      cities: [{ key: "tokyo", name: "Tokyo", mapX: 55, mapY: 48, districtKey: "downtown" }],
    },
    {
      code: "BR", name: "Brazil", flag: "🇧🇷", mapX: 32, mapY: 62,
      cities: [{ key: "saopaulo", name: "São Paulo", mapX: 50, mapY: 50, districtKey: "downtown" }],
    },
    {
      code: "IN", name: "India", flag: "🇮🇳", mapX: 68, mapY: 48,
      cities: [{ key: "mumbai", name: "Mumbai", mapX: 40, mapY: 55, districtKey: "downtown" }],
    },
    {
      code: "ZA", name: "South Africa", flag: "🇿🇦", mapX: 55, mapY: 72,
      cities: [{ key: "capetown", name: "Cape Town", mapX: 45, mapY: 60, districtKey: "downtown" }],
    },
    {
      code: "AE", name: "UAE", flag: "🇦🇪", mapX: 62, mapY: 45,
      cities: [{ key: "dubai", name: "Dubai", mapX: 55, mapY: 50, districtKey: "downtown" }],
    },
  ];

  const plotOffsets = [
    { name: "Plot A", posX: 15, posZ: 20, price: 8000 },
    { name: "Plot B", posX: -15, posZ: 18, price: 7500 },
    { name: "Plot C", posX: 25, posZ: -15, price: 9000 },
    { name: "Plot D", posX: -22, posZ: -12, price: 7000 },
    { name: "Plot E", posX: 8, posZ: 28, price: 8500 },
    { name: "Plot F", posX: -8, posZ: -28, price: 6500 },
  ];

  for (const c of worldData) {
    const country = await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, flag: c.flag, mapX: c.mapX, mapY: c.mapY },
      create: { code: c.code, name: c.name, flag: c.flag, mapX: c.mapX, mapY: c.mapY },
    });
    for (const city of c.cities) {
      const cityRow = await prisma.city.upsert({
        where: { key: city.key },
        update: { name: city.name, mapX: city.mapX, mapY: city.mapY },
        create: {
          countryId: country.id,
          key: city.key,
          name: city.name,
          mapX: city.mapX,
          mapY: city.mapY,
          districtKey: city.districtKey,
        },
      });
      const existingPlots = await prisma.buildPlot.count({ where: { cityId: cityRow.id } });
      if (existingPlots === 0) {
        for (const pl of plotOffsets) {
          await prisma.buildPlot.create({
            data: {
              cityId: cityRow.id,
              name: `${city.name} ${pl.name}`,
              posX: pl.posX,
              posZ: pl.posZ,
              size: 8,
              price: pl.price,
            },
          });
        }
      }
    }
  }
  console.log("Countries, cities, plots seeded");

  await seedJobs(prisma);
  // Travel routes are built at the end of seed-world.ts, once all cities exist.

  console.log("Seed complete: items, shops, jobs, properties, world, countries");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
