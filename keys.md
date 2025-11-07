# API Keys Format Reference

Complete reference for validating API keys from Stripe, MongoDB Atlas, and Supabase.

---

## Stripe

### Key Types & Use Cases

Stripe has different key variations depending on your integration needs:

#### 1. **Basic Setup** (No webhooks)
- **Publishable Key** (`pk_`)
- **Secret Key** (`sk_`)
- Use case: Simple payment processing, checkout sessions

#### 2. **With Webhooks** (Recommended for production)
- **Publishable Key** (`pk_`)
- **Secret Key** (`sk_`)
- **Webhook Secret** (`whsec_`)
- Use case: Real-time event handling, subscription management, payment confirmations

#### 3. **With Restricted Keys** (Most secure)
- **Publishable Key** (`pk_`)
- **Restricted Key** (`rk_live_` or `rk_test_`)
- **Webhook Secret** (`whsec_`) - optional
- Use case: Limiting API access scope, better security

### Format

**Secret Key (Standard):**
- Prefix: `sk_live_` or `sk_test_`
- Followed by 24+ alphanumeric characters

**Restricted Key:**
- Prefix: `rk_live_` or `rk_test_`
- Followed by 24+ alphanumeric characters

**Publishable Key:**
- Prefix: `pk_live_` or `pk_test_`
- Followed by 24+ alphanumeric characters

**Webhook Secret:**
- Prefix: `whsec_`
- Followed by 24+ alphanumeric characters

### Examples

```
Secret Key (Test): sk_test_51H8xK2L3m4n5o6p7q8r9s0t1u2v3w4x5y6z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B5C

Publishable Key (Test): pk_test_51H8xK2L3m4n5o6p7q8r9s0t1u2v3w4x5y6z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P

Webhook Secret (Test): whsec_1234567890abcdefghijklmnopqrstuvwxyzABCDEF

Restricted Key (Live): rk_live_51H8xK2L3m4n5o6p7q8r9s0t1u2v3w4x5y6z7A8B9C0D1E2F3G
```

### Validation Code

```javascript
function isValidStripeSecretKey(key) {
  const secretKeyRegex = /^sk_(live|test)_[a-zA-Z0-9]{24,}$/;
  return secretKeyRegex.test(key);
}

function isValidStripeRestrictedKey(key) {
  const restrictedKeyRegex = /^rk_(live|test)_[a-zA-Z0-9]{24,}$/;
  return restrictedKeyRegex.test(key);
}

function isValidStripePublishableKey(key) {
  const publishableKeyRegex = /^pk_(live|test)_[a-zA-Z0-9]{24,}$/;
  return publishableKeyRegex.test(key);
}

function isValidStripeWebhookSecret(secret) {
  const webhookRegex = /^whsec_[a-zA-Z0-9]{24,}$/;
  return webhookRegex.test(secret);
}

function isValidStripeKey(key) {
  return isValidStripeSecretKey(key) || 
         isValidStripeRestrictedKey(key) ||
         isValidStripePublishableKey(key) || 
         isValidStripeWebhookSecret(key);
}

function getStripeKeyType(key) {
  if (/^sk_test_/.test(key)) return 'secret-test';
  if (/^sk_live_/.test(key)) return 'secret-live';
  if (/^rk_test_/.test(key)) return 'restricted-test';
  if (/^rk_live_/.test(key)) return 'restricted-live';
  if (/^pk_test_/.test(key)) return 'publishable-test';
  if (/^pk_live_/.test(key)) return 'publishable-live';
  if (/^whsec_/.test(key)) return 'webhook-secret';
  return null;
}

// Validate complete Stripe configuration
function validateStripeConfig(config) {
  const errors = [];
  const warnings = [];
  
  // Check required keys
  if (!config.publishableKey) {
    errors.push('Publishable key is required');
  } else if (!isValidStripePublishableKey(config.publishableKey)) {
    errors.push('Invalid publishable key format');
  }
  
  // Check for either secret or restricted key
  const hasSecretKey = config.secretKey && isValidStripeSecretKey(config.secretKey);
  const hasRestrictedKey = config.restrictedKey && isValidStripeRestrictedKey(config.restrictedKey);
  
  if (!hasSecretKey && !hasRestrictedKey) {
    errors.push('Either secret key or restricted key is required');
  }
  
  if (hasSecretKey && hasRestrictedKey) {
    warnings.push('Both secret and restricted keys provided - restricted key will be ignored');
  }
  
  // Check environment consistency
  const pubEnv = config.publishableKey?.includes('_test_') ? 'test' : 'live';
  const secretEnv = config.secretKey?.includes('_test_') ? 'test' : 'live';
  const restrictedEnv = config.restrictedKey?.includes('_test_') ? 'test' : 'live';
  
  if (hasSecretKey && pubEnv !== secretEnv) {
    errors.push('Publishable key and secret key environments do not match');
  }
  if (hasRestrictedKey && pubEnv !== restrictedEnv) {
    errors.push('Publishable key and restricted key environments do not match');
  }
  
  // Webhook secret validation (optional)
  if (config.webhookSecret) {
    if (!isValidStripeWebhookSecret(config.webhookSecret)) {
      errors.push('Invalid webhook secret format');
    }
  } else {
    warnings.push('Webhook secret not provided - real-time event handling will be unavailable');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    environment: pubEnv,
    hasWebhooks: !!config.webhookSecret,
    keyType: hasRestrictedKey ? 'restricted' : 'standard'
  };
}

// Usage Examples
console.log(isValidStripeKey('sk_test_51H8xK2L3m4n5o6p7q8r9s0t1u2v3w4x5y6z7A')); // true
console.log(getStripeKeyType('whsec_1234567890abcdefghijklmnopqrst')); // 'webhook-secret'

// Validate basic setup (no webhooks)
const basicConfig = {
  publishableKey: 'pk_test_51H8xK...',
  secretKey: 'sk_test_51H8xK...'
};
console.log(validateStripeConfig(basicConfig));
// { isValid: true, warnings: ['Webhook secret not provided...'], ... }

// Validate complete setup (with webhooks)
const completeConfig = {
  publishableKey: 'pk_live_51H8xK...',
  secretKey: 'sk_live_51H8xK...',
  webhookSecret: 'whsec_1234567890abcdef...'
};
console.log(validateStripeConfig(completeConfig));
// { isValid: true, warnings: [], hasWebhooks: true, ... }
```

### Configuration Variations

#### Variation 1: Basic Payment Processing (No Webhooks)
```javascript
const stripeConfig = {
  publishableKey: 'pk_test_...',
  secretKey: 'sk_test_...'
};
// Sufficient for: Checkout sessions, one-time payments, basic Stripe Elements
```

#### Variation 2: Production with Webhooks (Recommended)
```javascript
const stripeConfig = {
  publishableKey: 'pk_live_...',
  secretKey: 'sk_live_...',
  webhookSecret: 'whsec_...'
};
// Required for: Subscriptions, payment confirmations, refunds, disputes
```

#### Variation 3: Secure with Restricted Keys
```javascript
const stripeConfig = {
  publishableKey: 'pk_live_...',
  restrictedKey: 'rk_live_...',  // Limited permissions
  webhookSecret: 'whsec_...'
};
// Best for: Production environments with principle of least privilege
```

#### Variation 4: Multiple Webhook Endpoints
```javascript
const stripeConfig = {
  publishableKey: 'pk_live_...',
  secretKey: 'sk_live_...',
  webhookSecrets: {
    payments: 'whsec_abc...',
    subscriptions: 'whsec_def...',
    disputes: 'whsec_ghi...'
  }
};
// Advanced: Different webhook endpoints for different event types
```

---

## MongoDB Atlas

### Format

**Connection String:**
- Protocol: `mongodb+srv://` (or `mongodb://` for non-SRV)
- Pattern: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?<options>`

### Examples

```
mongodb+srv://myuser:mypassword@cluster0.abc1def.mongodb.net/myDatabase?retryWrites=true&w=majority
mongodb+srv://admin:P@ssw0rd123@production-cluster.xy9z1.mongodb.net/mainDB?retryWrites=true&w=majority
```

### Validation Code

```javascript
function isValidMongoDBUri(uri) {
  const mongoRegex = /^mongodb(\+srv)?:\/\/.+/;
  return mongoRegex.test(uri);
}

function isValidMongoDBAtlasUri(uri) {
  // Stricter validation for MongoDB Atlas specifically
  const atlasRegex = /^mongodb\+srv:\/\/[^:]+:[^@]+@[a-z0-9-]+\.[a-z0-9]+\.mongodb\.net\/.*/;
  return atlasRegex.test(uri);
}

function parseMongoDBUri(uri) {
  try {
    const url = new URL(uri.replace('mongodb+srv://', 'https://'));
    return {
      username: url.username,
      password: url.password,
      host: url.hostname,
      isAtlas: url.hostname.includes('mongodb.net'),
      isValid: isValidMongoDBUri(uri)
    };
  } catch {
    return { isValid: false };
  }
}

// Usage
console.log(isValidMongoDBAtlasUri('mongodb+srv://user:pass@cluster0.abc1def.mongodb.net/db')); // true
```

---

## Supabase

### Format (Updated 2024/2025)

Supabase now uses **two different API key formats**:

#### 1. Legacy Format (JWT-based)
**URL:**
- Pattern: `https://<project-ref>.supabase.co`
- Project ref: 20 lowercase alphanumeric characters

**Anon Key & Service Role Key:**
- Prefix: `eyJ` (JWT token)
- Length: 200+ characters
- Format: Standard JWT with three base64-encoded parts separated by dots

#### 2. New Format (Publishable/Secret Keys)
**Publishable Key:**
- Prefix: `sb_publishable_`
- Followed by base64-like characters with hyphens and underscores
- Pattern: `sb_publishable_[A-Za-z0-9_-]+`

**Secret Key:**
- Prefix: `sb_secret_`
- Followed by base64-like characters (may be masked in UI)
- Pattern: `sb_secret_[A-Za-z0-9_-]+`

### Examples

#### Legacy Format
```
URL: https://xstqigedezzkrvtsnmko.supabase.co

Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdHFpZ2VkZXp6a3J2dHNubWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkxMjM0NTYsImV4cCI6MjAwNDY5OTQ1Nn0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdHFpZ2VkZXp6a3J2dHNubWtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4OTEyMzQ1NiwiZXhwIjoyMDA0Njk5NDU2fQ.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

#### New Format
```
URL: https://xstqigedezzkrvtsnmko.supabase.co

Publishable Key: sb_publishable_Up0eeIECY1ZEOYGV-HOMWQ_xxq4DIRj

Secret Key: sb_secret_FBpYT3mK9xL2nP4qR6sT8uV0wX1yZ2aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5
```

### Validation Code

```javascript
// Legacy JWT-based keys
function isValidSupabaseJWT(key) {
  const jwtRegex = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
  return jwtRegex.test(key) && key.length > 100;
}

// New publishable/secret keys
function isValidSupabasePublishableKey(key) {
  const publishableRegex = /^sb_publishable_[A-Za-z0-9_-]+$/;
  return publishableRegex.test(key);
}

function isValidSupabaseSecretKey(key) {
  const secretRegex = /^sb_secret_[A-Za-z0-9_-]+$/;
  return secretRegex.test(key);
}

// URL validation
function isValidSupabaseUrl(url) {
  const supabaseUrlRegex = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
  return supabaseUrlRegex.test(url);
}

// Universal key validator (handles both formats)
function isValidSupabaseKey(key) {
  return isValidSupabaseJWT(key) || 
         isValidSupabasePublishableKey(key) || 
         isValidSupabaseSecretKey(key);
}

// Get key type
function getSupabaseKeyType(key) {
  if (isValidSupabasePublishableKey(key)) return 'publishable';
  if (isValidSupabaseSecretKey(key)) return 'secret';
  if (isValidSupabaseJWT(key)) {
    // Optionally decode JWT to check role
    try {
      const payload = JSON.parse(atob(key.split('.')[1]));
      return payload.role === 'anon' ? 'anon-jwt' : 'service-role-jwt';
    } catch {
      return 'jwt';
    }
  }
  return null;
}

// Complete validation
function validateSupabaseCredentials(url, key) {
  return isValidSupabaseUrl(url) && isValidSupabaseKey(key);
}

// Usage examples
console.log(isValidSupabaseUrl('https://xstqigedezzkrvtsnmko.supabase.co')); // true
console.log(isValidSupabasePublishableKey('sb_publishable_Up0eeIECY1ZEOYGV-HOMWQ_xxq4DIRj')); // true
console.log(isValidSupabaseSecretKey('sb_secret_FBpYT3mK9xL2nP4qR6sT8uV0wX1yZ2aB3cD4eF5gH6i')); // true
console.log(getSupabaseKeyType('sb_publishable_Up0eeIECY1ZEOYGV-HOMWQ_xxq4DIRj')); // 'publishable'
```

### TypeScript Types

```typescript
type StripeKeyType = 'secret' | 'restricted' | 'publishable' | 'webhook-secret';
type StripeEnvironment = 'test' | 'live' | 'unknown';
type StripeVariant = 'basic' | 'standard-with-webhooks' | 'secure-basic' | 'secure-with-webhooks';
type SupabaseKeyType = 'publishable' | 'secret' | 'anon-jwt' | 'service-role-jwt' | 'jwt';

interface StripeConfig {
  publishableKey: string;
  secretKey?: string;
  restrictedKey?: string;
  webhookSecret?: string;
}

interface StripeConfigMultiWebhook extends Omit<StripeConfig, 'webhookSecret'> {
  webhookSecrets?: {
    [endpointName: string]: string;
  };
}

interface APIKeys {
  stripe?: StripeConfig;
  mongodb?: {
    connectionString: string;
  };
  supabase?: {
    url: string;
    key: string;
    keyType?: SupabaseKeyType;
  };
}

interface ValidationResult {
  isValid: boolean;
  keyType?: string;
  environment?: StripeEnvironment;
  errors?: string[];
  warnings?: string[];
  variant?: StripeVariant;
  hasWebhooks?: boolean;
}
```

---

## Complete Validation Helper

```javascript
class APIKeyValidator {
  // Stripe - Individual key validation
  static validateStripe(key) {
    if (!key) return { isValid: false, error: 'Key is required' };
    
    const patterns = {
      secretKey: { regex: /^sk_(live|test)_[a-zA-Z0-9]{24,}$/, type: 'secret' },
      restrictedKey: { regex: /^rk_(live|test)_[a-zA-Z0-9]{24,}$/, type: 'restricted' },
      publishableKey: { regex: /^pk_(live|test)_[a-zA-Z0-9]{24,}$/, type: 'publishable' },
      webhookSecret: { regex: /^whsec_[a-zA-Z0-9]{24,}$/, type: 'webhook-secret' }
    };
    
    for (const [name, { regex, type }] of Object.entries(patterns)) {
      if (regex.test(key)) {
        const environment = key.includes('_test_') ? 'test' : 
                          key.includes('_live_') ? 'live' : 
                          'unknown';
        return { 
          isValid: true, 
          keyType: type,
          environment,
          fullType: environment !== 'unknown' ? `${type}-${environment}` : type
        };
      }
    }
    
    return { isValid: false, error: 'Invalid Stripe key format' };
  }
  
  // Stripe - Complete configuration validation
  static validateStripeConfig(config) {
    const errors = [];
    const warnings = [];
    
    // Check publishable key
    if (!config.publishableKey) {
      errors.push('Publishable key is required');
    } else {
      const pubResult = this.validateStripe(config.publishableKey);
      if (!pubResult.isValid || pubResult.keyType !== 'publishable') {
        errors.push('Invalid publishable key format');
      }
    }
    
    // Check for server-side key (secret or restricted)
    const hasSecretKey = config.secretKey;
    const hasRestrictedKey = config.restrictedKey;
    
    if (!hasSecretKey && !hasRestrictedKey) {
      errors.push('Either secret key or restricted key is required');
    }
    
    if (hasSecretKey) {
      const secretResult = this.validateStripe(config.secretKey);
      if (!secretResult.isValid || secretResult.keyType !== 'secret') {
        errors.push('Invalid secret key format');
      }
    }
    
    if (hasRestrictedKey) {
      const restrictedResult = this.validateStripe(config.restrictedKey);
      if (!restrictedResult.isValid || restrictedResult.keyType !== 'restricted') {
        errors.push('Invalid restricted key format');
      }
      if (hasSecretKey) {
        warnings.push('Both secret and restricted keys provided - restricted key will be ignored');
      }
    }
    
    // Check environment consistency
    const pubEnv = config.publishableKey?.includes('_test_') ? 'test' : 'live';
    const secretEnv = config.secretKey?.includes('_test_') ? 'test' : 'live';
    const restrictedEnv = config.restrictedKey?.includes('_test_') ? 'test' : 'live';
    
    if (hasSecretKey && pubEnv !== secretEnv) {
      errors.push('Publishable key and secret key must be in same environment (both test or both live)');
    }
    if (hasRestrictedKey && pubEnv !== restrictedEnv) {
      errors.push('Publishable key and restricted key must be in same environment (both test or both live)');
    }
    
    // Webhook secret validation (optional but recommended)
    if (config.webhookSecret) {
      const webhookResult = this.validateStripe(config.webhookSecret);
      if (!webhookResult.isValid || webhookResult.keyType !== 'webhook-secret') {
        errors.push('Invalid webhook secret format');
      }
    } else {
      warnings.push('No webhook secret provided - real-time event handling will be unavailable');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      environment: pubEnv,
      hasWebhooks: !!config.webhookSecret,
      keyType: hasRestrictedKey ? 'restricted' : 'standard',
      variant: this._getStripeVariant(config)
    };
  }
  
  static _getStripeVariant(config) {
    if (config.restrictedKey && config.webhookSecret) return 'secure-with-webhooks';
    if (config.restrictedKey) return 'secure-basic';
    if (config.webhookSecret) return 'standard-with-webhooks';
    return 'basic';
  }
  
  // MongoDB
  static validateMongoDB(uri) {
    if (!uri) return { isValid: false, error: 'URI is required' };
    
    const mongoRegex = /^mongodb(\+srv)?:\/\/.+/;
    const atlasRegex = /^mongodb\+srv:\/\/[^:]+:[^@]+@[a-z0-9-]+\.[a-z0-9]+\.mongodb\.net\/.*/;
    
    if (!mongoRegex.test(uri)) {
      return { isValid: false, error: 'Invalid MongoDB URI format' };
    }
    
    const isAtlas = atlasRegex.test(uri);
    return { 
      isValid: true, 
      keyType: isAtlas ? 'atlas' : 'standard',
      isAtlas 
    };
  }
  
  // Supabase
  static validateSupabase(url, key) {
    const errors = [];
    
    // Validate URL
    const urlRegex = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
    if (!url) {
      errors.push('URL is required');
    } else if (!urlRegex.test(url)) {
      errors.push('Invalid Supabase URL format');
    }
    
    // Validate Key
    if (!key) {
      errors.push('Key is required');
    } else {
      const jwtRegex = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
      const publishableRegex = /^sb_publishable_[A-Za-z0-9_-]+$/;
      const secretRegex = /^sb_secret_[A-Za-z0-9_-]+$/;
      
      let keyType = null;
      if (publishableRegex.test(key)) {
        keyType = 'publishable';
      } else if (secretRegex.test(key)) {
        keyType = 'secret';
      } else if (jwtRegex.test(key) && key.length > 100) {
        keyType = 'jwt';
      } else {
        errors.push('Invalid Supabase key format');
      }
      
      if (errors.length === 0) {
        return { isValid: true, keyType };
      }
    }
    
    return { isValid: false, error: errors.join(', ') };
  }
}

// Usage
const stripeResult = APIKeyValidator.validateStripe('sk_test_51H8xK2L3m4n5o6p7q8r9s0t1u2v3w4x');
console.log(stripeResult); // { isValid: true, keyType: 'secret', environment: 'test', fullType: 'secret-test' }

// Validate basic configuration (no webhooks)
const basicConfig = {
  publishableKey: 'pk_test_51H8xK...',
  secretKey: 'sk_test_51H8xK...'
};
const basicResult = APIKeyValidator.validateStripeConfig(basicConfig);
console.log(basicResult); 
// { isValid: true, variant: 'basic', warnings: ['No webhook secret provided...'], ... }

// Validate complete configuration (with webhooks)
const completeConfig = {
  publishableKey: 'pk_live_51H8xK...',
  secretKey: 'sk_live_51H8xK...',
  webhookSecret: 'whsec_1234567890abcdefghij'
};
const completeResult = APIKeyValidator.validateStripeConfig(completeConfig);
console.log(completeResult); 
// { isValid: true, variant: 'standard-with-webhooks', warnings: [], hasWebhooks: true, ... }

const mongoResult = APIKeyValidator.validateMongoDB('mongodb+srv://user:pass@cluster0.abc.mongodb.net/db');
console.log(mongoResult); // { isValid: true, keyType: 'atlas', isAtlas: true }

const supabaseResult = APIKeyValidator.validateSupabase(
  'https://xstqigedezzkrvtsnmko.supabase.co',
  'sb_publishable_Up0eeIECY1ZEOYGV-HOMWQ_xxq4DIRj'
);
console.log(supabaseResult); // { isValid: true, keyType: 'publishable' }
```

---

## Security Best Practices

### Storage
- **Never commit API keys to version control**
- Use environment variables (`.env` files)
- Use secret management services (AWS Secrets Manager, Azure Key Vault, etc.)

### Environment Variables Example
```bash
# .env file
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxx
```

### Key Rotation
- Rotate keys regularly (every 90 days recommended)
- Immediately rotate if compromised
- Test new keys before deactivating old ones

### Access Control
- **Stripe**: Use restricted keys when possible
- **MongoDB**: Use least-privilege database users
- **Supabase**: Use publishable keys for client-side, secret keys for server-side only

---

## Migration Notes

### Supabase Key Migration
If you're using legacy JWT-based Supabase keys:
1. Both formats work simultaneously
2. New projects get `sb_publishable_` and `sb_secret_` keys by default
3. Existing projects can continue using JWT keys
4. Update your validation code to support both formats (as shown above)

**When to use which:**
- **Publishable Key** (`sb_publishable_`): Client-side applications (same as anon JWT)
- **Secret Key** (`sb_secret_`): Server-side operations (same as service_role JWT)
- **JWT Keys**: Legacy support, still fully functional

---

### MAP FOR VARIANTS (WITH THIS WE CAN ASK AND INFORM ON THE PAGES WHAT NEED WHILE STILL USING THE SAME ICON):
### Use this map hardcoded on the code.
const SERVICE_IDENTIFIERS = {
  // Stripe Variants
  'stripe_simple': {
    name: 'Stripe Simple Checkout',
    provider: 'stripe',
    icon: 'stripe',
    required: ['publishableKey', 'secretKey'],
    optional: [],
    description: 'Basic payment processing without webhooks'
  },
  'stripe_webhooks': {
    name: 'Stripe with Webhooks',
    provider: 'stripe',
    icon: 'stripe',
    required: ['publishableKey', 'secretKey', 'webhookSecret'],
    optional: [],
    description: 'Full Stripe integration with real-time events'
  },
  'stripe_secure': {
    name: 'Stripe Secure',
    provider: 'stripe',
    icon: 'stripe',
    required: ['publishableKey', 'restrictedKey'],
    optional: ['webhookSecret'],
    description: 'Stripe with restricted API keys'
  },
  
  // Supabase Variants
  'supabase_auth': {
    name: 'Supabase Authentication',
    provider: 'supabase',
    icon: 'supabase',
    required: ['url', 'publishableKey'],
    optional: [],
    description: 'Authentication only (login, signup, OAuth)'
  },
  'supabase_database': {
    name: 'Supabase Database',
    provider: 'supabase',
    icon: 'supabase',
    required: ['url', 'publishableKey'],
    optional: ['secretKey'],
    description: 'Auth + Database read/write operations'
  },
  'supabase_full': {
    name: 'Supabase Full Access',
    provider: 'supabase',
    icon: 'supabase',
    required: ['url', 'publishableKey', 'secretKey'],
    optional: [],
    description: 'Complete Supabase features (auth, database, storage, functions)'
  },
  
  // MongoDB Variants
  'mongodb': {
    name: 'MongoDB Atlas',
    provider: 'mongodb',
    icon: 'mongodb',
    required: ['connectionString'],
    optional: [],
    description: 'MongoDB database connection'
  },
  'mongodb_read': {
    name: 'MongoDB Read-Only',
    provider: 'mongodb',
    icon: 'mongodb',
    required: ['connectionString'],
    optional: [],
    description: 'MongoDB with read-only access (different connection string with read user)'
  }
};

