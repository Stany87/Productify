export async function handler(event, context) {
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello from Netlify Functions!',
            db: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'MISSING'
        })
    };
}
