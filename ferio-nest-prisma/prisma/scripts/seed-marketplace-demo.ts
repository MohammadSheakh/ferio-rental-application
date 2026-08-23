/**
 * Seed realistic Dhaka marketplace listings against a live PostGIS instance.
 * Idempotent: keyed on seller centralUserId `demo_seed_seller`.
 */
import { PrismaClient as MarketplaceClient, Prisma } from '@prisma/marketplace-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const db = new MarketplaceClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString:
        process.env.MARKETPLACE_DATABASE_URL ??
        'postgresql://postgres:testpass@localhost:5498/ferio_marketplace',
    }),
  ),
} as any);

const SELLER = {
  centralUserId: 'demo_seed_seller',
  displayName: 'Ferio Demo Listings',
};

interface DemoListing {
  title: string;
  purpose: 'RENT' | 'SALE';
  assetType: string;
  area: string;
  district: string;
  address: string;
  price: number;
  rentFrequency?: string;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  totalFloors?: number;
  areaSqFt?: number;
  parking?: number;
  furnishing?: string;
  amenities: string[];
  lat: number;
  lng: number;
}

const LISTINGS: DemoListing[] = [
  {
    title: 'South-facing 3BR apartment with balcony — Rampura',
    purpose: 'RENT', assetType: 'APARTMENT',
    area: 'Rampura', district: 'Dhaka',
    address: 'Road 4, Block C, Rampura Banani Bus Stand',
    price: 28000, rentFrequency: 'MONTHLY',
    bedrooms: 3, bathrooms: 3, floor: 5, totalFloors: 8,
    areaSqFt: 1450, parking: 1, furnishing: 'SEMI_FURNISHED',
    amenities: ['Lift', 'Generator', 'Gas Line', 'Security'],
    lat: 23.7509, lng: 90.4047,
  },
  {
    title: 'Family flat near Gulshan-2 circle, 2 beds',
    purpose: 'RENT', assetType: 'APARTMENT',
    area: 'Gulshan-2', district: 'Dhaka',
    address: 'Road 41, Gulshan 2',
    price: 52000, rentFrequency: 'MONTHLY',
    bedrooms: 2, bathrooms: 2, floor: 7, totalFloors: 10,
    areaSqFt: 1180, parking: 1, furnishing: 'FURNISHED',
    amenities: ['Lift', 'Gym', 'Community Space', 'CCTV'],
    lat: 23.7925, lng: 90.4078,
  },
  {
    title: 'Ground-floor retail shop on main road — Banani',
    purpose: 'RENT', assetType: 'SHOP',
    area: 'Banani', district: 'Dhaka',
    address: 'Road 11, Banani',
    price: 85000, rentFrequency: 'MONTHLY',
    bathrooms: 1, floor: 0, totalFloors: 6,
    areaSqFt: 720, furnishing: 'UNFURNISHED',
    amenities: ['Front Road', 'Generator Backup'],
    lat: 23.7888, lng: 90.4005,
  },
  {
    title: 'Ready 5 katha residential plot, Bashundhara R/A Block C',
    purpose: 'SALE', assetType: 'LAND',
    area: 'Bashundhara R/A', district: 'Dhaka',
    address: 'Block C, Bashundhara Residential Area',
    price: 24_000_000,
    amenities: ['Corner Plot', 'Gas Line Nearby', 'Road 25 ft'],
    lat: 23.8103, lng: 90.4293,
  },
  {
    title: 'Corporate office floor with 6 cabins — Motijheel',
    purpose: 'RENT', assetType: 'OFFICE',
    area: 'Motijheel', district: 'Dhaka',
    address: 'Dilkusha C/A, Motijheel',
    price: 120000, rentFrequency: 'MONTHLY',
    bedrooms: 0, bathrooms: 2, floor: 9, totalFloors: 18,
    areaSqFt: 2400, parking: 2,
    amenities: ['Lift', 'Central AC', 'Backup Power', 'Reception Desk'],
    lat: 23.7274, lng: 90.4137,
  },
  {
    title: 'Dry storage warehouse 3,200 sqft — Tejgaon I/A',
    purpose: 'RENT', assetType: 'WAREHOUSE',
    area: 'Tejgaon', district: 'Dhaka',
    address: 'Industrial Area, Tejgaon',
    price: 95000, rentFrequency: 'MONTHLY',
    bathrooms: 1, areaSqFt: 3200,
    amenities: ['Truck Access', '24/7 Guard', 'Loading Dock'],
    lat: 23.7603, lng: 90.3975,
  },
  {
    title: 'Newly built 4BR house for sale — Uttara Sector 7',
    purpose: 'SALE', assetType: 'HOUSE',
    area: 'Uttara', district: 'Dhaka',
    address: 'Sector 7, Uttara Model Town',
    price: 42_000_000,
    bedrooms: 4, bathrooms: 5, totalFloors: 2,
    areaSqFt: 3100, parking: 2, furnishing: 'UNFURNISHED',
    amenities: ['Rooftop Garden', 'Deep Tube Well', 'Car Porch'],
    lat: 23.8685, lng: 90.3976,
  },
  {
    title: 'Secure basement store room 450 sqft — Mirpur DOHS',
    purpose: 'RENT', assetType: 'STORE_ROOM',
    area: 'Mirpur DOHS', district: 'Dhaka',
    address: 'Avenue 4, Mirpur DOHS',
    price: 15000, rentFrequency: 'MONTHLY',
    bathrooms: 0, areaSqFt: 450,
    amenities: ['CCTV', 'Fire Extinguishers'],
    lat: 23.8068, lng: 90.3687,
  },
];

async function main() {
  const seller = await db.marketplaceAccount.upsert({
    where: { centralUserId: SELLER.centralUserId },
    create: {
      centralUserId: SELLER.centralUserId,
      accountType: 'OWNER',
      displayName: SELLER.displayName,
      phone: '+8801711000000',
      email: 'demo@ferio.test',
      isIdentityVerified: true,
      verificationBadge: 'VERIFIED',
    },
    update: {},
  });

  // Replace previous seed batch (idempotent re-runs).
  await db.propertyListing.deleteMany({
    where: { sellerId: seller.id, sourceUnitId: null },
  });

  let created = 0;
  for (const l of LISTINGS) {
    const { lat, lng, ...rest } = l;
    await db.propertyListing.create({
      data: {
        ...rest,
        sellerId: seller.id,
        sellerType: 'OWNER',
        status: 'ACTIVE',
        latitude: lat,
        longitude: lng,
        publishedAt: new Date(),
        media: {
          create: [
            {
              url: `https://picsum.photos/seed/${encodeURIComponent(l.title.slice(0, 18))}/800/600`,
              type: 'IMAGE',
              isCover: true,
              order: 0,
            },
          ],
        },
      },
    });
    created++;
  }

  console.log(`✅ Seeded ${created} listings for ${seller.displayName}`);

  // Sanity: geometry column must exist and be populated.
  const rows = await db.$queryRaw<Array<{ n: bigint }>>(
    Prisma.sql`SELECT COUNT(*)::bigint AS n FROM "PropertyListing" WHERE "location" IS NOT NULL`,
  );
  console.log(`📍 Rows with PostGIS location populated: ${rows[0].n}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
