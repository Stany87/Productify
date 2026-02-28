export async function handler(event, context) {
    const hasMongoUri = !!process.env.MONGODB_URI;
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const maskedUri = process.env.MONGODB_URI
        ? process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
        : 'NOT SET';

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Netlify function is alive',
            env: {
                MONGODB_URI: maskedUri,
                GROQ_API_KEY: hasGroqKey ? 'SET' : 'NOT SET',
                NODE_ENV: process.env.NODE_ENV || 'unknown',
            }
        }),
    };
}
