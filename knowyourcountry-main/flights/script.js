const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Mock API key (In real scenarios, use environment variables to manage API keys securely)
const API_KEY = 'your_booking_com_api_key';

// Mock endpoint to simulate fetching flight data
app.get('/api/flights', async (req, res) => {
    const { country } = req.query;

    if (!country) {
        return res.status(400).send('Please provide a country.');
    }

    try {
        // Replace with actual Booking.com API endpoint and parameters
        // const response = await axios.get(`https://api.booking.com/flights?destination_country=${country}&apikey=${API_KEY}`);
        
        // Mock response data
        const mockResponse = {
            flights: [
                {
                    flightNumber: 'BC123',
                    airline: 'Booking Airlines',
                    departureTime: '2024-08-01T08:00:00Z',
                    arrivalTime: '2024-08-01T12:00:00Z',
                    price: '$300',
                    origin: 'JFK',
                    destination: 'CDG'
                },
                {
                    flightNumber: 'BC456',
                    airline: 'Booking Airlines',
                    departureTime: '2024-08-01T10:00:00Z',
                    arrivalTime: '2024-08-01T14:00:00Z',
                    price: '$350',
                    origin: 'LAX',
                    destination: 'CDG'
                }
            ]
        };

        res.json(mockResponse);
    } catch (error) {
        res.status(500).send('Error fetching flight data');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
