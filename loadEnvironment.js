import dotenv from 'dotenv';

export function loadPostmanEnvironment() {
    try {
        dotenv.config();
        
        const envVars = {
            Version: process.env.VERSION || 'v21.0',
            PhoneNumberID: process.env.PHONE_NUMBER_ID,
            AccessToken: process.env.WHATSAPP_TOKEN
        };

        console.log('Loaded environment variables:', {
            Version: envVars.Version,
            PhoneNumberID: envVars.PhoneNumberID,
            hasAccessToken: !!envVars.AccessToken
        });

        return envVars;
    } catch (error) {
        console.error('Error loading environment:', error);
        return null;
    }
} 