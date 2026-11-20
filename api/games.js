import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const tokenResponse = await axios.post(
            `https://id.twitch.tv/oauth2/token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=client_credentials`
        );
        const accessToken = tokenResponse.data.access_token;

        const igdbResponse = await axios.post(
            'https://api.igdb.com/v4/games',
            req.body, 
            {
                headers: {
                    'Client-ID': process.env.CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'text/plain',
                    'Accept': 'application/json'
                },
            }
        );

        res.status(200).json(igdbResponse.data);

    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch data from IGDB' });
    }
}