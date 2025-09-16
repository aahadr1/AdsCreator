# Credit System Documentation

## Overview

This credit system provides a comprehensive solution for managing AI model usage costs with a fair, tier-based pricing structure. Users are allocated monthly credits based on their subscription tier and can track their usage across all AI tools.

## Credit Tiers

### Basic Plan
- **Monthly Credits**: 500 credits
- **Features**: Core lipsync features, standard processing, email support
- **Best for**: Light users and testing

### Pro Plan  
- **Monthly Credits**: 1,000 credits
- **Features**: Everything in Basic + priority processing, advanced models, priority support
- **Best for**: Regular users and content creators

## Model Pricing

Credits are consumed based on the complexity and cost of the AI models:

### Lipsync Models
- **Sieve Sync Basic** (`sievesync-1.1`): 10 credits
- **Sync Labs Standard** (`lipsync-2`): 15 credits
- **Sync Labs Pro** (`lipsync-2-pro`): 25 credits
- **LatentSync** (`latentsync`): 20 credits
- **Kling Video** (`kling`): 30 credits

### Text-to-Speech Models
- **Minimax TTS HD** (`minimax-speech-02-hd`): 5 credits
- **ElevenLabs TTS** (`elevenlabs-tts`): 8 credits
- **Dia TTS** (`dia-tts`): 6 credits

### Other Models
- **Auto Edit**: 15 credits
- **Background Removal**: 8 credits
- **Video Enhancement**: 12 credits
- **Image Generation**: 5 credits
- **Transcription**: 3 credits
- **Veo Video Generation**: 35 credits

## Architecture

### Database Schema

#### `user_credits` Table
- `user_id`: UUID (Primary Key)
- `subscription_tier`: 'basic' | 'pro'
- `monthly_limit`: Integer
- `used_credits`: Integer
- `current_period_start`: Timestamp
- `current_period_end`: Timestamp
- `last_reset_date`: Timestamp

#### `credit_usage` Table
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `model_name`: String
- `model_category`: String
- `credits_used`: Integer
- `task_id`: String (Optional)
- `metadata`: JSONB

#### `credit_transactions` Table
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `type`: 'usage' | 'refund' | 'bonus' | 'reset'
- `credits`: Integer
- `balance_before`: Integer
- `balance_after`: Integer
- `description`: String

### API Endpoints

#### Credit Status
- **GET** `/api/credits/status?user_id={id}`
- Returns current credit status and handles monthly resets

#### Credit Usage
- **POST** `/api/credits/use`
- Consumes credits for model usage
- Validates sufficient credits before processing

#### Credit History
- **GET** `/api/credits/history?user_id={id}`
- Returns usage history and transactions

### Components

#### `CreditProvider`
React context provider that manages credit state across the application.

#### `CreditCounter`
Sidebar component displaying current credit status with visual indicators.

#### `CreditGuard`
Wrapper component that checks credit availability before allowing actions.

#### `CreditCostDisplay`
Shows credit costs for different models with multiple display variants.

#### `CreditManagement`
Full credit management interface with usage history and pricing information.

## Integration Guide

### 1. Add Credit Tracking to API Routes

```typescript
// Add to your API route
const creditResponse = await fetch('/api/credits/use', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    model_name: 'your-model-name',
    metadata: { /* optional metadata */ }
  })
});

if (!creditResponse.ok) {
  return new Response('Insufficient credits', { status: 402 });
}
```

### 2. Add Credit Display to UI

```tsx
import { CreditGuard, CreditCostDisplay } from '../components/CreditGuard';

// Show credit cost
<CreditCostDisplay modelName="your-model" variant="detailed" />

// Protect actions with credit guard
<CreditGuard modelName="your-model">
  <button onClick={performAction}>Generate</button>
</CreditGuard>
```

### 3. Update Frontend Requests

```typescript
// Include user_id in API requests
const response = await fetch('/api/your-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...yourData,
    user_id: user.id // Required for credit tracking
  })
});
```

## Database Setup

1. Run the credit system migration:
```sql
-- Execute db/credits.sql
```

2. Initialize credits for existing users:
```sql
-- Call init_user_credits for each user
SELECT init_user_credits('user-id', 'basic');
```

## Features

### Automatic Monthly Reset
Credits automatically reset at the beginning of each billing cycle based on the user's subscription period.

### Real-time Updates
Credit status updates immediately after each usage, with real-time UI updates.

### Usage Analytics
Detailed tracking of credit usage by model, category, and time period.

### Credit Warnings
Visual indicators when users approach their credit limits:
- **Warning**: 75-90% usage (yellow)
- **Critical**: 90%+ usage (red)

### Insufficient Credit Protection
Actions are automatically disabled when users don't have enough credits, with clear messaging about upgrade options.

## Security Features

- Row Level Security (RLS) ensures users can only access their own credit data
- Credit consumption is atomic and validated server-side
- All transactions are logged for audit purposes

## Monitoring

The system tracks:
- Credit usage patterns by model and user
- Peak usage times
- Credit exhaustion rates
- Most popular models by credit consumption

## Support

For technical issues:
1. Check the credit status API for the user
2. Review transaction logs in the `credit_transactions` table
3. Verify subscription tier is correctly set
4. Ensure monthly reset logic is functioning

## Future Enhancements

- Credit top-ups for premium users
- Usage predictions and recommendations
- Credit sharing for team accounts
- Custom pricing for enterprise users
