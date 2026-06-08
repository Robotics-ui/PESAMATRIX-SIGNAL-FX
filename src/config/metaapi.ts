// @ts-ignore
import MetaApi from '@metaapi/metaapi-javascript-sdk';
import { env } from './env.js';

// Instantiate the production SDK object instance
export const metaApi = new MetaApi.default(env.METAAPI_TOKEN);
