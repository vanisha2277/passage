import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { register } from '@arizeai/phoenix-otel';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicInstrumentation } from '@arizeai/openinference-instrumentation-anthropic';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const phoenixUrl = process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006';

export const tracerProvider = register({
  projectName: process.env.PHOENIX_PROJECT_NAME || 'passage',
  url: phoenixUrl,
});

const instrumentation = new AnthropicInstrumentation({ tracerProvider });
instrumentation.manuallyInstrument(Anthropic);

export { instrumentation };
