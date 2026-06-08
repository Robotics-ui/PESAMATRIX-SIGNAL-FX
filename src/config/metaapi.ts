// @ts-ignore
import MetaApi from 'metaapi.cloud-sdk';
import { env } from './env.js';

// Instantiate the production SDK object instance
export const metaApi = new MetaApi(env.METAAPI_TOKEN);
