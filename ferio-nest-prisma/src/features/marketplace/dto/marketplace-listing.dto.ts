import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDateString,
  Min,
} from 'class-validator';
import {
  ListingPurpose,
  ListingAssetType,
  SellerType,
  DocumentVisibility,
  RoomType,
} from '@prisma/marketplace-client';

export class CreateListingDto {
  @ApiProperty({ enum: ListingPurpose, example: 'RENT' })
  @IsEnum(ListingPurpose)
  purpose!: ListingPurpose;

  @ApiProperty({ enum: ListingAssetType, example: 'APARTMENT' })
  @IsEnum(ListingAssetType)
  assetType!: ListingAssetType;

  @ApiPropertyOptional({ enum: SellerType, example: 'OWNER' })
  @IsEnum(SellerType)
  @IsOptional()
  sellerType?: SellerType;

  @ApiProperty({
    description: 'Listing title',
    example: 'Modern 3BR Apartment in Rampura',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Detailed property description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Price in BDT', example: 25000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Is price negotiable?' })
  @IsBoolean()
  @IsOptional()
  priceNegotiable?: boolean;

  @ApiPropertyOptional({
    description: 'Rent frequency: MONTHLY | QUARTERLY | YEARLY',
  })
  @IsString()
  @IsOptional()
  rentFrequency?: string;

  @ApiPropertyOptional({ description: 'Available from date' })
  @IsDateString()
  @IsOptional()
  availableFrom?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsNumber()
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsNumber()
  @IsOptional()
  totalFloors?: number;

  @ApiPropertyOptional({ description: 'Area in square feet', example: 1450 })
  @IsNumber()
  @IsOptional()
  areaSqFt?: number;

  @ApiPropertyOptional({
    description: 'Land size in Katha (for land/building)',
  })
  @IsNumber()
  @IsOptional()
  landSizeKatha?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  parking?: number;

  @ApiPropertyOptional({
    description: 'UNFURNISHED | SEMI_FURNISHED | FURNISHED',
  })
  @IsString()
  @IsOptional()
  furnishing?: string;

  @ApiPropertyOptional({
    description: 'List of amenities',
    example: ['Lift', 'Generator', 'Security', 'Gas'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @ApiPropertyOptional({ example: 'House 12, Road 4, Block C, Rampura' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Rampura' })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ example: 'Dhaka Division' })
  @IsString()
  @IsOptional()
  division?: string;

  @ApiPropertyOptional({ example: 23.7629 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 90.4184 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Auto-expiry date — ACTIVE listings past this become EXPIRED (cron)' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateListingDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  priceNegotiable?: boolean;

  @ApiPropertyOptional({ description: 'MONTHLY | QUARTERLY | YEARLY' })
  @IsString()
  @IsOptional()
  rentFrequency?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  availableFrom?: string;

  @ApiPropertyOptional() @IsNumber() @IsOptional() bedrooms?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() bathrooms?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() floor?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() totalFloors?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() areaSqFt?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() landSizeKatha?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() parking?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() furnishing?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() area?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() neighbourhood?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() district?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() division?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() postalCode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() latitude?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() longitude?: number;
}

export class AddListingMediaDto {
  @ApiProperty({ example: 'https://storage.ferio.com/listings/img1.jpg' })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({ example: 'IMAGE' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isCover?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  caption?: string;
}

export class AddListingDocumentDto {
  @ApiProperty({ example: 'RS Khatian Land Paper' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'https://storage.ferio.com/docs/khatian.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty({ example: 'DEED' })
  @IsString()
  @IsNotEmpty()
  docType!: string;

  @ApiPropertyOptional({ enum: DocumentVisibility, example: 'VERIFIED_USERS' })
  @IsEnum(DocumentVisibility)
  @IsOptional()
  visibility?: DocumentVisibility;
}

export class AddListingRoomDto {
  @ApiProperty({ description: 'Room name', example: 'Master Bedroom' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: RoomType, example: 'MASTER_BEDROOM' })
  @IsEnum(RoomType)
  @IsOptional()
  type?: RoomType;

  @ApiPropertyOptional({
    description: 'Room length in feet',
    example: 14,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  lengthFt?: number;

  @ApiPropertyOptional({
    description: 'Room width in feet',
    example: 12,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  widthFt?: number;

  @ApiPropertyOptional({
    description: 'Room-specific description',
    example: 'Attached bath, south-facing windows',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Photo URL registrations for this room',
    type: [Object],
  })
  @IsArray()
  @IsOptional()
  media?: Array<{ url: string; caption?: string }>;
}

export class UpdateListingRoomDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional({ enum: RoomType }) @IsEnum(RoomType) @IsOptional() type?: RoomType;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() lengthFt?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() widthFt?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() sortOrder?: number;
}

export class SearchListingsDto {
  @ApiPropertyOptional({ enum: ListingPurpose })
  @IsEnum(ListingPurpose)
  @IsOptional()
  purpose?: ListingPurpose;

  @ApiPropertyOptional({ enum: ListingAssetType })
  @IsEnum(ListingAssetType)
  @IsOptional()
  assetType?: ListingAssetType;

  @ApiPropertyOptional({ example: 'Rampura' })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  // ── Geospatial: radius search ──
  @ApiPropertyOptional({
    example: 23.7629,
    description: 'Center latitude for radius/nearest search',
  })
  @IsNumber()
  @Min(-90)
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({
    example: 90.4184,
    description: 'Center longitude for radius/nearest search',
  })
  @IsNumber()
  @Min(-180)
  @IsOptional()
  lng?: number;

  @ApiPropertyOptional({ description: 'Radius in KM', example: 5 })
  @IsNumber()
  @IsOptional()
  radiusKm?: number;

  // ── Geospatial: map bounds (viewport) ──
  @ApiPropertyOptional({ description: 'Viewport south edge', example: 23.7 })
  @IsNumber()
  @Min(-90)
  @IsOptional()
  minLat?: number;

  @ApiPropertyOptional({ description: 'Viewport north edge', example: 23.85 })
  @IsNumber()
  @Min(-90)
  @IsOptional()
  maxLat?: number;

  @ApiPropertyOptional({ description: 'Viewport west edge', example: 90.35 })
  @IsNumber()
  @Min(-180)
  @IsOptional()
  minLng?: number;

  @ApiPropertyOptional({ description: 'Viewport east edge', example: 90.45 })
  @IsNumber()
  @Min(-180)
  @IsOptional()
  maxLng?: number;

  @ApiPropertyOptional({
    enum: ['relevance', 'nearest', 'price_asc', 'price_desc', 'newest'],
    default: 'relevance',
    description: 'Sort order. `nearest` requires lat/lng.',
  })
  @IsString()
  @IsOptional()
  sortBy?: 'relevance' | 'nearest' | 'price_asc' | 'price_desc' | 'newest';

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class MapSearchDto {
  @ApiProperty({ description: 'Viewport south edge', example: 23.7 })
  @IsNumber()
  @Min(-90)
  minLat!: number;

  @ApiProperty({ description: 'Viewport north edge', example: 23.85 })
  @IsNumber()
  @Min(-90)
  maxLat!: number;

  @ApiProperty({ description: 'Viewport west edge', example: 90.35 })
  @IsNumber()
  @Min(-180)
  minLng!: number;

  @ApiProperty({ description: 'Viewport east edge', example: 90.45 })
  @IsNumber()
  @Min(-180)
  maxLng!: number;

  @ApiPropertyOptional({ enum: ListingPurpose })
  @IsEnum(ListingPurpose)
  @IsOptional()
  purpose?: ListingPurpose;

  @ApiPropertyOptional({ enum: ListingAssetType })
  @IsEnum(ListingAssetType)
  @IsOptional()
  assetType?: ListingAssetType;

  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Max markers returned',
    example: 500,
    default: 500,
  })
  @IsNumber()
  @IsOptional()
  limit?: number;
}
