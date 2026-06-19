import { createApp } from './app';
import { config } from './config';

const { app, cache } = createApp();
cache.startSweeper(config.cache.sweepIntervalMs);

app.listen(config.port, () => {
  console.log(`user-api listening on http://localhost:${config.port}`);
});
