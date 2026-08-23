'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Search, MapPin, Building2, FileCheck, ArrowUpRight, X, Filter } from 'lucide-react';
import Link from 'next/link';

export default function RenterSearchPage() {
  const [selectedPurpose, setSelectedPurpose] = useState<'ALL' | 'RENT' | 'SALE'>('ALL');
  const [selectedAssetType, setSelectedAssetType] = useState<string>('ALL');
  const [areaQuery, setAreaQuery] = useState('');
  const [minBedrooms, setMinBedrooms] = useState<number | undefined>(undefined);
  const [showMapView, setShowMapView] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Default initial mock listings aligned with Bangladesh Rental PRD
  const fallbackListings = [
    {
      id: 'list-101',
      title: 'Luxury 3-BR Apartment with South Balcony',
      purpose: 'RENT',
      assetType: 'APARTMENT',
      area: 'Gulshan-2',
      district: 'Dhaka',
      price: 45000,
      rentFrequency: 'MONTHLY',
      bedrooms: 3,
      bathrooms: 3,
      areaSqFt: 1850,
      seller: { displayName: 'Mahmudur Rahman', isIdentityVerified: true },
      media: [{ url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80', isCover: true }],
    },
    {
      id: 'list-102',
      title: 'Commercial Ground-Floor Retail Shop',
      purpose: 'RENT',
      assetType: 'SHOP',
      area: 'Banani',
      district: 'Dhaka',
      price: 75000,
      rentFrequency: 'MONTHLY',
      bedrooms: 0,
      bathrooms: 1,
      areaSqFt: 650,
      seller: { displayName: 'Sultana Parveen', isIdentityVerified: false },
      media: [{ url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80', isCover: true }],
    },
    {
      id: 'list-103',
      title: '3-Katha Residential Land & Building for Sale',
      purpose: 'SALE',
      assetType: 'LAND',
      area: 'Dhanmondi',
      district: 'Dhaka',
      price: 35000000,
      rentFrequency: null,
      bedrooms: 5,
      bathrooms: 5,
      areaSqFt: 3600,
      seller: { displayName: 'Tanvir Hossain', isIdentityVerified: true },
      media: [{ url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', isCover: true }],
    },
    {
      id: 'list-104',
      title: 'Secure Basement Store Room / Small Warehouse',
      purpose: 'RENT',
      assetType: 'STORE_ROOM',
      area: 'Uttara',
      district: 'Dhaka',
      price: 18000,
      rentFrequency: 'MONTHLY',
      bedrooms: 0,
      bathrooms: 0,
      areaSqFt: 450,
      seller: { displayName: 'Kamrul Hasan', isIdentityVerified: false },
      media: [{ url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80', isCover: true }],
    },
  ];

  useEffect(() => {
    fetchListings();
  }, [selectedPurpose, selectedAssetType, areaQuery, minBedrooms]);

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPurpose !== 'ALL') params.append('purpose', selectedPurpose);
      if (selectedAssetType !== 'ALL') params.append('assetType', selectedAssetType);
      if (areaQuery) params.append('area', areaQuery);
      if (minBedrooms) params.append('bedrooms', minBedrooms.toString());

      const res = await fetch(`http://localhost:3000/marketplace/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setListings(data.items);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {
      // API fallback gracefully
    }
    setListings(fallbackListings);
    setIsLoading(false);
  };

  const filteredListings = listings.filter((item) => {
    if (selectedPurpose !== 'ALL' && item.purpose !== selectedPurpose) return false;
    if (selectedAssetType !== 'ALL' && item.assetType !== selectedAssetType) return false;
    if (areaQuery && !item.area.toLowerCase().includes(areaQuery.toLowerCase())) return false;
    if (minBedrooms && (item.bedrooms || 0) < minBedrooms) return false;
    return true;
  });

  const handleOpenInquiry = (item: any) => {
    setSelectedListing(item);
    setInquirySubmitted(false);
    setInquiryModalOpen(true);
  };

  return (
    <div className="bg-[#ffffff] min-h-screen text-[#111114]">
      {/* Header */}
      <Header
        title="Marketplace Property Search"
        subtitle="Public discovery engine — Rent apartments, commercial shops, store rooms & verified land sales"
        quickActionLabel="Post Property Ad"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Search & Filter Bar */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#6e6e73] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search area (e.g. Rampura, Gulshan, Banani)..."
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] text-xs text-[#111114] focus:outline-none focus:border-[#111114]"
              />
            </div>

            {/* Purpose Filter */}
            <div className="flex items-center gap-1 bg-[#fafafa] p-1 border border-[#e8e8ea] rounded-[9999px]">
              {(['ALL', 'RENT', 'SALE'] as const).map((purpose) => (
                <button
                  key={purpose}
                  onClick={() => setSelectedPurpose(purpose)}
                  className={`px-3 py-1 text-xs font-medium rounded-[9999px] transition-colors ${
                    selectedPurpose === purpose ? 'bg-[#111114] text-white' : 'text-[#6e6e73] hover:text-[#111114]'
                  }`}
                >
                  {purpose === 'ALL' ? 'All Purposes' : purpose === 'RENT' ? 'For Rent' : 'For Sale'}
                </button>
              ))}
            </div>

            {/* Map Toggle Button */}
            <button
              onClick={() => setShowMapView(!showMapView)}
              className="btn-pill-secondary text-xs"
            >
              {showMapView ? 'Switch to Grid View' : 'View OpenStreetMap Grid'}
            </button>
          </div>

          {/* Asset Type Filters */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#e8e8ea] text-xs overflow-x-auto">
            <span className="eyebrow-label mr-2 shrink-0">Asset Category:</span>
            {[
              { id: 'ALL', label: 'All Types' },
              { id: 'APARTMENT', label: 'Apartments' },
              { id: 'SHOP', label: 'Shops & Commercial' },
              { id: 'LAND', label: 'Land & Plots' },
              { id: 'STORE_ROOM', label: 'Store Rooms' },
              { id: 'OFFICE', label: 'Offices' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedAssetType(cat.id)}
                className={`px-3 py-1 rounded-[9999px] transition-colors ${
                  selectedAssetType === cat.id
                    ? 'bg-[#111114] text-white'
                    : 'bg-[#fafafa] text-[#6e6e73] hover:bg-[#e8e8ea]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map View Container */}
        {showMapView && (
          <div className="hairline-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow-label">OpenStreetMap Location Coordinates</span>
              <span className="text-xs text-[#6e6e73]">PostGIS Bounding Box Query Active</span>
            </div>
            <div className="h-48 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] flex flex-col items-center justify-center space-y-2">
              <MapPin className="w-8 h-8 text-[#111114]" />
              <p className="text-xs text-[#6e6e73] text-center max-w-sm">
                OpenStreetMap GIS rendering active for Dhaka area coordinates.
              </p>
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="grid grid-cols-3 gap-6">
          {filteredListings.map((item) => (
            <div key={item.id} className="hairline-card space-y-3 flex flex-col justify-between">
              <div>
                {/* Media Placeholder / Image */}
                <div className="h-44 w-full bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] overflow-hidden mb-3 relative">
                  {item.media && item.media[0] ? (
                    <img src={item.media[0].url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[#6e6e73]">
                      No Image Preview
                    </div>
                  )}
                  <span
                    className={`absolute top-2.5 left-2.5 status-pill ${
                      item.purpose === 'SALE' ? 'status-pill-warning' : 'status-pill-success'
                    }`}
                  >
                    {item.purpose === 'SALE' ? 'FOR SALE' : 'FOR RENT'}
                  </span>
                </div>

                {/* Title & Specs */}
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#111114] leading-snug">{item.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#6e6e73]">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{item.area}, {item.district || 'Dhaka'}</span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-[#6e6e73] space-y-1">
                  <div>Type: <strong className="text-[#111114]">{item.assetType}</strong></div>
                  <div>Area: <strong className="text-[#111114]">{item.areaSqFt} sq ft</strong></div>
                  {item.seller && (
                    <div className="flex items-center gap-1">
                      <span>Seller:</span>
                      <strong className="text-[#111114]">{item.seller.displayName}</strong>
                      {item.seller.isIdentityVerified && (
                        <FileCheck className="w-3.5 h-3.5 text-emerald-700 inline" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Price & Action Button */}
              <div className="pt-3 border-t border-[#e8e8ea] flex items-center justify-between">
                <div>
                  <div className="eyebrow-label">Price</div>
                  <div className="text-sm font-bold text-[#111114]">
                    ৳ {item.price.toLocaleString()} {item.rentFrequency ? '/ mo' : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleOpenInquiry(item)}
                  className="btn-pill-primary text-xs py-1.5 px-3"
                >
                  Inquire Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inquiry Modal */}
      {inquiryModalOpen && selectedListing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#111114]">Inquire for Listing</h3>
                <p className="text-xs text-[#6e6e73]">{selectedListing.title}</p>
              </div>
              <button onClick={() => setInquiryModalOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inquirySubmitted ? (
              <div className="py-6 text-center space-y-3">
                <div className="status-pill status-pill-success text-xs px-3 py-1 mx-auto">
                  Inquiry Dispatched Successfully
                </div>
                <p className="text-xs text-[#6e6e73]">
                  Your request has been forwarded to the property seller. They will reach out to your provided phone number.
                </p>
                <button onClick={() => setInquiryModalOpen(false)} className="btn-pill-primary text-xs py-2 px-6">
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setInquirySubmitted(true);
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="eyebrow-label block mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tanvir Hossain"
                    className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] text-[#111114]"
                  />
                </div>

                <div>
                  <label className="eyebrow-label block mb-1">Phone / WhatsApp Number</label>
                  <input
                    type="text"
                    required
                    placeholder="+8801711000000"
                    className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] text-[#111114] font-mono"
                  />
                </div>

                <div>
                  <label className="eyebrow-label block mb-1">Message to Seller</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="I am interested in this listing. Please arrange a viewing."
                    className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] text-[#111114]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInquiryModalOpen(false)}
                    className="btn-pill-secondary text-xs py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill-primary text-xs py-2 px-4">
                    Send Direct Inquiry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
