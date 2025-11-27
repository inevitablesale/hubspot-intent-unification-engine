# HubSpot Intent Unification Engine

HubSpot app that merges Apollo and ZoomInfo intent, enrichment, and signal data into a unified intent score. Generates awareness spikes, ICP match scoring, persona mapping, and sales triggers directly in HubSpot to fuel outbound and ABM operations.

## Features

- **Unified Intent Scoring**: Combines intent signals from Apollo and ZoomInfo into a single weighted score
- **Awareness Spike Detection**: Automatically detects significant increases in intent and creates alerts
- **ICP Matching**: Scores companies against your Ideal Customer Profile criteria
- **Persona Scoring**: Identifies and scores contacts against persona profiles (Decision Maker, Technical Evaluator, End User)
- **Enrichment Delta Sync**: Tracks and detects changes in enrichment data over time
- **HubSpot CRM Cards**: Displays intent trends, ICP match, and persona scores directly in HubSpot records
- **HubSpot Timeline Events**: Creates timeline events for awareness spikes
- **OAuth Authentication**: Secure HubSpot OAuth 2.0 integration

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- HubSpot Developer Account

### Installation

```bash
# Clone the repository
git clone https://github.com/inevitablesale/hubspot-intent-unification-engine.git
cd hubspot-intent-unification-engine

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configuration

Edit `.env` with your HubSpot app credentials:

```env
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:3000/oauth/callback
HUBSPOT_SCOPES=crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write timeline
PORT=3000
```

### Running the App

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### OAuth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/authorize` | GET | Redirect to HubSpot OAuth |
| `/oauth/callback` | GET | OAuth callback handler |
| `/oauth/status/:portalId` | GET | Check authentication status |
| `/oauth/revoke/:portalId` | DELETE | Revoke tokens |

### Intent Signal Sync

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sync/apollo/intent` | POST | Receive Apollo intent signals |
| `/sync/zoominfo/intent` | POST | Receive ZoomInfo intent signals |
| `/sync/scores` | GET | Get all unified intent scores |
| `/sync/scores/:companyId` | GET | Get score for specific company |
| `/sync/spikes` | GET | Get awareness spike alerts |

### Enrichment Sync

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sync/apollo/enrichment` | POST | Receive Apollo enrichment data |
| `/sync/zoominfo/enrichment` | POST | Receive ZoomInfo enrichment data |
| `/sync/enrichment/merged/:entityType/:entityId` | GET | Get merged enrichment data |

### Scoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scoring/icp` | POST | Calculate ICP match for a company |
| `/scoring/icp/batch` | POST | Calculate ICP match for multiple companies |
| `/scoring/persona` | POST | Calculate persona score for a contact |
| `/scoring/persona/batch` | POST | Calculate persona scores for multiple contacts |

### CRM Cards

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/crm-cards/intent-trends` | GET | Intent trends card for companies |
| `/crm-cards/icp-match` | GET | ICP match card for companies |
| `/crm-cards/persona` | GET | Persona card for contacts |

## Usage Examples

### Send Apollo Intent Signals

```bash
curl -X POST http://localhost:3000/sync/apollo/intent \
  -H "Content-Type: application/json" \
  -d '{
    "signals": [
      {
        "companyId": "company-123",
        "companyName": "Acme Corp",
        "domain": "acme.com",
        "topic": "Cloud Computing",
        "signalStrength": 75
      }
    ]
  }'
```

### Calculate ICP Match

```bash
curl -X POST http://localhost:3000/scoring/icp \
  -H "Content-Type: application/json" \
  -d '{
    "companyData": {
      "id": "company-123",
      "employeeCount": 500,
      "industry": "Technology",
      "annualRevenue": 50000000,
      "domain": "acme.com",
      "country": "United States"
    }
  }'
```

### Calculate Persona Score

```bash
curl -X POST http://localhost:3000/scoring/persona \
  -H "Content-Type: application/json" \
  -d '{
    "contactData": {
      "id": "contact-456",
      "email": "ceo@acme.com",
      "title": "CEO",
      "department": "Executive",
      "seniority": "C-Level"
    }
  }'
```

## Scoring Logic

### Intent Score Calculation

The unified intent score is calculated as:

```
Overall Score = (Apollo Score × 0.5) + (ZoomInfo Score × 0.5)
```

Each source score is weighted by:
- Signal recency (time decay over 30 days)
- Signal strength (0-100)

### ICP Matching

Default ICP criteria (configurable):
- Employee Count: 50-5,000 (25% weight)
- Industry: Technology, Software, Financial Services, Healthcare (25% weight)
- Annual Revenue: $5M-$500M (30% weight)
- Has Website (10% weight)
- Country: US, Canada, UK, Australia (10% weight)

### Persona Profiles

Three default personas:
1. **Decision Maker**: C-Level, VP, Director titles in Executive/Sales/Marketing
2. **Technical Evaluator**: Engineers, Architects in Engineering/IT/Product
3. **End User**: Managers, Specialists in Sales/Marketing/Customer Success

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Build TypeScript
npm run build
```

## Project Structure

```
├── src/
│   ├── index.ts              # Application entry point
│   ├── app.ts                # Express app configuration
│   ├── models/
│   │   └── types.ts          # TypeScript interfaces
│   ├── routes/
│   │   ├── oauth.ts          # OAuth endpoints
│   │   ├── sync.ts           # Sync endpoints
│   │   ├── scoring.ts        # Scoring endpoints
│   │   └── crmCards.ts       # CRM card endpoints
│   └── services/
│       ├── scoringEngine.ts  # Intent scoring logic
│       ├── icpPersonaScoring.ts  # ICP/Persona scoring
│       ├── enrichmentSync.ts # Enrichment sync logic
│       └── hubspotService.ts # HubSpot API integration
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
└── dist/                     # Compiled JavaScript
```

## License

ISC

