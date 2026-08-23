import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in .env file');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.env.ADMIN_EMAIL?.trim() || 'mohammad.sheakh01@gmail.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'asdfasdf';
  const name = process.env.ADMIN_NAME?.trim() || 'Ferio Admin';

  // if (password.length < 12) {
  //   throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  // }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: UserRole.admin,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      name,
      email,
      password: hashedPassword,
      role: UserRole.admin,
      isEmailVerified: true,
    },
  });

  /*
  const deliveryZones = [
    {
      name: 'Dhaka metro',
      deliveryFee: 7000,
      freeDeliveryThreshold: 300000,
      sortOrder: 0,
      districts: ['Dhaka'],
    },
    {
      name: 'Major cities',
      deliveryFee: 12000,
      freeDeliveryThreshold: 500000,
      sortOrder: 10,
      districts: [
        'Chattogram',
        'Gazipur',
        'Narayanganj',
        'Rajshahi',
        'Khulna',
        'Sylhet',
      ],
    },
    {
      name: 'Nationwide',
      deliveryFee: 15000,
      freeDeliveryThreshold: 700000,
      sortOrder: 20,
      districts: [
        'Barishal',
        'Rangpur',
        'Mymensingh',
        'Cumilla',
        'Bogura',
        'Dinajpur',
        'Jashore',
        'Cox’s Bazar',
      ],
    },
  ];

  for (const zoneSeed of deliveryZones) {
    const existingZone = await prisma.deliveryZone.findFirst({
      where: { name: zoneSeed.name },
    });
    const zone = existingZone
      ? await prisma.deliveryZone.update({
        where: { id: existingZone.id },
        data: {
          deliveryFee: zoneSeed.deliveryFee,
          freeDeliveryThreshold: zoneSeed.freeDeliveryThreshold,
          sortOrder: zoneSeed.sortOrder,
          isActive: true,
        },
      })
      : await prisma.deliveryZone.create({
        data: {
          name: zoneSeed.name,
          deliveryFee: zoneSeed.deliveryFee,
          freeDeliveryThreshold: zoneSeed.freeDeliveryThreshold,
          sortOrder: zoneSeed.sortOrder,
        },
      });

    for (const districtName of zoneSeed.districts) {
      const normalizedName = districtName
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      await prisma.deliveryZoneDistrict.upsert({
        where: { normalizedName },
        update: { name: districtName, zoneId: zone.id },
        create: { name: districtName, normalizedName, zoneId: zone.id },
      });
    }
  }
  */

  const shipmentProviders = [
    {
      code: 'STEADFAST' as const,
      name: 'Steadfast Courier',
      baseUrl: process.env.STEADFAST_BASE_URL || 'https://portal.steadfast.com.bd/api/v1',
      isActive: Boolean(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY),
    },
    {
      code: 'PATHAO' as const,
      name: 'Pathao Courier',
      baseUrl: process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com',
      isActive: Boolean(
        process.env.PATHAO_CLIENT_ID &&
        process.env.PATHAO_CLIENT_SECRET &&
        process.env.PATHAO_USERNAME &&
        process.env.PATHAO_PASSWORD &&
        process.env.PATHAO_STORE_ID,
      ),
    },
    {
      code: 'REDX' as const,
      name: 'REDX Logistics',
      baseUrl: process.env.REDX_BASE_URL || 'https://openapi.redx.com.bd',
      isActive: Boolean(process.env.REDX_API_TOKEN),
    },
    {
      code: 'ECOURIER' as const,
      name: 'eCourier',
      baseUrl: process.env.ECOURIER_BASE_URL || 'https://backoffice.ecourier.com.bd/api',
      isActive: Boolean(
        process.env.ECOURIER_API_KEY &&
        process.env.ECOURIER_API_SECRET &&
        process.env.ECOURIER_USER_ID,
      ),
    },
    {
      code: 'PAPERFLY' as const,
      name: 'Paperfly Courier',
      baseUrl: process.env.PAPERFLY_BASE_URL || 'https://paperfly.com.bd/api',
      isActive: Boolean(
        process.env.PAPERFLY_USERNAME &&
        process.env.PAPERFLY_PASSWORD &&
        process.env.PAPERFLY_KEY,
      ),
    },
    {
      code: 'CARRYBEE' as const,
      name: 'CarryBee Courier',
      baseUrl: process.env.CARRYBEE_BASE_URL || 'https://developers.carrybee.com',
      isActive: Boolean(
        process.env.CARRYBEE_CLIENT_ID &&
        process.env.CARRYBEE_CLIENT_SECRET &&
        process.env.CARRYBEE_CLIENT_CONTEXT,
      ),
    },
  ];
  for (const provider of shipmentProviders) {
    await prisma.shipmentProvider.upsert({
      where: { code: provider.code },
      update: {
        name: provider.name,
        baseUrl: provider.baseUrl,
        isActive: provider.isActive,
      },
      create: provider,
    });
  }

  const stores = [
    {
      code: 'MAIN',
      name: 'Central Warehouse & Hub',
      isStore: false,
      district: 'Dhaka',
      area: 'Rampura',
      address: '247, West Rampura, Dhaka',
      phone: '+8801518419801',
      isActive: true,
    },
    // {
    //   code: 'STORE-DHN',
    //   name: 'Ferio Dhanmondi Flagship Store',
    //   isStore: true,
    //   district: 'Dhaka',
    //   area: 'Dhanmondi',
    //   address: 'House 42, Road 11/A, Dhanmondi, Dhaka 1209',
    //   phone: '+8801700000001',
    //   operatingHours: '10:00 AM - 08:30 PM',
    //   operatingDays: 'Sat - Thu',
    //   pickupInstructions: 'Show your 6-digit pickup OTP to the desk manager at 1st floor counter.',
    //   isActive: true,
    // },
    // {
    //   code: 'STORE-JFP',
    //   name: 'Ferio Jamuna Future Park Outlet',
    //   isStore: true,
    //   district: 'Dhaka',
    //   area: 'Kuril',
    //   address: 'Shop #2F-014, Level 2 (West Court), Jamuna Future Park, Dhaka',
    //   phone: '+8801700000002',
    //   operatingHours: '11:00 AM - 09:00 PM',
    //   operatingDays: 'Wed - Mon (Closed Tue)',
    //   pickupInstructions: 'Store located near West Court escalator. Present order ID and OTP.',
    //   isActive: true,
    // },
    // {
    //   code: 'STORE-UTT',
    //   name: 'Ferio Uttara Experience Center',
    //   isStore: true,
    //   district: 'Dhaka',
    //   area: 'Uttara',
    //   address: 'Building 12, Sector 3, Jasimuddin Avenue, Uttara, Dhaka',
    //   phone: '+8801700000003',
    //   operatingHours: '10:00 AM - 08:00 PM',
    //   operatingDays: 'Sat - Thu',
    //   pickupInstructions: 'Ground floor pickup counter. Parking space available.',
    //   isActive: true,
    // },
  ];

  for (const store of stores) {
    await prisma.warehouse.upsert({
      where: { code: store.code },
      update: store,
      create: store,
    });
  }

  console.log(`Seeded Ferio admin: ${email}`);
  // console.log(`Seeded ${deliveryZones.length} delivery zones`);
  console.log(`Seeded ${shipmentProviders.length} shipment providers`);
  console.log(`Seeded ${stores.length} store locations & warehouses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
