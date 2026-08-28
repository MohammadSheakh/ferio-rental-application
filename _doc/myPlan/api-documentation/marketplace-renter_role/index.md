# Marketplace — Visitor / Renter / Seller Role

**Surface:** ferio.com (port 3001) · **Auth:** Optional JWT (browsing) / Required (actions)
**Frontend:** `ferio-marketplace-web`

---

## 1. Home / Search Screens

### Screen: Property Search with Filters
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/marketplace/listings/search?purpose=RENT&area=Gulshan&minPrice=15000&maxPrice=40000` | Search listings w/ filters + pagination |
| 2 | GET | `/marketplace/listings/search?lat=23.78&lng=90.40&radiusKm=3&sortBy=nearest` | Radius search (PostGIS ST_DWithin) |
| 3 | GET | `/marketplace/listings/search?sortBy=price_asc` | Sort by price |
| 4 | GET | `/marketplace/listings/map?minLat=23.7&maxLat=23.85&minLng=90.35&maxLng=90.45` | Map viewport markers |
| 5 | GET | `/marketplace/listings/spotlight` | Homepage featured listings (TOP_SEARCH promotions) |

**Response fields per listing card:** `id, title, price, purpose, assetType, area, district, coverImageUrl, promotionTier, promotionBadges[], distanceKm?, seller{displayName, isIdentityVerified}`

### Screen: Map View
Same as search but uses `GET /marketplace/listings/map` which returns lightweight `{markers[]}` for Leaflet rendering.

---

## 2. Listing Detail Screen

### Screen: Full Listing Page
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/marketplace/listings/:id` | Full detail incl. rooms[], media[], documents[] (visibility-filtered), seller info |

**Room-by-room response shape:**
```json
{
  "rooms": [
    {
      "name": "Master Bedroom",
      "type": "MASTER_BEDROOM",
      "lengthFt": 14,
      "widthFt": 12,
      "description": "Attached bath",
      "media": [{ "url": "...", "caption": "Wide angle" }]
    }
  ]
}
```

---

## 3. Favorites Screen

### Screen: My Saved Properties
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/accounts/:accountId/favorites/:listingId` | Toggle favorite |
| 2 | GET | `/marketplace/accounts/:accountId/favorites` | List all favorites |

---

## 4. Inquiry Flow

### Screen: Send Inquiry from Detail Page
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/listings/:listingId/inquiries` | Send inquiry to seller (rate limited 30/h) |

```json
{ "senderAccountId": "...", "message": "Is this available?", "phone": "017..." }
```

### Screen: My Inquiries
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/marketplace/accounts/:accountId/inquiries` | Sent + received inquiries |

---

## 5. Viewing Request Screen

### Screen: Schedule a Visit
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/listings/:listingId/viewing-requests` | Request viewing (rate limited 10/h) |
| 2 | GET | `/marketplace/accounts/:accountId/viewing-requests` | My viewing requests |

---

## 6. Report Abuse

### Screen: Report a Listing
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/listings/:listingId/report` | File report (rate limited 5/h) |

---

## 7. Sale Offer Flow (SALE listings)

### Screen: Make an Offer
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/listings/:listingId/offers` | Submit offer (JWT required) |
| 2 | GET | `/marketplace/offers/mine` | My offers across listings |
| 3 | POST | `/marketplace/offers/:offerId/withdraw` | Withdraw pending offer |

### Screen: Seller Manages Offers
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/marketplace/listings/:listingId/offers` | All offers on my listing |
| 2 | POST | `/marketplace/offers/:offerId/counter` | Counter-offer at new amount |
| 3 | POST | `/marketplace/offers/:offerId/accept` | Accept → listing SOLD |
| 4 | POST | `/marketplace/offers/:offerId/reject` | Reject offer |
| 5 | POST | `/marketplace/offers/:offerId/accept-counter` | Buyer accepts seller's counter |

### Screen: Sale Timeline
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/marketplace/listings/:listingId/sale-timeline` | Merged inquiries + offers + counters + decisions |

---

## 8. Post Property Screen (Seller)

### Screen: Post Property Form
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/marketplace/promotions/catalog` | Get promotion pricing (FEATURED/URGENT/TOP_SEARCH × 7/15/30d) |
| 2 | POST | `/payments/intents` | Pay for promotion online |
| 3 | POST | `/marketplace/uploads/images` | Upload photos (multipart ≤5MB) |
| 4 | POST | `/marketplace/accounts/:accountId/listings` | Create listing (enters PENDING_REVIEW) |
| 5 | POST | `/marketplace/accounts/:accountId/listings/:listingId/media` | Attach cover + gallery photos |
| 6 | POST | `/marketplace/accounts/:accountId/listings/:listingId/rooms` | Add room-by-room detail (§24) |
| 7 | POST | `/marketplace/accounts/:accountId/listings/:listingId/documents` | Upload legal documents |

### Screen: Edit Listing
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | PATCH | `/marketplace/accounts/:accountId/listings/:listingId` | Edit content |
| 2 | PATCH | `/marketplace/accounts/:accountId/listings/:listingId/status` | Pause / mark rented/sold |
| 3 | PATCH | `/marketplace/accounts/:accountId/listings/:listingId/rooms/:roomId` | Edit room |
| 4 | DELETE | `/marketplace/accounts/:accountId/listings/:listingId/rooms/:roomId` | Remove room |
| 5 | POST | `/marketplace/accounts/:accountId/listings/:listingId/rooms/:roomId/media` | Add room photo |

### Screen: Boost My Ad (post-submit upsell)
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/listings/:listingId/promotions` | Order FEATURED/URGENT/TOP_SEARCH |
| 2 | GET | `/marketplace/promotions/:promoId/stats` | Inquiry count during promoted window |

---

## 9. Upload Endpoints (Seller)

### Screen: Upload Photos / Documents
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/marketplace/uploads/images` | Upload jpeg/png/webp ≤5MB → { url } |
| 2 | POST | `/marketplace/uploads/documents` | Upload pdf/jpeg/png ≤10MB → { url } |

Both require `Authorization: Bearer <jwt>`. Returns stable URL for registration against media/rooms/documents.
