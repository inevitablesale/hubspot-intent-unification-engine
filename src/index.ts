import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { createApp } from './app';

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 HubSpot Intent Unification Engine running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 OAuth authorize: http://localhost:${PORT}/oauth/authorize`);
  console.log(`📈 API documentation: http://localhost:${PORT}/`);
});
