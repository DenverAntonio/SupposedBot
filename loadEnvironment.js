/**
 * Environment Configuration Loader
 * 
 * Loads and validates environment variables required for the WhatsApp API integration.
 * Provides a centralized way to access environment configuration.
 * 
 * @module loadEnvironment
 * @requires dotenv
 */

import dotenv from 'dotenv';

/**
 * Loads Postman environment variables from .env file
 * @returns {Object} Environment variables object
 * @throws {Error} If WHATSAPP_TOKEN is missing
 */
export function loadPostmanEnvironment() {
    dotenv.config();
    
    const envVars = {
        Version: process.env.VERSION || 'v21.0',
        PhoneNumberID: process.env.PHONE_NUMBER_ID,
        AccessToken: process.env.WHATSAPP_TOKEN
    };

    if (!envVars.AccessToken) {
        throw new Error('WHATSAPP_TOKEN is required but not provided');
    }

    return envVars;
} 